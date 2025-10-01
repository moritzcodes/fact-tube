import { NextRequest, NextResponse } from 'next/server';
import { processClaimFactCheck, processAllPendingClaims } from '@/lib/workers/fact-checker';

/**
 * POST /api/fact-check
 * Triggers fact-checking for specific claims or all pending claims
 * 
 * Body:
 * - { claimId: "uuid" } - Fact-check a specific claim
 * - { processAll: true } - Process all pending claims
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.claimId) {
      // Fact-check a specific claim
      await processClaimFactCheck(body.claimId);
      return NextResponse.json({ 
        success: true, 
        message: `Claim ${body.claimId} is being fact-checked` 
      });
    } else if (body.processAll) {
      // Process all pending claims in the background
      // Note: In production, this should be done via a queue system
      processAllPendingClaims().catch(error => {
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

