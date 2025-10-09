import { NextRequest, NextResponse } from 'next/server';
import { processClaimFactCheck, processAllPendingClaims } from '@/lib/workers/fact-checker';
import { env } from '@/lib/env';

/**
 * POST /api/fact-check
 * Triggers fact-checking for specific claims or all pending claims
 *
 * Body:
 * - { claimId: "uuid" } - Fact-check a specific claim
 * - { processAll: true } - Process all pending claims
 *
 * Headers:
 * - X-OpenRouter-API-Key: Optional API key (overrides env variable)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get API key from header or environment variable
    const customApiKey = request.headers.get('X-OpenRouter-API-Key');
    const apiKey = customApiKey || env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is required. Please configure it in the extension settings.' },
        { status: 401 }
      );
    }

    if (body.claimId) {
      // Fact-check a specific claim
      await processClaimFactCheck(body.claimId, apiKey);
      return NextResponse.json({
        success: true,
        message: `Claim ${body.claimId} is being fact-checked`
      });
    } else if (body.processAll) {
      // Process all pending claims in the background
      // Note: In production, this should be done via a queue system
      processAllPendingClaims(apiKey).catch(error => {
        console.error('Background fact-checking error:', error);
      });

      return NextResponse.json({
        success: true,
        message: 'Processing all pending claims in the background'
      });
    } else {
      return NextResponse.json(
        { error: 'Either claimId or processAll must be provided' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Fact-check API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

