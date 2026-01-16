import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      spotify_id VARCHAR(255),
      spotify_connected BOOLEAN DEFAULT FALSE,
      avatar VARCHAR(50) DEFAULT 'goat',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS streaming_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ts TIMESTAMP NOT NULL,
      track_name VARCHAR(500),
      artist_name VARCHAR(500),
      album_name VARCHAR(500),
      ms_played INTEGER DEFAULT 0,
      spotify_track_uri VARCHAR(255),
      platform VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      artist_name VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      id SERIAL PRIMARY KEY,
      comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(comment_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_streaming_history_user ON streaming_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_streaming_history_artist ON streaming_history(artist_name);
    CREATE INDEX IF NOT EXISTS idx_comments_artist ON comments(artist_name);
  `);
  console.log('Database initialized');
}

export default pool;
