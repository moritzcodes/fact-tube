import { env } from '@/lib/env';
import { db } from '@/lib/db';
import { claims, type Claim } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Fact-checking worker that processes claims using Perplexity Sonar via OpenRouter
 * Uses data-driven and renowned sources for verification
 */

interface SourceWithBias {
  url: string;
  bias: 'left' | 'center' | 'right';
  domain: string;
}

interface FactCheckResult {
  claimId?: string;
  status: 'verified' | 'false' | 'disputed' | 'inconclusive';
  verdict: string;
  sources: string[];
  sourcesWithBias?: SourceWithBias[];
  written_summary?: string;
}

/**
 * Analyze HOW a source covered a specific claim/topic
 * This is context-aware: the same publication might lean different directions on different topics
 */
async function analyzeSourceCoverage(url: string, claim: string): Promise<'left' | 'center' | 'right'> {
  const domain = new URL(url).hostname.toLowerCase();
  
  // Fast path: Known definitively neutral sources
  // These are institutionally neutral regardless of topic
  const definitiveCenter = [
    'gov', '.edu', 'who.int', 'un.org', 'worldbank.org', 'imf.org', 'oecd.org',
    'europa.eu', 'census.gov', 'data.gov', 'nih.gov', 'cdc.gov',
    'nature.com', 'science.org', 'pnas.org', 'pubmed.ncbi.nlm.nih.gov',
    'factcheck.org', 'snopes.com', 'politifact.com', 'fullfact.org',
    'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk' // Wire services & public broadcasters
  ];
  
  for (const source of definitiveCenter) {
    if (domain.includes(source)) {
      return 'center';
    }
  }
  
  // For other sources, analyze their coverage in context
  try {
    if (!env.OPENROUTER_API_KEY) {
      console.warn('⚠️ No OpenRouter API key available for source analysis');
      return 'center';
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VERCEL_URL || 'http://localhost:3000',
        'X-Title': 'Fact-Tube',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini', // Fast, cost-effective for classification
        messages: [
          {
            role: 'system',
            content: `You analyze media coverage bias. Your job is to determine the POLITICAL LEANING of how a specific source covered a specific topic.

IMPORTANT: Analyze the source's COVERAGE of THIS topic, not the general reputation of the publication.
- A left-leaning publication might cover economics from the center
- A right-leaning publication might cover science neutrally
- A centrist publication might lean left/right on specific issues

Classification:
- "left": Coverage favors progressive/liberal perspectives (regulation, social programs, diversity, climate action)
- "center": Balanced, fact-focused, or non-political coverage
- "right": Coverage favors conservative perspectives (free market, tradition, limited government, skepticism of regulations)

Key indicators:
- Word choice and framing (e.g., "climate crisis" vs "climate change")
- Which experts/voices are cited
- What aspects are emphasized or omitted
- Tone toward policies/figures

Respond ONLY with JSON: {"bias": "left|center|right", "reasoning": "brief explanation of the coverage angle"}`,
          },
          {
            role: 'user',
            content: `Analyze how this source covered this claim:

Claim: "${claim}"
Source: ${url}
Domain: ${domain}

Based on the domain's typical coverage patterns for this type of topic, what political leaning would their coverage likely have?`,
          },
        ],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Bias analysis API error: ${errorText}`);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in response');
    }

    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`Could not parse JSON from response: ${content}`);
      throw new Error('Could not parse JSON from response');
    }

    const result = JSON.parse(jsonMatch[0]) as {
      bias: 'left' | 'center' | 'right';
      reasoning: string;
    };

    // Validate the result
    const validBias = ['left', 'center', 'right'];
    if (!validBias.includes(result.bias)) {
      console.warn(`Invalid bias "${result.bias}" for ${domain}, defaulting to center`);
      return 'center';
    }

    console.log(`📊 Coverage bias for ${domain}: ${result.bias}`);
    if (result.reasoning) {
      console.log(`   Reasoning: ${result.reasoning}`);
    }

    return result.bias;
  } catch (error) {
    console.error(`Error analyzing coverage bias for ${domain}:`, error);
    // Default to center on error (safest assumption)
    return 'center';
  }
}

/**
 * Prioritize sources based on domain reputation
 * Higher score = more reputable
 */
function getSourcePriority(url: string): number {
  const domain = new URL(url).hostname.toLowerCase();
  
  // Tier 1: Official government and international organizations
  const tier1Domains = [
    'gov', 'census.gov', 'data.gov', 'nih.gov', 'cdc.gov',
    'who.int', 'un.org', 'worldbank.org', 'imf.org', 'oecd.org',
    'europa.eu', 'gov.uk', 'bundesregierung.de'
  ];
  
  // Tier 2: Academic and research institutions
  const tier2Domains = [
    'edu', 'ac.uk', 'scholar.google', 'researchgate.net',
    'nature.com', 'science.org', 'pnas.org', 'pubmed.ncbi.nlm.nih.gov'
  ];
  
  // Tier 3: Established fact-checking and quality journalism
  const tier3Domains = [
    'reuters.com', 'apnews.com', 'bbc.com', 'factcheck.org',
    'snopes.com', 'politifact.com', 'fullfact.org', 'nytimes.com',
    'washingtonpost.com', 'theguardian.com', 'wsj.com', 'ft.com',
    'economist.com', 'bloomberg.com'
  ];
  
  // Tier 4: Other news and data sources
  const tier4Domains = [
    'statista.com', 'tradingeconomics.com', 'worldometers.info'
  ];
  
  for (const d of tier1Domains) {
    if (domain.includes(d)) return 100;
  }
  for (const d of tier2Domains) {
    if (domain.includes(d)) return 80;
  }
  for (const d of tier3Domains) {
    if (domain.includes(d)) return 60;
  }
  for (const d of tier4Domains) {
    if (domain.includes(d)) return 40;
  }
  
  return 20; // Default for other sources
}

/**
 * Filter and sort sources by quality, with bias information
 * Analyzes how each source covered this specific claim
 */
async function selectBestSources(
  sources: string[], 
  claim: string, 
  maxCount: number = 3
): Promise<{ urls: string[], sourcesWithBias: SourceWithBias[] }> {
  // Remove duplicates and invalid URLs
  const validSources = [...new Set(sources)].filter(url => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
  
  // Sort by priority score (synchronous part)
  const scored = validSources.map(url => {
    const domain = new URL(url).hostname;
    return {
      url,
      domain,
      priority: getSourcePriority(url),
    };
  });
  
  scored.sort((a, b) => b.priority - a.priority);
  
  // Take top sources first, then analyze their coverage bias
  const topSources = scored.slice(0, maxCount);
  
  // Analyze coverage bias for each source (parallel for speed)
  const sourcesWithBias = await Promise.all(
    topSources.map(async (s) => ({
      url: s.url,
      domain: s.domain,
      bias: await analyzeSourceCoverage(s.url, claim)
    }))
  );
  
  return {
    urls: sourcesWithBias.map(s => s.url),
    sourcesWithBias
  };
}

/**
 * Fact-check a single claim using Perplexity Sonar via OpenRouter
 */
export async function factCheckClaim(claim: Claim): Promise<FactCheckResult> {
  try {
    if (!env.OPENROUTER_API_KEY) {
      console.warn('⚠️ No OpenRouter API key available for fact-checking');
      return {
        claimId: claim.id,
        status: 'inconclusive',
        verdict: 'Unable to fact-check: API key not configured',
        sources: [],
        sourcesWithBias: [],
        written_summary: 'Fact-checking requires an OpenRouter API key to be configured.',
      };
    }

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
            content: `You are a rigorous fact-checker. Verify claims using ONLY data-driven, peer-reviewed, or renowned sources:
- Government statistics and databases
- Academic journals and peer-reviewed research
- Official institutional reports (WHO, UN, World Bank, etc.)
- Reputable news organizations with fact-checking standards

Categorize each claim as ONE of:
- "verified": Strongly supported by reliable evidence from multiple sources
- "false": Contradicted by reliable evidence
- "disputed": Conflicting evidence, or partially true/false
- "inconclusive": Insufficient reliable sources to verify

VERDICT WRITING RULES:
1. Write in simple, direct language a general audience can understand
2. Start with the answer/conclusion first (e.g., "Yes, X is true" or "No, this is incorrect")
3. Include specific facts, numbers, or dates that support the conclusion
4. Keep it concise: 1-2 sentences maximum
5. Avoid hedging language like "According to sources" or "The data suggests" - state facts confidently
6. If false, briefly state what the truth is

Examples:
✅ Good: "Yes, inflation reached 8.5% in March 2022, the highest since 1981."
✅ Good: "No, the unemployment rate was 3.6%, not 5%."
❌ Bad: "According to data from various sources, inflation appears to have reached approximately 8.5%..."

Respond in JSON:
{
  "status": "verified|false|disputed|inconclusive",
  "verdict": "Direct answer with key facts (1-2 sentences)",
  "sources": ["array of source URLs"]
}`,
          },
          {
            role: 'user',
            content: `Fact-check this claim: "${claim.claim}"
${claim.speaker ? `Speaker: ${claim.speaker}` : ''}

Remember: Start your verdict with "Yes" or "No" and include the key facts. Be direct and specific.`,
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

    // Extract and filter citations from Perplexity's response
    let allSources: string[] = [];
    
    if (data.citations && Array.isArray(data.citations)) {
      allSources = data.citations;
    }
    
    // Also include sources from the result if available
    if (result.sources && Array.isArray(result.sources)) {
      allSources = [...allSources, ...result.sources];
    }
    
    // Filter and prioritize sources (limit to top 3 highest quality)
    // Analyze how each source covered this specific claim
    const selectedSources = await selectBestSources(allSources, claim.claim, 3);
    result.sources = selectedSources.urls;
    result.sourcesWithBias = selectedSources.sourcesWithBias;
    result.claimId = claim.id;

    return result;
  } catch (error) {
    console.error('Error fact-checking claim:', error);
    
    // If there's an error, return inconclusive
    return {
      claimId: claim.id,
      status: 'inconclusive',
      verdict: 'Unable to verify this claim due to a technical error during fact-checking.',
      sources: [],
      sourcesWithBias: [],
      written_summary: 'Fact-checking failed due to a technical error.',
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
        sourceBias: factCheckResult.sourcesWithBias ? JSON.stringify(factCheckResult.sourcesWithBias) : null,
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

