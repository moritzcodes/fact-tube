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
      videoContext: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        channelName: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Prepare the transcript text with timestamps
        const transcriptText = input.segments
          .map(seg => `[${Math.floor(seg.start)}s] ${seg.text}`)
          .join('\n');

        // Prepare video context if provided
        let contextMessage = '';
        if (input.videoContext) {
          contextMessage = `\n\nVIDEO CONTEXT:`;
          if (input.videoContext.title) {
            contextMessage += `\nTitle: ${input.videoContext.title}`;
          }
          if (input.videoContext.channelName) {
            contextMessage += `\nChannel: ${input.videoContext.channelName}`;
          }
          if (input.videoContext.description) {
            contextMessage += `\nDescription: ${input.videoContext.description.slice(0, 500)}${input.videoContext.description.length > 500 ? '...' : ''}`;
          }
          contextMessage += '\n\n';
        }

        // Call OpenRouter with GPT-4o-mini
        const response = await openai.chat.completions.create({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a precise fact-checking assistant. Extract ONLY the most important, fact-checkable claims from video transcripts.

STRICT CRITERIA - A claim must be:
1. ✅ A specific, objective statement with measurable data (numbers, dates, statistics, events)
2. ✅ Verifiable through credible sources (not subjective opinions)
3. ✅ Significant and impactful (not trivial facts or common knowledge)
4. ✅ A clear assertion (not vague or ambiguous statements)

❌ DO NOT extract:
- Opinions, predictions, or subjective statements ("I think", "probably", "maybe")
- Questions or rhetorical statements
- Common knowledge or widely-known facts
- Vague statements without specific data
- Personal anecdotes or stories
- Promotional content or advertisements
- Greetings, acknowledgments, or filler content

✅ GOOD EXAMPLES:
- "The unemployment rate dropped to 3.7% in October 2023"
- "Tesla sold 1.8 million vehicles in 2023"
- "The new law will cut corporate taxes from 35% to 21%"

❌ BAD EXAMPLES:
- "The economy is doing great" (opinion, vague)
- "I believe climate change is real" (opinion)
- "Today we're going to talk about..." (not a claim)
- "This is the best product ever" (subjective)

Output valid JSON:
{
  "claims": [
    {
      "claim": "The exact factual claim with specific data",
      "speaker": "Speaker name or 'Unknown'",
      "timestamp": 123
    }
  ]
}

Be HIGHLY SELECTIVE. Only extract 1-3 claims per minute of content, and only if they meet ALL criteria.
If no significant fact-checkable claims exist, return: {"claims": []}`,
            },
            {
              role: 'user',
              content: `Extract ONLY the most important fact-checkable claims from this transcript segment:${contextMessage}\n${transcriptText}`,
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
      videoContext: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        channelName: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = [];
      
      for (const chunk of input.segmentChunks) {
        try {
          const transcriptText = chunk
            .map(seg => `[${Math.floor(seg.start)}s] ${seg.text}`)
            .join('\n');

          // Prepare video context if provided
          let contextMessage = '';
          if (input.videoContext) {
            contextMessage = `\n\nVIDEO CONTEXT:`;
            if (input.videoContext.title) {
              contextMessage += `\nTitle: ${input.videoContext.title}`;
            }
            if (input.videoContext.channelName) {
              contextMessage += `\nChannel: ${input.videoContext.channelName}`;
            }
            if (input.videoContext.description) {
              contextMessage += `\nDescription: ${input.videoContext.description.slice(0, 500)}${input.videoContext.description.length > 500 ? '...' : ''}`;
            }
            contextMessage += '\n\n';
          }

          const response = await openai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a precise fact-checking assistant. Extract ONLY the most important, fact-checkable claims from video transcripts.

STRICT CRITERIA - A claim must be:
1. ✅ A specific, objective statement with measurable data (numbers, dates, statistics, events)
2. ✅ Verifiable through credible sources (not subjective opinions)
3. ✅ Significant and impactful (not trivial facts or common knowledge)
4. ✅ A clear assertion (not vague or ambiguous statements)

❌ DO NOT extract:
- Opinions, predictions, or subjective statements ("I think", "probably", "maybe")
- Questions or rhetorical statements
- Common knowledge or widely-known facts
- Vague statements without specific data
- Personal anecdotes or stories
- Promotional content or advertisements
- Greetings, acknowledgments, or filler content

✅ GOOD EXAMPLES:
- "The unemployment rate dropped to 3.7% in October 2023"
- "Tesla sold 1.8 million vehicles in 2023"
- "The new law will cut corporate taxes from 35% to 21%"

❌ BAD EXAMPLES:
- "The economy is doing great" (opinion, vague)
- "I believe climate change is real" (opinion)
- "Today we're going to talk about..." (not a claim)
- "This is the best product ever" (subjective)

Output valid JSON:
{
  "claims": [
    {
      "claim": "The exact factual claim with specific data",
      "speaker": "Speaker name or 'Unknown'",
      "timestamp": 123
    }
  ]
}

Be HIGHLY SELECTIVE. Only extract 1-3 claims per minute of content, and only if they meet ALL criteria.
If no significant fact-checkable claims exist, return: {"claims": []}`,
              },
              {
                role: 'user',
                content: `Extract ONLY the most important fact-checkable claims from this transcript segment:${contextMessage}\n${transcriptText}`,
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


