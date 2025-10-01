import { env } from '@/lib/env';
import { db } from '@/lib/db';
import { claims, type Claim } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Fact-checking worker that processes claims using Perplexity Sonar via OpenRouter
 * Uses data-driven and renowned sources for verification
 */

interface FactCheckResult {
  status: 'verified' | 'false' | 'disputed' | 'inconclusive';
  verdict: string;
  sources: string[];
}

/**
 * Fact-check a single claim using Perplexity Sonar via OpenRouter
 */
export async function factCheckClaim(claim: Claim): Promise<FactCheckResult> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VERCEL_URL || 'http://localhost:3000',
        'X-Title': 'Fact-Tube',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-pro', // Using Sonar Pro via OpenRouter for highest quality fact-checking
        messages: [
          {
            role: 'system',
            content: `You are a rigorous fact-checker. Your job is to verify claims using ONLY data-driven, peer-reviewed, or renowned sources such as:
- Academic journals and peer-reviewed research
- Government official statistics and databases
- Reputable news organizations with strong fact-checking standards
- Official institutional reports (WHO, UN, World Bank, etc.)
- Primary source documents

You must categorize each claim into ONE of these categories:
- "verified": The claim is supported by strong, reliable evidence from multiple reputable sources
- "false": The claim is contradicted by reliable evidence
- "disputed": There is conflicting evidence from reputable sources, or the claim is partially true/false
- "inconclusive": Unable to verify due to lack of reliable sources or insufficient evidence

IMPORTANT: If you cannot find data-driven and reputable sources to verify the claim, you MUST categorize it as "inconclusive".

Respond in JSON format:
{
  "status": "verified|false|disputed|inconclusive",
  "verdict": "A clear, concise explanation (2-3 sentences) of why the claim received this status",
  "sources": ["array of source URLs"]
}`,
          },
          {
            role: 'user',
            content: `Please fact-check this claim: "${claim.claim}"
${claim.speaker ? `Speaker: ${claim.speaker}` : ''}

Provide your analysis in JSON format.`,
          },
        ],
        temperature: 0.2, // Low temperature for more consistent, factual responses
        return_citations: true,
        return_images: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenRouter response');
    }

    // Extract JSON from the response (handle markdown code blocks if present)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const result = JSON.parse(jsonMatch[0]) as FactCheckResult;

    // Validate the result
    const validStatuses = ['verified', 'false', 'disputed', 'inconclusive'];
    if (!validStatuses.includes(result.status)) {
      console.warn('Invalid status from Perplexity, defaulting to inconclusive');
      result.status = 'inconclusive';
    }

    // Extract citations from Perplexity's response
    if (data.citations && Array.isArray(data.citations)) {
      result.sources = data.citations.slice(0, 5); // Limit to top 5 sources
    } else if (!result.sources || result.sources.length === 0) {
      result.sources = [];
    }

    return result;
  } catch (error) {
    console.error('Error fact-checking claim:', error);
    
    // If there's an error, return inconclusive
    return {
      status: 'inconclusive',
      verdict: 'Unable to verify this claim due to a technical error during fact-checking.',
      sources: [],
    };
  }
}

/**
 * Process a single claim and update the database
 */
export async function processClaimFactCheck(claimId: string): Promise<void> {
  try {
    // Get the claim
    const result = await db
      .select()
      .from(claims)
      .where(eq(claims.id, claimId))
      .limit(1);

    const claim = result[0];
    if (!claim) {
      console.error(`Claim not found: ${claimId}`);
      return;
    }

    if (claim.status !== 'pending') {
      console.log(`Claim ${claimId} is not pending, skipping`);
      return;
    }

    console.log(`Fact-checking claim ${claimId}: "${claim.claim}"`);

    // Fact-check the claim
    const factCheckResult = await factCheckClaim(claim);

    // Update the claim in the database
    await db
      .update(claims)
      .set({
        status: factCheckResult.status,
        verdict: factCheckResult.verdict,
        sources: JSON.stringify(factCheckResult.sources),
        updatedAt: new Date(),
      })
      .where(eq(claims.id, claimId));

    console.log(`Claim ${claimId} fact-checked: ${factCheckResult.status}`);
  } catch (error) {
    console.error(`Error processing claim ${claimId}:`, error);
  }
}

/**
 * Process all pending claims in the database
 */
export async function processAllPendingClaims(): Promise<void> {
  try {
    const pendingClaims = await db
      .select()
      .from(claims)
      .where(eq(claims.status, 'pending'));

    console.log(`Found ${pendingClaims.length} pending claims to fact-check`);

    // Process claims sequentially to avoid rate limiting
    for (const claim of pendingClaims) {
      await processClaimFactCheck(claim.id);
      
      // Add a small delay between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Finished processing all pending claims');
  } catch (error) {
    console.error('Error processing pending claims:', error);
  }
}

