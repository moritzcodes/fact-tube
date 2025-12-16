import * as schema from './schema';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import Database from 'better-sqlite3';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import path from 'path';
import fs from 'fs';

// Conditional database setup based on environment
const DATABASE_URL = process.env.DATABASE_URL;

let db: ReturnType<typeof drizzleSqlite> | ReturnType<typeof drizzleNeon>;

if (DATABASE_URL) {
  // Use Neon/Postgres if DATABASE_URL is provided
  // Configure Neon for WebSocket
  if (process.env.NODE_ENV !== 'production') {
    neonConfig.webSocketConstructor = ws;
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzleNeon(pool, { schema }) as any;
  
  console.log('📊 Using Postgres/Neon database');
} else {
  // Use SQLite by default for local development
  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'local.db');
  const sqlite = new Database(dbPath);
  db = drizzleSqlite(sqlite, { schema }) as any;
  
  console.log(`📊 Using SQLite database at: ${dbPath}`);
  
  // Auto-migrate SQLite schema on startup
  try {
    // Create tables if they don't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        channel_name TEXT,
        published_at INTEGER,
        duration INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        video_id TEXT NOT NULL,
        claim TEXT NOT NULL,
        speaker TEXT,
        timestamp INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        verdict TEXT,
        sources TEXT,
        source_bias TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS claims_video_id_idx ON claims(video_id);
      CREATE INDEX IF NOT EXISTS claims_video_id_timestamp_idx ON claims(video_id, timestamp);

      CREATE TABLE IF NOT EXISTS transcript_segments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        video_id TEXT NOT NULL,
        text TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        processed INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
      );
    `);
    console.log('✅ SQLite tables initialized');
  } catch (error) {
    console.error('Failed to initialize SQLite tables:', error);
  }
}

export { db };
export * from './schema';

