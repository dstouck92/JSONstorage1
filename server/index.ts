import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import pool, { initDb } from './db';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const isProduction = process.env.NODE_ENV === 'production';
const clientPath = path.join(__dirname, '../client');
if (isProduction) {
  app.use(express.static(clientPath));
}

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

app.get('/api/user/:userId?', async (req, res) => {
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

app.get('/api/artist/:artistName', async (req, res) => {
  try {
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
        isCurrentUser: r.user_id === DEMO_USER_ID
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

app.post('/api/artist/:artistName/comment', async (req, res) => {
  try {
    const artistName = decodeURIComponent(req.params.artistName);
    const { content } = req.body;
    
    const result = await pool.query(
      'INSERT INTO comments (user_id, artist_name, content) VALUES ($1, $2, $3) RETURNING *',
      [DEMO_USER_ID, artistName, content]
    );
    
    const user = await pool.query('SELECT username, avatar FROM users WHERE id = $1', [DEMO_USER_ID]);
    
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

app.post('/api/comment/:commentId/like', async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    
    await pool.query(
      'INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [commentId, DEMO_USER_ID]
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

const PORT = isProduction ? 5000 : 3001;

if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

async function start() {
  await initDb();
  await ensureDemoUser();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on http://0.0.0.0:${PORT}`);
  });
  
  loadDemoData().catch(console.error);
}

start().catch(console.error);
