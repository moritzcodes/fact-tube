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

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://fact-tube.app',
    'X-Title': 'FactTube',
  },
});

// CORS headers for Chrome Extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

      // Group cached claims by proximity too
      const groupedCachedClaims = groupClaimsByProximity(existingClaims, 10);
      console.log(`🔍 Grouped ${existingClaims.length} cached claims into ${groupedCachedClaims.length} markers`);

      return NextResponse.json({
        success: true,
        cached: true,
        videoId,
        title: videoData[0]?.title || '',
        totalClaims: existingClaims.length,
        totalMarkers: groupedCachedClaims.length,
        claims: groupedCachedClaims.map(group => ({
          id: group.claims[0].id, // Use first claim's ID as group ID
          claims: group.claims.map(claim => ({
            id: claim.id,
            claim: claim.claim,
            speaker: claim.speaker || 'Unknown',
            timestamp: claim.timestamp,
            status: claim.status,
            verdict: claim.verdict || '',
            sources: claim.sources ? JSON.parse(claim.sources) : [],
            sourceBias: claim.sourceBias ? JSON.parse(claim.sourceBias) : null,
          })),
          timestamp: group.timestamp, // Group timestamp (earliest in group)
          claimCount: group.claims.length,
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
    } catch (error: any) {
      console.error('❌ Error fetching transcript:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch transcript',
          message: error.message || 'No captions/subtitles available for this video',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Extract segments
    const segments = transcript.content?.body?.initial_segments?.map((segment: any) => ({
      start: (segment.start_ms || 0) / 1000,
      text: segment.snippet?.text || '',
    })).filter((seg: any) => seg.text.trim()) || [];

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
        .map((seg: any) => `[${Math.floor(seg.start)}s] ${seg.text}`)
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
            processClaimFactCheck(result[0].id).catch((error) => {
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

    // Group claims that are close together (within 10 seconds)
    const groupedClaims = groupClaimsByProximity(allClaimsFromDb, 10);
    console.log(`🔍 Grouped ${allClaimsFromDb.length} claims into ${groupedClaims.length} markers`);

    return NextResponse.json({
      success: true,
      cached: false,
      videoId,
      title: videoTitle,
      channelName,
      totalClaims: allClaimsFromDb.length,
      totalMarkers: groupedClaims.length,
      claims: groupedClaims.map(group => ({
        id: group.claims[0].id, // Use first claim's ID as group ID
        claims: group.claims.map(claim => ({
          id: claim.id,
          claim: claim.claim,
          speaker: claim.speaker,
          timestamp: claim.timestamp,
          status: claim.status,
          verdict: claim.verdict || '',
          sources: claim.sources ? JSON.parse(claim.sources) : [],
          sourceBias: claim.sourceBias ? JSON.parse(claim.sourceBias) : null,
        })),
        timestamp: group.timestamp, // Group timestamp (earliest in group)
        claimCount: group.claims.length,
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
function chunkTranscriptSegments(segments: any[], chunkDuration: number) {
  const chunks = [];
  let currentChunk: any[] = [];
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

/**
 * Group claims that are close together in time
 * This prevents timeline markers from being too crowded by combining nearby claims
 */
function groupClaimsByProximity(claims: any[], maxSpacing: number = 10) {
  if (claims.length === 0) return [];
  if (claims.length === 1) return [{ timestamp: claims[0].timestamp, claims: [claims[0]] }];

  // Sort by timestamp
  const sorted = [...claims].sort((a, b) => a.timestamp - b.timestamp);
  const groups = [];
  let currentGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const currentClaim = sorted[i];
    const lastClaimInGroup = currentGroup[currentGroup.length - 1];

    // If current claim is within maxSpacing seconds of the last claim in the group, add it to the group
    if (currentClaim.timestamp - lastClaimInGroup.timestamp < maxSpacing) {
      currentGroup.push(currentClaim);
      console.log(`📍 Grouping claim at ${currentClaim.timestamp}s with claim at ${lastClaimInGroup.timestamp}s`);
    } else {
      // Start a new group
      groups.push({
        timestamp: currentGroup[0].timestamp, // Use earliest timestamp in group
        claims: currentGroup,
      });
      currentGroup = [currentClaim];
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push({
      timestamp: currentGroup[0].timestamp,
      claims: currentGroup,
    });
  }

  return groups;
}


