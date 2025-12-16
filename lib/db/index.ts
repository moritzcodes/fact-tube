import * as schema from './schema';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';

// Create data directory if it doesn't exist
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const dbPath = path.join(dataDir, 'local.db');
const client = createClient({
  url: `file:${dbPath}`
});

const db = drizzle(client, { schema });

console.log(`📊 Using SQLite database at: ${dbPath}`);

// Auto-migrate SQLite schema on startup
(async () => {
  try {
    // Create tables if they don't exist
    await client.execute(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        channel_name TEXT,
        published_at INTEGER,
        duration INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);
    
    await client.execute(`
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
    `);
    
    await client.execute(`CREATE INDEX IF NOT EXISTS claims_video_id_idx ON claims(video_id);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS claims_video_id_timestamp_idx ON claims(video_id, timestamp);`);
    
    await client.execute(`
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
})();

export { db };
export * from './schema';

