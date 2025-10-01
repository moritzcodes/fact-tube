import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { db } from '@/lib/db';

/**
 * Creates context for tRPC procedures
 * Add user authentication here when needed
 */
export async function createContext(opts?: FetchCreateContextFnOptions) {
  return {
    db,
    headers: opts?.req.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;


