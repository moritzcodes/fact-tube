import { router, publicProcedure } from '../init';
import { z } from 'zod';
import { env } from '@/lib/env';
import OpenAI from 'openai';
import { claims } from '@/lib/db/schema';

/**
 * OpenRouter client configured with GPT-4o-mini
 */
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://fact-tube.app', // Replace with your actual domain
    'X-Title': 'FactTube',
  },
});

/**
 * AI processing router - handles claim extraction from transcript segments
 */
export const aiRouter = router({
  // Extract claims from a single transcript segment
  extractClaims: publicProcedure
    .input(z.object({
      videoId: z.string(),
      segments: z.array(z.object({
        start: z.number(),
        text: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Prepare the transcript text with timestamps
        const transcriptText = input.segments
          .map(seg => `[${Math.floor(seg.start)}s] ${seg.text}`)
          .join('\n');

        // Call OpenRouter with GPT-4o-mini
        const response = await openai.chat.completions.create({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a fact-checking assistant. Extract factual claims from video transcripts.
              
For each claim, provide:
1. The exact claim statement
2. The speaker (if identifiable from context)
3. The timestamp in seconds (use the timestamp markers in the transcript)

Output valid JSON in this format:
{
  "claims": [
    {
      "claim": "The exact factual claim",
      "speaker": "Speaker name or 'Unknown'",
      "timestamp": 123
    }
  ]
}

Only extract claims that are:
- Factual statements (not opinions or questions)
- Verifiable (can be fact-checked)
- Specific (not vague or general statements)

If no claims are found, return: {"claims": []}`,
            },
            {
              role: 'user',
              content: `Extract claims from this transcript segment:\n\n${transcriptText}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from AI');
        }

        const parsed = JSON.parse(content);
        const extractedClaims = parsed.claims || [];

        // Save claims to database
        const savedClaims = [];
        for (const claim of extractedClaims) {
          const result = await ctx.db
            .insert(claims)
            .values({
              videoId: input.videoId,
              claim: claim.claim,
              speaker: claim.speaker || 'Unknown',
              timestamp: claim.timestamp,
              status: 'pending',
            })
            .returning();
          
          savedClaims.push(result[0]);
        }

        return {
          success: true,
          claimsExtracted: savedClaims.length,
          claims: savedClaims,
        };
      } catch (error) {
        console.error('Error extracting claims:', error);
        throw new Error(`Failed to extract claims: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // Batch process multiple segments
  extractClaimsBatch: publicProcedure
    .input(z.object({
      videoId: z.string(),
      segmentChunks: z.array(z.array(z.object({
        start: z.number(),
        text: z.string(),
      }))),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = [];
      
      for (const chunk of input.segmentChunks) {
        try {
          const transcriptText = chunk
            .map(seg => `[${Math.floor(seg.start)}s] ${seg.text}`)
            .join('\n');

          const response = await openai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a fact-checking assistant. Extract factual claims from video transcripts.
                
For each claim, provide:
1. The exact claim statement
2. The speaker (if identifiable from context)
3. The timestamp in seconds (use the timestamp markers in the transcript)

Output valid JSON in this format:
{
  "claims": [
    {
      "claim": "The exact factual claim",
      "speaker": "Speaker name or 'Unknown'",
      "timestamp": 123
    }
  ]
}

Only extract claims that are:
- Factual statements (not opinions or questions)
- Verifiable (can be fact-checked)
- Specific (not vague or general statements)

If no claims are found, return: {"claims": []}`,
              },
              {
                role: 'user',
                content: `Extract claims from this transcript segment:\n\n${transcriptText}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: 'json_object' },
          });

          const content = response.choices[0]?.message?.content;
          if (!content) {
            continue;
          }

          const parsed = JSON.parse(content);
          const extractedClaims = parsed.claims || [];

          // Save claims to database
          for (const claim of extractedClaims) {
            const result = await ctx.db
              .insert(claims)
              .values({
                videoId: input.videoId,
                claim: claim.claim,
                speaker: claim.speaker || 'Unknown',
                timestamp: claim.timestamp,
                status: 'pending',
              })
              .returning();
            
            results.push(result[0]);
          }
        } catch (error) {
          console.error('Error processing chunk:', error);
          // Continue with next chunk even if one fails
        }
      }

      return {
        success: true,
        totalClaims: results.length,
        claims: results,
      };
    }),
});


