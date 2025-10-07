import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { claims } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/fact-check/webhook?videoId=xxx
 * Server-Sent Events endpoint for real-time claim updates
 * Extension/UI can subscribe to this to get live fact-check updates
 */
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId');
  
  if (!videoId) {
    return NextResponse.json(
      { error: 'videoId parameter is required' },
      { status: 400 }
    );
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Poll for claim updates every 2 seconds
      const intervalId = setInterval(async () => {
        try {
          const updatedClaims = await db
            .select()
            .from(claims)
            .where(eq(claims.videoId, videoId));

          sendEvent({
            type: 'update',
            claims: updatedClaims,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Error fetching claims:', error);
          sendEvent({
            type: 'error',
            message: 'Error fetching claims',
          });
        }
      }, 2000);

      // Send initial heartbeat
      sendEvent({
        type: 'connected',
        videoId,
        timestamp: new Date().toISOString(),
      });

      // Cleanup on disconnect
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
    },
  });
}

