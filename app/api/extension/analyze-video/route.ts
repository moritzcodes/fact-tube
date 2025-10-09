import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { videos, claims } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Innertube } from 'youtubei.js';
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

    // Step 1: Fetch transcript using youtubei.js
    console.log('🎬 Fetching transcript from YouTube...');
    let transcript;
    let videoInfo;
    
    try {
      const innertube = await Innertube.create();
      videoInfo = await innertube.getInfo(videoId); 
      
      if (!videoInfo) {
        throw new Error('Video not found or unavailable');
      }

      const transcriptData = await videoInfo.getTranscript();
      
      if (!transcriptData || !transcriptData.transcript) {
        throw new Error('No transcript available for this video');
      }

      transcript = transcriptData.transcript;
    } catch (error) {
      console.error('❌ Error fetching transcript:', error);
      const errorMessage = error instanceof Error ? error.message : 'No captions/subtitles available for this video';
      return NextResponse.json(
        {
          error: 'Failed to fetch transcript',
          message: errorMessage,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Extract segments
        const segments = transcript.content?.body?.initial_segments?.map((segment: { start_ms?: string | number; snippet?: { text?: string } }) => ({
          start: (typeof segment.start_ms === 'string' ? parseFloat(segment.start_ms) || 0 : segment.start_ms || 0) / 1000,
          text: segment.snippet?.text || '',
        })).filter((seg: { start: number; text: string }) => seg.text.trim()) || [];

    if (segments.length === 0) {
      return NextResponse.json(
        { error: 'No transcript segments found for this video' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`✅ Fetched ${segments.length} transcript segments`);

    // Save video metadata
    const basicInfo = videoInfo.basic_info;
    const videoTitle = basicInfo.title || 'Unknown';
    const channelName = basicInfo.channel?.name || basicInfo.author || 'Unknown';

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

