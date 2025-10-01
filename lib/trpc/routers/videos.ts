import { router, publicProcedure } from '../init';
import { z } from 'zod';
import { videos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Videos router - handles video metadata operations
 */
export const videosRouter = router({
  // Get video by YouTube ID
  getById: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(videos)
        .where(eq(videos.id, input.id))
        .limit(1);
      
      return result[0] || null;
    }),

  // Create or update video metadata
  upsert: publicProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      channelName: z.string().optional(),
      publishedAt: z.date().optional(),
      duration: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if video exists
      const existing = await ctx.db
        .select()
        .from(videos)
        .where(eq(videos.id, input.id))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        const result = await ctx.db
          .update(videos)
          .set({
            title: input.title,
            channelName: input.channelName,
            publishedAt: input.publishedAt,
            duration: input.duration,
          })
          .where(eq(videos.id, input.id))
          .returning();
        
        return result[0];
      } else {
        // Insert new
        const result = await ctx.db
          .insert(videos)
          .values({
            id: input.id,
            title: input.title,
            channelName: input.channelName,
            publishedAt: input.publishedAt,
            duration: input.duration,
          })
          .returning();
        
        return result[0];
      }
    }),

  // Get all videos
  getAll: publicProcedure
    .query(async ({ ctx }) => {
      return await ctx.db
        .select()
        .from(videos)
        .orderBy(videos.createdAt);
    }),
});


