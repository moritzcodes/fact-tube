import { router, publicProcedure } from '../init';
import { z } from 'zod';
import { claims } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { processClaimFactCheck, processAllPendingClaims } from '@/lib/workers/fact-checker';

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
      status: z.enum(['pending', 'verified', 'false', 'disputed', 'inconclusive']),
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

  // Get pending claims for fact-checking
  getPending: publicProcedure
    .query(async ({ ctx }) => {
      return await ctx.db
        .select()
        .from(claims)
        .where(eq(claims.status, 'pending'))
        .orderBy(claims.createdAt);
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

  // Fact-check a single claim
  factCheckClaim: publicProcedure
    .input(z.object({
      claimId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      // Process the claim in the background
      processClaimFactCheck(input.claimId).catch(error => {
        console.error('Background fact-checking error:', error);
      });

      return {
        success: true,
        message: `Claim ${input.claimId} is being fact-checked`,
      };
    }),

  // Fact-check all pending claims
  factCheckAllPending: publicProcedure
    .mutation(async () => {
      // Process all pending claims in the background
      processAllPendingClaims().catch(error => {
        console.error('Background fact-checking error:', error);
      });

      return {
        success: true,
        message: 'Processing all pending claims in the background',
      };
    }),

  // Fact-check all pending claims for a specific video
  factCheckByVideoId: publicProcedure
    .input(z.object({
      videoId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get all pending claims for this video
      const pendingClaims = await ctx.db
        .select()
        .from(claims)
        .where(
          and(
            eq(claims.videoId, input.videoId),
            eq(claims.status, 'pending')
          )
        );

      // Process each claim in the background
      for (const claim of pendingClaims) {
        processClaimFactCheck(claim.id).catch(error => {
          console.error(`Error fact-checking claim ${claim.id}:`, error);
        });
      }

      return {
        success: true,
        message: `Processing ${pendingClaims.length} pending claims for video ${input.videoId}`,
        claimsCount: pendingClaims.length,
      };
    }),
});


