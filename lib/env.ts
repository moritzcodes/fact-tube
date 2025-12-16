/**
 * Type-safe environment variables
 * All variables are optional to support local development
 */

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  VERCEL_URL: process.env.VERCEL_URL,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY, // Optional - users can provide their own via extension settings
} as const;


