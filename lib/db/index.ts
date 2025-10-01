import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from './schema';
import ws from 'ws';
import { env } from '../env';

// Configure Neon for WebSocket
if (env.NODE_ENV !== 'production') {
  neonConfig.webSocketConstructor = ws;
}

// Create a connection pool
const pool = new Pool({ connectionString: env.DATABASE_URL });

// Create the database instance with schema
export const db = drizzle(pool, { schema });

export * from './schema';

