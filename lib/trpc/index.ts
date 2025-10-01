import { router } from './init';
import { claimsRouter } from './routers/claims';
import { videosRouter } from './routers/videos';
import { transcriptsRouter } from './routers/transcripts';
import { aiRouter } from './routers/ai';

/**
 * Main tRPC router
 * Combines all sub-routers
 */
export const appRouter = router({
  claims: claimsRouter,
  videos: videosRouter,
  transcripts: transcriptsRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;


