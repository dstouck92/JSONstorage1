import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import pool, { initDb } from './db';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { getSpotifyClient, isSpotifyConnected } from './spotify';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

const JWT_SECRET = process.env.JWT_SECRET || 'herd-secret-key-change-in-production';

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());

const isProduction = process.env.NODE_ENV === 'production';
const clientPath = path.join(__dirname, '../client');
if (isProduction) {
  app.use(express.static(clientPath));
}

interface AuthRequest extends express.Request {
  userId?: number;
  username?: string;
}

function authMiddleware(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
      req.userId = decoded.userId;
      req.username = decoded.username;
    } catch (e) {
    }
  }
  next();
}

app.use(authMiddleware);

const DEMO_USER_ID = 1;
const DEMO_USERNAME = 'David Stouck';

async function ensureDemoUser() {
  const result = await pool.query('SELECT id FROM users WHERE id = $1', [DEMO_USER_ID]);
  if (result.rows.length === 0) {
    await pool.query(
      'INSERT INTO users (id, username, avatar) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [DEMO_USER_ID, DEMO_USERNAME, 'goat']
    );
  }
}

async function loadDemoData() {
  const result = await pool.query('SELECT COUNT(*) FROM streaming_history WHERE user_id = $1', [DEMO_USER_ID]);
  if (parseInt(result.rows[0].count) > 0) {
    console.log('Demo data already loaded');
    return;
  }

  console.log('Loading demo data from JSON files...');
  const files = fs.readdirSync('.').filter(f => f.includes('Streaming_History_Audio') && f.endsWith('.json'));
  
  let totalRecords = 0;
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const validRecords = data.filter((r: any) => r.master_metadata_track_name && r.ms_played > 0);
      
      const BATCH_SIZE = 500;
      for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
        const batch = validRecords.slice(i, i + BATCH_SIZE);
        const values: any[] = [];
        const placeholders: string[] = [];
        
        batch.forEach((record: any, idx: number) => {
          const offset = idx * 8;
          placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
          values.push(
            DEMO_USER_ID,
            record.ts,
            record.master_metadata_track_name,
            record.master_metadata_album_artist_name,
            record.master_metadata_album_album_name,
            record.ms_played,
            record.spotify_track_uri,
            record.platform
          );
        });
        
        await pool.query(
          `INSERT INTO streaming_history (user_id, ts, track_name, artist_name, album_name, ms_played, spotify_track_uri, platform)
           VALUES ${placeholders.join(', ')}`,
          values
        );
        totalRecords += batch.length;
      }
      console.log(`Loaded ${file} (${validRecords.length} records)`);
    } catch (e) {
      console.error(`Error loading ${file}:`, e);
    }
  }
  console.log(`Loaded ${totalRecords} total records`);
}

