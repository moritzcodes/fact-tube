import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { videos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import { processClaimFactCheck } from '@/lib/workers/fact-checker';
import { claims } from '@/lib/db/schema';

/**
 * Chrome Extension endpoint - Submit transcript segments for claim extraction
 * Processes transcript chunks and returns extracted claims immediately
 */

// Create OpenAI client only if API key is available
let openai: OpenAI | null = null;
if (env.OPENROUTER_API_KEY) {
  openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'https://fact-tube.app',
      'X-Title': 'FactTube',
    },
  });
}

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
    const { videoId, videoTitle, channelName, segments } = body;

    if (!videoId || !segments || !Array.isArray(segments)) {
      return NextResponse.json(
        { error: 'videoId and segments array are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!openai) {
      return NextResponse.json(
        { error: 'OpenRouter API key is required. Please configure it in the extension settings.' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Store video metadata if provided
    if (videoTitle || channelName) {
      try {
        // Check if video exists
        const existingVideo = await db
          .select()
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);

        if (existingVideo.length > 0) {
          // Update existing video
          await db
            .update(videos)
            .set({
              title: videoTitle || existingVideo[0].title,
              channelName: channelName || existingVideo[0].channelName,
            })
            .where(eq(videos.id, videoId));
        } else {
          // Insert new video
          await db.insert(videos).values({
            id: videoId,
            title: videoTitle,
            channelName: channelName,
          });
        }
      } catch (error) {
        console.error('Error saving video metadata:', error);
        // Continue processing even if metadata save fails
      }
    }

    // Prepare transcript text with timestamps
    const transcriptText = segments
      .map((seg: { start: number; text: string }) => `[${Math.floor(seg.start)}s] ${seg.text}`)
      .join('\n');

    let contextMessage = '';
    if (videoTitle) {
      contextMessage += `\nTitle: ${videoTitle}`;
    }
    if (channelName) {
      contextMessage += `\nChannel: ${channelName}`;
    }

    // Extract claims using AI
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
          content: `Extract ONLY the most important fact-checkable claims from this transcript segment:${contextMessage}\n\n${transcriptText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    const extractedClaims = parsed.claims || [];

    // Save claims to database
    const savedClaims = [];
    for (const claim of extractedClaims) {
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

      savedClaims.push(result[0]);

      // Automatically trigger fact-checking in the background
      processClaimFactCheck(result[0].id).catch((error) => {
        console.error(`Error auto-triggering fact-check for claim ${result[0].id}:`, error);
      });
    }

    return NextResponse.json({
      success: true,
      claimsExtracted: savedClaims.length,
      claims: savedClaims.map((claim) => ({
        id: claim.id,
        claim: claim.claim,
        speaker: claim.speaker,
        timestamp: claim.timestamp,
        status: claim.status,
      })),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error processing transcript:', error);
    return NextResponse.json(
      { error: 'Failed to process transcript segment' },
      { status: 500, headers: corsHeaders }
    );
  }
}

