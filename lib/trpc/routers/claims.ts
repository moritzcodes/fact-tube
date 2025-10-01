import { router, publicProcedure } from '../init';
import { z } from 'zod';
import { claims } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Claims router - handles claim-related operations
 */
export const claimsRouter = router({
  // Get all claims for a video
  getByVideoId: publicProcedure
    .input(z.object({
      videoId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(claims)
        .where(eq(claims.videoId, input.videoId))
        .orderBy(claims.timestamp);
    }),

  // Get a single claim by ID
  getById: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(claims)
        .where(eq(claims.id, input.id))
        .limit(1);
      
      return result[0] || null;
    }),

  // Create a new claim
  create: publicProcedure
    .input(z.object({
      videoId: z.string(),
      claim: z.string(),
      speaker: z.string().optional(),
      timestamp: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(claims)
        .values({
          videoId: input.videoId,
          claim: input.claim,
          speaker: input.speaker,
          timestamp: input.timestamp,
          status: 'pending',
        })
        .returning();
      
      return result[0];
    }),

  // Update claim status and verdict
  updateStatus: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['pending', 'verified', 'false', 'partially_true', 'unverifiable']),
      verdict: z.string().optional(),
      sources: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      
      const result = await ctx.db
        .update(claims)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(claims.id, id))
        .returning();
      
      return result[0];
    }),

  // Get claims by timestamp range (for syncing with video playback)
  getByTimeRange: publicProcedure
    .input(z.object({
      videoId: z.string(),
      startTime: z.number().int().min(0),
      endTime: z.number().int().min(0),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(claims)
        .where(
          and(
            eq(claims.videoId, input.videoId),
            // Note: You'll need to use sql operator for between
            // This is a simplified version
          )
        )
        .orderBy(claims.timestamp);
    }),
});


