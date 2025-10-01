import { router } from './init';
import { claimsRouter } from './routers/claims';
import { videosRouter } from './routers/videos';
import { transcriptsRouter } from './routers/transcripts';

/**
 * Main tRPC router
 * Combines all sub-routers
 */
export const appRouter = router({
  claims: claimsRouter,
  videos: videosRouter,
  transcripts: transcriptsRouter,
});

export type AppRouter = typeof appRouter;


