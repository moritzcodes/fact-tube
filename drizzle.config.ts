import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Use SQLite by default, PostgreSQL if DATABASE_URL is provided
const isPostgres = !!process.env.DATABASE_URL;

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: isPostgres ? 'postgresql' : 'sqlite',
  dbCredentials: isPostgres 
    ? { url: process.env.DATABASE_URL! }
    : { url: './data/local.db' },
  verbose: true,
  strict: true,
});

