/**
 * Type-safe environment variables
 * Validates that required environment variables are present
 */

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  
  return value;
}

export const env = {
  DATABASE_URL: getEnv('DATABASE_URL'),
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  VERCEL_URL: process.env.VERCEL_URL,
  OPENROUTER_API_KEY: getEnv('OPENROUTER_API_KEY'), // For claim extraction and fact-checking via Perplexity Sonar
} as const;