async function syncAllUsersFromFiles() {
  console.log('Syncing all users from JSON files...');
  
  const files = fs.readdirSync('.').filter(f => 
    f.startsWith('User_') && f.includes('Streaming_History_Audio') && f.endsWith('.json')
  );
  
  const userFilesMap: Record<string, string[]> = {};
  
  for (const file of files) {
    const match = file.match(/^User_(.+?)_Streaming_History_Audio/);
    if (match) {
      const rawName = match[1].replace(/_/g, ' ').trim();
      if (!userFilesMap[rawName]) {
        userFilesMap[rawName] = [];
      }
      userFilesMap[rawName].push(file);
    }
  }
  
  for (const [username, userFiles] of Object.entries(userFilesMap)) {
    try {
      let userResult = await pool.query('SELECT id FROM users WHERE username ILIKE $1', [username]);
      let userId: number;
      
      if (userResult.rows.length === 0) {
        const insertResult = await pool.query(
          'INSERT INTO users (username, avatar) VALUES ($1, $2) RETURNING id',
          [username, 'goat']
        );
        userId = insertResult.rows[0].id;
        console.log(`Created user: ${username} (ID: ${userId})`);
      } else {
        userId = userResult.rows[0].id;
      }
      
      const countResult = await pool.query('SELECT COUNT(*) FROM streaming_history WHERE user_id = $1', [userId]);
      if (parseInt(countResult.rows[0].count) > 0) {
        console.log(`User ${username} already has data, skipping...`);
        continue;
      }
      
      let totalRecords = 0;
      for (const file of userFiles) {
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
          const validRecords = data.filter((r: any) => r.master_metadata_track_name && r.ms_played > 0);
          
          const BATCH_SIZE = 500;
          for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
            const batch = validRecords.slice(i, i + BATCH_SIZE);
            const values: any[] = [];
            const placeholders: string[] = [];
            
            batch.forEach((record: any, idx: number) => {
              const offset = idx * 8;
              placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
              values.push(
                userId,
                record.ts,
                record.master_metadata_track_name,
                record.master_metadata_album_artist_name,
                record.master_metadata_album_album_name,
                record.ms_played,
                record.spotify_track_uri,
                record.platform
              );
            });
            
            await pool.query(
              `INSERT INTO streaming_history (user_id, ts, track_name, artist_name, album_name, ms_played, spotify_track_uri, platform)
               VALUES ${placeholders.join(', ')}`,
              values
            );
            totalRecords += batch.length;
          }
        } catch (e) {
          console.error(`Error processing ${file}:`, e);
        }
      }
      console.log(`Imported ${totalRecords} records for ${username}`);
    } catch (e) {
      console.error(`Error syncing user ${username}:`, e);
    }
  }
  
  console.log('User sync complete!');
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || username.trim().length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }
    
    const existing = await pool.query('SELECT id FROM users WHERE username ILIKE $1', [username.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, avatar) VALUES ($1, $2, $3) RETURNING id, username, avatar',
      [username.trim(), passwordHash, 'goat']
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    res.json({ user: { id: user.id, username: user.username, avatar: user.avatar } });
  } catch (err) {
    console.error('Error signing up:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const result = await pool.query('SELECT * FROM users WHERE username ILIKE $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    if (user.password_hash) {
      if (!password) {
        return res.status(401).json({ error: 'Password required' });
      }
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }
    
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    res.json({ 
      user: { 
        id: user.id, 
        username: user.username, 
        avatar: user.avatar,
        hasPassword: !!user.password_hash,
        spotifyConnected: user.spotify_connected
      } 
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/set-password', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { password } = req.body;
    
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.userId]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error setting password:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/auth/me', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.json({ user: null });
    }
    
    const result = await pool.query(
      'SELECT id, username, avatar, password_hash IS NOT NULL as has_password, spotify_connected FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ user: null });
    }
    
    const user = result.rows[0];
    res.json({ 
      user: { 
        id: user.id, 
        username: user.username, 
        avatar: user.avatar,
        hasPassword: user.has_password,
        spotifyConnected: user.spotify_connected
      } 
    });
  } catch (err) {
    console.error('Error getting current user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/spotify/status', async (req, res) => {
  try {
    const connected = await isSpotifyConnected();
    res.json({ connected });
  } catch (err) {
    res.json({ connected: false });
  }
});

app.post('/api/spotify/sync', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const connected = await isSpotifyConnected();
    if (!connected) {
      return res.status(400).json({ error: 'Spotify not connected' });
    }
    
    const spotify = await getSpotifyClient();
    const recentTracks = await spotify.player.getRecentlyPlayedTracks(50);
    
    let imported = 0;
    for (const item of recentTracks.items) {
      const track = item.track;
      const playedAt = new Date(item.played_at);
      
      await pool.query(
        `INSERT INTO streaming_history (user_id, ts, track_name, artist_name, album_name, ms_played, spotify_track_uri, platform)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          req.userId,
          playedAt,
          track.name,
          track.artists[0]?.name || 'Unknown Artist',
          track.album?.name || 'Unknown Album',
          track.duration_ms,
          track.uri,
          'spotify_api'
        ]
      );
      imported++;
    }
    
    await pool.query('UPDATE users SET spotify_connected = TRUE WHERE id = $1', [req.userId]);
    
    res.json({ success: true, imported });
  } catch (err) {
    console.error('Error syncing Spotify:', err);
    res.status(500).json({ error: 'Failed to sync Spotify data' });
  }
});

app.get('/api/user/:userId?', async (req: AuthRequest, res) => {
  try {
    const userId = req.params.userId || DEMO_USER_ID;
    
    let userQuery;
    if (typeof userId === 'string' && isNaN(parseInt(userId))) {
      userQuery = await pool.query('SELECT * FROM users WHERE username ILIKE $1', [userId]);
    } else {
      userQuery = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    }
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userQuery.rows[0];
    
    const statsQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(ms_played), 0) as total_ms,
        COUNT(DISTINCT track_name) as total_songs
      FROM streaming_history WHERE user_id = $1
    `, [user.id]);
    
    const topArtistsQuery = await pool.query(`
      SELECT artist_name, SUM(ms_played) as total_ms, COUNT(*) as plays
      FROM streaming_history 
      WHERE user_id = $1 AND artist_name IS NOT NULL
      GROUP BY artist_name
      ORDER BY total_ms DESC
      LIMIT 10
    `, [user.id]);
    
    const topSongsQuery = await pool.query(`
      SELECT track_name, artist_name, SUM(ms_played) as total_ms, COUNT(*) as plays
      FROM streaming_history 
      WHERE user_id = $1 AND track_name IS NOT NULL
      GROUP BY track_name, artist_name
      ORDER BY total_ms DESC
      LIMIT 10
    `, [user.id]);
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        createdAt: user.created_at
      },
      stats: {
        totalMinutes: Math.round(parseInt(statsQuery.rows[0].total_ms) / 60000),
        totalSongs: parseInt(statsQuery.rows[0].total_songs)
      },
      topArtists: topArtistsQuery.rows.map(r => ({
        name: r.artist_name,
        minutes: Math.round(parseInt(r.total_ms) / 60000),
        plays: parseInt(r.plays)
      })),
      topSongs: topSongsQuery.rows.map(r => ({
        name: r.track_name,
        artist: r.artist_name,
        minutes: Math.round(parseInt(r.total_ms) / 60000),
        plays: parseInt(r.plays)
      }))
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/artist/:artistName', async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.userId || DEMO_USER_ID;
    const artistName = decodeURIComponent(req.params.artistName);
    
    const leaderboardQuery = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        u.avatar,
        SUM(sh.ms_played) as total_ms,
        COUNT(DISTINCT sh.track_name) as song_count
      FROM streaming_history sh
      JOIN users u ON sh.user_id = u.id
      WHERE sh.artist_name ILIKE $1
      GROUP BY u.id, u.username, u.avatar
      ORDER BY total_ms DESC
      LIMIT 10
    `, [artistName]);
    
    const commentsQuery = await pool.query(`
      SELECT 
        c.id,
        c.content,
        c.likes,
        c.created_at,
        u.username,
        u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.artist_name ILIKE $1
      ORDER BY c.created_at DESC
      LIMIT 20
    `, [artistName]);
    
    res.json({
      artist: {
        name: artistName
      },
      leaderboard: leaderboardQuery.rows.map((r, i) => ({
        rank: i + 1,
        userId: r.user_id,
        username: r.username,
        avatar: r.avatar,
        minutes: Math.round(parseInt(r.total_ms) / 60000),
        songCount: parseInt(r.song_count),
        isCurrentUser: r.user_id === currentUserId
      })),
      comments: commentsQuery.rows.map(c => ({
        id: c.id,
        content: c.content,
        likes: c.likes,
        createdAt: c.created_at,
        username: c.username,
        avatar: c.avatar
      }))
    });
  } catch (err) {
    console.error('Error fetching artist:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/artist/:artistName/comment', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId || DEMO_USER_ID;
    const artistName = decodeURIComponent(req.params.artistName);
    const { content } = req.body;
    
    const result = await pool.query(
      'INSERT INTO comments (user_id, artist_name, content) VALUES ($1, $2, $3) RETURNING *',
      [userId, artistName, content]
    );
    
    const user = await pool.query('SELECT username, avatar FROM users WHERE id = $1', [userId]);
    
    res.json({
      id: result.rows[0].id,
      content: result.rows[0].content,
      likes: 0,
      createdAt: result.rows[0].created_at,
      username: user.rows[0].username,
      avatar: user.rows[0].avatar
    });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/comment/:commentId/like', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId || DEMO_USER_ID;
    const commentId = parseInt(req.params.commentId);
    
    await pool.query(
      'INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [commentId, userId]
    );
    
    await pool.query(
      'UPDATE comments SET likes = (SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1) WHERE id = $1',
      [commentId]
    );
    
    const result = await pool.query('SELECT likes FROM comments WHERE id = $1', [commentId]);
    res.json({ likes: result.rows[0].likes });
  } catch (err) {
    console.error('Error liking comment:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const username = req.body.username || `User_${uuidv4().slice(0, 8)}`;
    
    let userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    let userId: number;
    
    if (userResult.rows.length === 0) {
      const newUser = await pool.query(
        'INSERT INTO users (username, avatar) VALUES ($1, $2) RETURNING id',
        [username, 'goat']
      );
      userId = newUser.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }
    
    let totalRecords = 0;
    const BATCH_SIZE = 500;
    
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(file.path, 'utf-8'));
        const validRecords = data.filter((r: any) => r.master_metadata_track_name && r.ms_played > 0);
        
        for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
          const batch = validRecords.slice(i, i + BATCH_SIZE);
          const values: any[] = [];
          const placeholders: string[] = [];
          
          batch.forEach((record: any, idx: number) => {
            const offset = idx * 8;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
            values.push(
              userId,
              record.ts,
              record.master_metadata_track_name,
              record.master_metadata_album_artist_name,
              record.master_metadata_album_album_name,
              record.ms_played,
              record.spotify_track_uri,
              record.platform
            );
          });
          
          await pool.query(
            `INSERT INTO streaming_history (user_id, ts, track_name, artist_name, album_name, ms_played, spotify_track_uri, platform)
             VALUES ${placeholders.join(', ')}`,
            values
          );
          totalRecords += batch.length;
        }
        fs.unlinkSync(file.path);
      } catch (e) {
        console.error(`Error processing file ${file.originalname}:`, e);
      }
    }
    
    res.json({ success: true, userId, recordsImported: totalRecords });
  } catch (err) {
    console.error('Error uploading data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const results = await pool.query(
      'SELECT id, username, avatar FROM users WHERE username ILIKE $1 LIMIT 10',
      [`%${query}%`]
    );
    res.json(results.rows);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : (isProduction ? 5000 : 3001);

if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

async function start() {
  await initDb();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on http://0.0.0.0:${PORT}`);
  });
  
  // Auto-sync all users from JSON files on startup
  syncAllUsersFromFiles().catch(console.error);
}

start().catch(console.error);
