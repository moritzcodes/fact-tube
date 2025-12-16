/**
 * Type-safe environment variables
 * All variables are now optional to support local development
 */

export const env = {
  DATABASE_URL: process.env.DATABASE_URL, // Optional - uses SQLite if not provided
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  VERCEL_URL: process.env.VERCEL_URL,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY, // Optional - users can provide their own via extension settings
} as const;


