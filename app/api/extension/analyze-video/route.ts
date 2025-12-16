import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { videos, claims } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Innertube } from 'youtubei.js';
import { YoutubeTranscript } from 'youtube-transcript';
import { getSubtitles } from 'youtube-caption-extractor';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import { processClaimFactCheck } from '@/lib/workers/fact-checker';

/**
 * Simplified Chrome Extension endpoint
 * Takes a video ID and handles everything server-side:
 * 1. Fetch transcript using youtubei.js
 * 2. Extract claims using AI
 * 3. Trigger fact-checking
 * 4. Return results
 */

// CORS headers for Chrome Extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-OpenRouter-API-Key, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get API key from header or environment variable
    const customApiKey = request.headers.get('X-OpenRouter-API-Key');
    const apiKey = customApiKey || env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is required. Please configure it in the extension settings.' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Create OpenAI client with the appropriate API key
    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://fact-tube.app',
        'X-Title': 'FactTube',
      },
    });

    console.log(`📹 Starting analysis for video: ${videoId}`);

    // Check if we already have claims for this video
    const existingClaims = await db
      .select()
      .from(claims)
      .where(eq(claims.videoId, videoId))
      .orderBy(claims.timestamp);

    if (existingClaims.length > 0) {
      console.log(`✅ Found ${existingClaims.length} existing claims for video ${videoId}`);
      
      const videoData = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      // Return flat list of claims - frontend will handle visual grouping
      console.log(`📤 Returning ${existingClaims.length} cached claims (frontend will handle grouping)`);

      return NextResponse.json({
        success: true,
        cached: true,
        videoId,
        title: videoData[0]?.title || '',
        totalClaims: existingClaims.length,
        claims: existingClaims.map(claim => ({
          id: claim.id,
          claim: claim.claim,
          speaker: claim.speaker || 'Unknown',
          timestamp: claim.timestamp,
          status: claim.status,
          verdict: claim.verdict || '',
          sources: claim.sources ? JSON.parse(claim.sources) : [],
          sourceBias: claim.sourceBias ? JSON.parse(claim.sourceBias) : null,
        })),
      }, { headers: corsHeaders });
    }

    // Step 1: Fetch transcript using multiple strategies (same as tRPC route)
    console.log(`\n🎬 Fetching transcript for video: ${videoId}`);
    let segments: Array<{ start: number; text: string }> = [];
    let videoTitle = 'Unknown';
    let channelName = 'Unknown';
    
    // Method 1: youtube-caption-extractor (most reliable, actively maintained)
    try {
      console.log('📝 Method 1: Trying youtube-caption-extractor...');
      const subtitles = await getSubtitles({ videoID: videoId, lang: 'en' });

      if (!subtitles || subtitles.length === 0) {
        throw new Error('No captions returned from youtube-caption-extractor');
      }

      // Map to our segment format
      segments = subtitles.map((item: { start: string; dur: string; text: string }) => ({
        start: parseFloat(item.start),
        text: item.text,
      })).filter((seg: { start: number; text: string }) => seg.text.trim());

      console.log(`✅ SUCCESS! Fetched ${segments.length} segments using youtube-caption-extractor`);

      // Try to get video metadata from youtubei.js for title/channel
      try {
        const innertube = await Innertube.create();
        const info = await innertube.getInfo(videoId);
        if (info) {
          videoTitle = info.basic_info.title || 'Unknown';
          channelName = info.basic_info.channel?.name || info.basic_info.author || 'Unknown';
        }
      } catch (metaError) {
        console.warn('⚠️ Could not fetch video metadata:', metaError);
        // Continue without metadata - we have the transcript which is most important
      }
    } catch (captionExtractorError) {
      const errorMsg = captionExtractorError instanceof Error ? captionExtractorError.message : String(captionExtractorError);
      console.log(`❌ youtube-caption-extractor failed: ${errorMsg}`);
      
      // If the video genuinely has no captions, don't try other methods
      if (errorMsg.includes('Could not find captions') || errorMsg.includes('No captions')) {
        console.error('Video has no captions available');
        return NextResponse.json(
          {
            error: 'No captions available',
            message: 'This video does not have captions/subtitles available. Please try a video with captions enabled.',
            videoId,
          },
          { status: 400, headers: corsHeaders }
        );
      }

      // Method 2: youtube-transcript (fallback)
      try {
        console.log('📝 Method 2: Trying youtube-transcript...');
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
        
        if (!transcriptItems || transcriptItems.length === 0) {
          throw new Error('youtube-transcript returned empty array');
        }
        
        segments = transcriptItems.map((item: any) => ({
          start: item.offset / 1000, // Convert ms to seconds
          text: item.text,
        }));
        
        console.log(`✅ SUCCESS! Fetched ${segments.length} segments using youtube-transcript`);
        
        // Try to get video metadata
        try {
          const innertube = await Innertube.create();
          const info = await innertube.getInfo(videoId);
          if (info) {
            videoTitle = info.basic_info.title || 'Unknown';
            channelName = info.basic_info.channel?.name || info.basic_info.author || 'Unknown';
          }
        } catch (metaError) {
          console.warn('⚠️ Could not fetch video metadata:', metaError);
        }
      } catch (transcriptLibError) {
        const errorMsg2 = transcriptLibError instanceof Error ? transcriptLibError.message : String(transcriptLibError);
        console.log(`❌ youtube-transcript failed: ${errorMsg2}`);
        
        // Method 3: youtubei.js (last resort)
        let lastError: Error | null = null;
        const clientStrategies = ['WEB', 'ANDROID', 'IOS'];
        
        for (const clientType of clientStrategies) {
          try {
            console.log(`📝 Method 3: Trying youtubei.js with ${clientType} client...`);
            
            const innertube = await Innertube.create({
              client_type: clientType as any,
              retrieve_player: clientType === 'WEB',
            });
            
            const info = await innertube.getInfo(videoId);
            
            if (!info) {
              throw new Error('Video not found or unavailable');
            }

            const transcriptData = await info.getTranscript();
            
            if (!transcriptData || !transcriptData.transcript) {
              throw new Error('No transcript available for this video');
            }

            // Extract segments
            segments = transcriptData.transcript.content?.body?.initial_segments?.map((segment: any) => ({
              start: (typeof segment.start_ms === 'string' ? parseFloat(segment.start_ms) || 0 : segment.start_ms || 0) / 1000,
              text: segment.snippet?.text || '',
            })).filter((seg: { start: number; text: string }) => seg.text.trim()) || [];
            
            // Get metadata
            videoTitle = info.basic_info.title || 'Unknown';
            channelName = info.basic_info.channel?.name || info.basic_info.author || 'Unknown';
            
            console.log(`✅ SUCCESS! Fetched ${segments.length} segments using youtubei.js ${clientType} client`);
            break; // Success, exit loop
          } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error');
            console.error(`❌ youtubei.js ${clientType} failed:`, lastError.message);
          }
        }
        
        // If all methods failed, return error
        if (segments.length === 0) {
          console.error('\n❌ ALL METHODS FAILED to fetch transcript');
          console.error('Last error:', lastError);
          
          const errorMessage = lastError?.message || 'Failed to fetch transcript';
          let userMessage = 'Could not fetch transcript for this video. ';
          
          if (errorMessage.includes('Precondition check failed')) {
            userMessage += 'YouTube is temporarily blocking transcript requests. Please try again later or verify the video has captions enabled.';
          } else if (errorMessage.includes('No transcript')) {
            userMessage += 'This video does not have captions/subtitles enabled.';
          } else if (errorMessage.includes('not found') || errorMessage.includes('NOT_FOUND')) {
            userMessage += 'This video could not be found or is unavailable.';
          } else {
            userMessage += errorMessage;
          }
          
          console.error('Returning error:', userMessage);
          
          return NextResponse.json(
            {
              error: 'Failed to fetch transcript',
              message: userMessage,
              videoId,
            },
            { status: 400, headers: corsHeaders }
          );
        }
      }
    }
    
    // Validate we have transcript data
    if (segments.length === 0) {
      console.error('❌ No segments found after all strategies');
      return NextResponse.json(
        { error: 'No transcript segments found for this video' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`✅ Total segments fetched: ${segments.length}`);

    // Save video metadata
    try {
      await db.insert(videos).values({
        id: videoId,
        title: videoTitle,
        channelName: channelName,
      }).onConflictDoUpdate({
        target: videos.id,
        set: {
          title: videoTitle,
          channelName: channelName,
        },
      });
    } catch (error) {
      console.error('Error saving video metadata:', error);
    }

    // Step 2: Process transcript in chunks and extract claims
    console.log('🤖 Extracting claims from transcript...');
    const chunkSize = 60; // seconds
    const chunks = chunkTranscriptSegments(segments, chunkSize);
    console.log(`📦 Split into ${chunks.length} chunks`);

    const allClaims = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`📤 Processing chunk ${i + 1}/${chunks.length}`);

      const transcriptText = chunk
        .map((seg: { start: number; text: string }) => `[${Math.floor(seg.start)}s] ${seg.text}`)
        .join('\n');

      try {
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
              content: `Extract ONLY the most important fact-checkable claims from this transcript segment:\nTitle: ${videoTitle}\nChannel: ${channelName}\n\n${transcriptText}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const extractedClaims = parsed.claims || [];

          // Save claims to database (with duplicate check)
          for (const claim of extractedClaims) {
            // Check if this claim already exists for this video
            const existingClaim = await db
              .select()
              .from(claims)
              .where(
                and(
                  eq(claims.videoId, videoId),
                  eq(claims.claim, claim.claim)
                )
              )
              .limit(1);

            // Skip if duplicate claim already exists
            if (existingClaim.length > 0) {
              console.log(`⏭️  Skipping duplicate claim: "${claim.claim}"`);
              continue;
            }

            const result = await db
              .insert(claims)
              .values({
                videoId: videoId,
                claim: claim.claim,
                speaker: claim.speaker || 'Unknown',
                timestamp: claim.timestamp,
                status: 'pending',
              })
              .returning();

            allClaims.push(result[0]);

            // Trigger fact-checking in background
            processClaimFactCheck(result[0].id, apiKey).catch((error) => {
              console.error(`Error triggering fact-check for claim ${result[0].id}:`, error);
            });
          }

          console.log(`✅ Chunk ${i + 1}: ${extractedClaims.length} claims extracted`);
        }
      } catch (error) {
        console.error(`❌ Error processing chunk ${i + 1}:`, error);
      }

      // Small delay between chunks
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`🎉 Processing complete! Extracted ${allClaims.length} new claims in this run`);

    // IMPORTANT: Fetch ALL claims from database (not just from this run)
    // This ensures we return everything even if the user refreshed during processing
    const allClaimsFromDb = await db
      .select()
      .from(claims)
      .where(eq(claims.videoId, videoId))
      .orderBy(claims.timestamp);

    console.log(`📊 Total claims in database for this video: ${allClaimsFromDb.length}`);

    // Return flat list of claims - frontend will handle visual grouping
    console.log(`📤 Returning ${allClaimsFromDb.length} claims (frontend will handle grouping)`);

    return NextResponse.json({
      success: true,
      cached: false,
      videoId,
      title: videoTitle,
      channelName,
      totalClaims: allClaimsFromDb.length,
      claims: allClaimsFromDb.map(claim => ({
        id: claim.id,
        claim: claim.claim,
        speaker: claim.speaker,
        timestamp: claim.timestamp,
        status: claim.status,
        verdict: claim.verdict || '',
        sources: claim.sources ? JSON.parse(claim.sources) : [],
        sourceBias: claim.sourceBias ? JSON.parse(claim.sourceBias) : null,
      })),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error analyzing video:', error);
    return NextResponse.json(
      { error: 'Failed to analyze video' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Chunk transcript segments into time-based chunks
 */
function chunkTranscriptSegments(segments: Array<{ start: number; text: string }>, chunkDuration: number) {
  const chunks: Array<Array<{ start: number; text: string }>> = [];
  let currentChunk: Array<{ start: number; text: string }> = [];
  let chunkStartTime = 0;

  for (const segment of segments) {
    if (segment.start - chunkStartTime >= chunkDuration && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      chunkStartTime = segment.start;
    }
    currentChunk.push(segment);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

