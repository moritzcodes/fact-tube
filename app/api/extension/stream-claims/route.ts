import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { claims } from '@/lib/db/schema';
import { eq, gt } from 'drizzle-orm';

/**
 * Server-Sent Events endpoint for streaming claim updates to chrome extension
 * This allows real-time updates as claims are extracted and fact-checked
 */

export const dynamic = 'force-dynamic';

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get('video_id');

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'video_id parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let lastCheckTime = new Date();
      let sentClaimIds = new Set<string>();

      // Function to send a message to the client
      const sendMessage = (type: string, data: any) => {
        const message = `data: ${JSON.stringify({ type, data })}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial connection message
      sendMessage('connected', { videoId });

      // Poll for new claims every 2 seconds
      const intervalId = setInterval(async () => {
        try {
          // Get claims that were created or updated after last check
          const newClaims = await db
            .select()
            .from(claims)
            .where(eq(claims.videoId, videoId))
            .orderBy(claims.timestamp);

          // Filter to only new claims we haven't sent yet
          const unsent = newClaims.filter(claim => !sentClaimIds.has(claim.id));

          for (const claim of unsent) {
            sentClaimIds.add(claim.id);

            // Send claim to client
            sendMessage('claim', {
              id: claim.id,
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
            });
          }

          // Check for updates to existing claims
          for (const claim of newClaims) {
            if (sentClaimIds.has(claim.id) && claim.updatedAt > lastCheckTime) {
              sendMessage('claim_update', {
                id: claim.id,
                status: claim.status,
                written_summary: claim.verdict || '',
                evidence: claim.sources ? JSON.parse(claim.sources).map((url: string) => ({
                  source_url: url,
                })) : [],
                sourceBias: claim.sourceBias ? JSON.parse(claim.sourceBias) : null,
              });
            }
          }

          lastCheckTime = new Date();
        } catch (error) {
          console.error('Error fetching claims:', error);
          sendMessage('error', { error: 'Failed to fetch claims' });
        }
      }, 2000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...corsHeaders,
    },
  });
}

