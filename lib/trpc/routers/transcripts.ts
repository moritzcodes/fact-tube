import { router, publicProcedure } from '../init';
import { z } from 'zod';
import { transcriptSegments } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { Innertube } from 'youtubei.js';
import { YoutubeTranscript } from 'youtube-transcript';
import { getSubtitles } from 'youtube-caption-extractor';

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
        console.log(`\n🎬 Fetching transcript for video: ${videoId}${input.lang ? `, lang: ${input.lang}` : ' (auto-detect)'}`);
        
        // Method 1: youtube-caption-extractor (most reliable, actively maintained)
        try {
          console.log('📝 Method 1: Trying youtube-caption-extractor...');
          const subtitles = await getSubtitles({ videoID: videoId, lang: input.lang || 'en' });

          if (!subtitles || subtitles.length === 0) {
            throw new Error('No captions returned from youtube-caption-extractor');
          }

          // Map to our segment format
          const segments = subtitles.map((item: { start: string; dur: string; text: string }) => ({
            start: parseFloat(item.start),
            text: item.text,
          })).filter((seg: { start: number; text: string }) => seg.text.trim());

          console.log(`✅ SUCCESS! Fetched ${segments.length} segments using youtube-caption-extractor`);

          return {
            videoId,
            lang: input.lang || 'default',
            segments,
            totalSegments: segments.length,
          };
        } catch (captionExtractorError) {
          const errorMsg = captionExtractorError instanceof Error ? captionExtractorError.message : String(captionExtractorError);
          console.log(`❌ youtube-caption-extractor failed: ${errorMsg}`);
          
          // If the video genuinely has no captions, don't try other methods
          if (errorMsg.includes('Could not find captions') || errorMsg.includes('No captions')) {
            throw new Error('This video does not have captions/subtitles available. Please try a video with captions enabled.');
          }
        }

        // Method 2: youtube-transcript (fallback)
        try {
          console.log('📝 Method 2: Trying youtube-transcript...');
          const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
            lang: input.lang || 'en',
          });

          if (!transcriptItems || transcriptItems.length === 0) {
            throw new Error('youtube-transcript returned empty array');
          }

          // Map to our segment format
          const segments = transcriptItems.map((item: { offset: number; text: string }) => ({
            start: item.offset / 1000, // Convert milliseconds to seconds
            text: item.text,
          })).filter((seg: { start: number; text: string }) => seg.text.trim());

          console.log(`✅ SUCCESS! Fetched ${segments.length} segments using youtube-transcript`);

          return {
            videoId,
            lang: input.lang || 'default',
            segments,
            totalSegments: segments.length,
          };
        } catch (transcriptLibError) {
          const errorMsg = transcriptLibError instanceof Error ? transcriptLibError.message : String(transcriptLibError);
          console.log(`❌ youtube-transcript failed: ${errorMsg}`);
        }

        // Method 3: youtubei.js (last resort)
        console.log('📝 Method 3: Trying youtubei.js (last resort)...');
        
        // Create Innertube instance with optional language preference
        const innertubeOptions: { lang?: string; fetch?: typeof fetch } = {};

        // Only set language if explicitly provided
        if (input.lang) {
          innertubeOptions.lang = input.lang;
        }

        // Add custom headers and proxy if available
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
        const info = await innertube.getInfo(videoId);
        
        if (!info) {
          throw new Error('Video not found or unavailable');
        }

        const transcriptData = await info.getTranscript();
        
        if (!transcriptData || !transcriptData.transcript) {
          throw new Error('No transcript available for this video');
        }

        const transcript = transcriptData.transcript;
        const segments = transcript.content?.body?.initial_segments?.map((segment: { start_ms?: string | number; snippet?: { text?: string } }) => {
          const startMs = typeof segment.start_ms === 'string' ? parseFloat(segment.start_ms) || 0 : segment.start_ms || 0;
          return {
            start: startMs / 1000,
            text: segment.snippet?.text || '',
          };
        }).filter((seg: { start: number; text: string }) => seg.text.trim()) || [];

        if (segments.length === 0) {
          throw new Error('No transcript segments found for this video');
        }

        console.log(`✅ SUCCESS! Fetched ${segments.length} segments using youtubei.js`);

        return {
          videoId,
          lang: input.lang || 'default',
          segments,
          totalSegments: segments.length,
        };
      } catch (err) {
        console.error('\n❌ ALL METHODS FAILED to fetch transcript');
        console.error('Error:', err instanceof Error ? err.message : err);
        if (err instanceof Error && err.stack) {
          console.error('Stack trace:', err.stack.split('\n').slice(0, 5).join('\n'));
        }
        
        // Provide more helpful error messages based on the error type
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        if (errorMessage.includes('does not have captions')) {
          throw err; // Pass through our custom error message
        } else if (errorMessage.includes('No captions') || errorMessage.includes('No transcript available')) {
          throw new Error('This video does not have captions/subtitles available. Please enable captions on YouTube or try a different video.');
        } else if (errorMessage.includes('disabled')) {
          throw new Error('Captions are disabled for this video');
        } else if (errorMessage.includes('unavailable') || errorMessage.includes('not found')) {
          throw new Error('Video is unavailable or does not exist');
        } else if (errorMessage.includes('Precondition check failed')) {
          throw new Error('Unable to access YouTube transcript API. The video may have restricted access or captions may not be available.');
        }

        throw new Error(`Failed to fetch transcript: ${errorMessage}`);
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
      } catch (err) {
        console.error('Error fetching video metadata:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch video metadata';
        throw new Error(errorMessage);
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


