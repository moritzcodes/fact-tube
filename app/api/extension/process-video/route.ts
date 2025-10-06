import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { claims, videos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Chrome Extension endpoint - Process a YouTube video and return claims with SSE streaming
 * This endpoint handles the entire flow: transcript fetching, claim extraction, and fact-checking
 */

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

// Extract YouTube video ID from URL
function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    } else if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoUrl = searchParams.get('video_url');

  if (!videoUrl) {
    return new Response(JSON.stringify({ error: 'video_url parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // Check if we already have claims for this video
    const existingClaims = await db
      .select()
      .from(claims)
      .where(eq(claims.videoId, videoId))
      .orderBy(claims.timestamp);

    if (existingClaims.length > 0) {
      // Return cached results
      console.log(`✅ Returning cached claims for video ${videoId}`);
      
      // Get video metadata
      const videoData = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      const response = {
        video_id: videoId,
        title: videoData[0]?.title || '',
        total_claims: existingClaims.length,
        claim_responses: existingClaims.map(claim => ({
          claim: {
            claim: claim.claim,
            speaker: claim.speaker || 'Unknown',
            start: claim.timestamp,
          },
          status: claim.status,
          written_summary: claim.verdict || '',
          evidence: claim.sources ? JSON.parse(claim.sources).map((url: string) => ({
            source_url: url,
          })) : [],
          sourceBias: claim.sourceBias ? JSON.parse(claim.sourceBias) : null,
        })),
        summary: createSummary(existingClaims),
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // No cached claims - tell extension to start transcript processing
    return new Response(
      JSON.stringify({
        video_id: videoId,
        status: 'processing',
        message: 'Video is being processed. Use the SSE endpoint to receive real-time updates.',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('Error processing video:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process video' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

function createSummary(claims: any[]) {
  const summary = {
    verified: 0,
    false: 0,
    disputed: 0,
    inconclusive: 0,
  };

  claims.forEach((claim) => {
    if (claim.status === 'verified') summary.verified++;
    else if (claim.status === 'false') summary.false++;
    else if (claim.status === 'disputed') summary.disputed++;
    else if (claim.status === 'inconclusive') summary.inconclusive++;
  });

  return summary;
}

