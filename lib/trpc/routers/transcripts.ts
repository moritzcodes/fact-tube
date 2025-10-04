import { router, publicProcedure } from '../init';
import { z } from 'zod';
import { transcriptSegments } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { Innertube } from 'youtubei.js';

// Extract video ID from YouTube URL or accept raw ID
function extractVideoId(input: string): string | null {
  // Raw 11-char IDs
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const u = new URL(input);
    // youtu.be/VIDEO_ID
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return id;
    }
    // youtube.com/watch?v=VIDEO_ID
    const v = u.searchParams.get('v');
    if (v) return v;

    // Shorts: youtube.com/shorts/VIDEO_ID
    const parts = u.pathname.split('/').filter(Boolean);
    const shortsIdx = parts.indexOf('shorts');
    if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
  } catch {
    // Not a URL
  }

  return null;
}

/**
 * Transcripts router - handles transcript segment operations
 */
export const transcriptsRouter = router({
  // Fetch transcript from YouTube using YouTube.js (youtubei.js)
  fetchFromYouTube: publicProcedure
    .input(z.object({
      videoId: z.string(),
      lang: z.string().optional(), // Optional language preference, will use video's default language if not specified
    }))
    .query(async ({ input }) => {
      const videoId = extractVideoId(input.videoId);
      
      if (!videoId) {
        throw new Error('Invalid YouTube video ID or URL');
      }

      try {
        console.log(`Attempting to fetch transcript for video: ${videoId}${input.lang ? `, lang: ${input.lang}` : ' (default language)'}`);
        
        // Create Innertube instance with optional language preference and proxy
        const innertubeOptions: any = {};

        // Only set language if explicitly provided, otherwise use video's default language
        if (input.lang) {
          innertubeOptions.lang = input.lang;
        }

        // Add proxy configuration if available via environment variables
        if (process.env.YOUTUBE_PROXY_URL) {
          innertubeOptions.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const proxyUrl = process.env.YOUTUBE_PROXY_URL;
            const url = typeof input === 'string' ? input : input.toString();
            
            return fetch(`${proxyUrl}?url=${encodeURIComponent(url)}`, {
              ...init,
              headers: {
                ...init?.headers,
                'User-Agent': process.env.YOUTUBE_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });
          };
        }

        const innertube = await Innertube.create(innertubeOptions);

        // Get video info
        const info = await innertube.getInfo(videoId);
        
        if (!info) {
          throw new Error('Video not found or unavailable');
        }

        // Get transcript
        const transcriptData = await info.getTranscript();
        
        if (!transcriptData || !transcriptData.transcript) {
          throw new Error('No transcript available for this video');
        }

        const transcript = transcriptData.transcript;
        console.log(`Transcript data received, segments: ${transcript.content?.body?.initial_segments?.length || 0}`);

        // Extract segments from the transcript
        // Using simplified structure: only start and text (Option 2 - token efficient)
        const segments = transcript.content?.body?.initial_segments?.map((segment: any) => {
          const startMs = segment.start_ms || 0;

          return {
            start: startMs / 1000, // Convert milliseconds to seconds
            text: segment.snippet?.text || '',
          };
        }).filter((seg: any) => seg.text.trim()) || [];

        console.log(`Successfully processed ${segments.length} segments`);

        if (segments.length === 0) {
          throw new Error('No transcript segments found for this video');
        }

        return {
          videoId,
          lang: input.lang || 'default', // 'default' means video's original language
          segments,
          totalSegments: segments.length,
        };
      } catch (err: any) {
        console.error('Error fetching transcript:', err);
        console.error('Error stack:', err.stack);
        
        // Provide more helpful error messages
        if (err.message?.includes('No transcript available')) {
          throw new Error('No captions/subtitles available for this video. The video may not have captions enabled.');
        } else if (err.message?.includes('disabled')) {
          throw new Error('Captions are disabled for this video');
        } else if (err.message?.includes('unavailable') || err.message?.includes('not found')) {
          throw new Error('Video is unavailable or does not exist');
        } else if (err.message?.includes('TranscriptError')) {
          throw new Error('This video does not have captions/subtitles available. Try a different video.');
        }
        
        throw new Error(err?.message || 'Failed to fetch transcript');
      }
    }),

  // Fetch video metadata (title, description, etc.)
  getVideoMetadata: publicProcedure
    .input(z.object({
      videoId: z.string(),
    }))
    .query(async ({ input }) => {
      const videoId = extractVideoId(input.videoId);
      
      if (!videoId) {
        throw new Error('Invalid YouTube video ID or URL');
      }

      try {
        const innertube = await Innertube.create();
        const info = await innertube.getInfo(videoId);
        
        if (!info) {
          throw new Error('Video not found or unavailable');
        }

        const basic = info.basic_info;
        
        return {
          videoId,
          title: basic.title || 'Unknown',
          description: basic.short_description || '',
          channelName: basic.channel?.name || basic.author || 'Unknown',
          duration: basic.duration || 0,
          viewCount: basic.view_count || 0,
        };
      } catch (err: any) {
        console.error('Error fetching video metadata:', err);
        throw new Error(err?.message || 'Failed to fetch video metadata');
      }
    }),

  // Create a transcript segment
  create: publicProcedure
    .input(z.object({
      videoId: z.string(),
      text: z.string(),
      startTime: z.number().int().min(0),
      endTime: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(transcriptSegments)
        .values({
          videoId: input.videoId,
          text: input.text,
          startTime: input.startTime,
          endTime: input.endTime,
        })
        .returning();
      
      return result[0];
    }),

  // Mark segment as processed
  markProcessed: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(transcriptSegments)
        .set({
          processed: new Date(),
        })
        .where(eq(transcriptSegments.id, input.id))
        .returning();
      
      return result[0];
    }),

  // Get unprocessed segments for a video
  getUnprocessed: publicProcedure
    .input(z.object({
      videoId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(transcriptSegments)
        .where(
          and(
            eq(transcriptSegments.videoId, input.videoId),
            isNull(transcriptSegments.processed)
          )
        )
        .orderBy(transcriptSegments.startTime);
    }),

  // Get all segments for a video
  getByVideoId: publicProcedure
    .input(z.object({
      videoId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(transcriptSegments)
        .where(eq(transcriptSegments.videoId, input.videoId))
        .orderBy(transcriptSegments.startTime);
    }),

  // Save transcript segments to database
  saveSegments: publicProcedure
    .input(z.object({
      videoId: z.string(),
      segments: z.array(z.object({
        start: z.number(),
        text: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create segments with end time calculated from next segment or +5 seconds
      const segmentsToInsert = input.segments.map((seg, idx) => ({
        videoId: input.videoId,
        text: seg.text,
        startTime: Math.floor(seg.start),
        endTime: Math.floor(input.segments[idx + 1]?.start || (seg.start + 5)),
      }));

      // Check if segments already exist for this video
      const existing = await ctx.db
        .select()
        .from(transcriptSegments)
        .where(eq(transcriptSegments.videoId, input.videoId))
        .limit(1);

      if (existing.length > 0) {
        // Segments already exist, don't duplicate
        return { success: true, message: 'Segments already exist', count: 0 };
      }

      // Insert segments
      const result = await ctx.db
        .insert(transcriptSegments)
        .values(segmentsToInsert)
        .returning();

      return { success: true, message: 'Segments saved', count: result.length };
    }),
});


