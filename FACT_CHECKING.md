# Fact-Checking System

This document describes the fact-checking system that uses Perplexity Sonar for verifying claims.

## Overview

The fact-checking worker processes claims extracted from video transcripts and categorizes them into one of four statuses:

- **verified**: The claim is supported by strong, reliable evidence from multiple reputable sources
- **false**: The claim is contradicted by reliable evidence
- **disputed**: There is conflicting evidence from reputable sources, or the claim is partially true/false
- **inconclusive**: Unable to verify due to lack of reliable sources or insufficient evidence

## Source Quality Standards

The system only uses data-driven and renowned sources including:

- Academic journals and peer-reviewed research
- Government official statistics and databases
- Reputable news organizations with strong fact-checking standards
- Official institutional reports (WHO, UN, World Bank, etc.)
- Primary source documents

If reliable sources cannot be found, the claim is marked as **inconclusive**.

## Setup

### Environment Variables

Add your Perplexity API key to your `.env` file:

```env
PERPLEXITY_API_KEY="your-perplexity-api-key-here"
```

Get your API key from: https://www.perplexity.ai/settings/api

### Database Migration

The claim status enum has been updated. Run the following to update your database schema:

```bash
pnpm db:generate
pnpm db:push
```

## API Usage

### tRPC Routes (Recommended)

```typescript
import { api } from '@/lib/trpc/client';

// Fact-check a single claim
await api.claims.factCheckClaim.mutate({ 
  claimId: 'uuid-here' 
});

// Fact-check all pending claims
await api.claims.factCheckAllPending.mutate();

// Fact-check all pending claims for a specific video
await api.claims.factCheckByVideoId.mutate({ 
  videoId: 'youtube-video-id' 
});
```

### REST API Routes

```bash
# Fact-check a specific claim
POST /api/fact-check
{
  "claimId": "uuid-here"
}

# Process all pending claims
POST /api/fact-check
{
  "processAll": true
}

# Subscribe to real-time updates (SSE)
GET /api/fact-check/webhook?videoId=youtube-video-id
```

## How It Works

1. **Claim Creation**: When claims are extracted from a video, they're saved to the database with `status = 'pending'`

2. **Background Processing**: The fact-checking worker picks up pending claims and sends them to Perplexity Sonar for verification

3. **Verification**: Perplexity Sonar searches for reliable sources and provides:
   - A status (verified/false/disputed/inconclusive)
   - A clear verdict explanation
   - Source citations

4. **Database Update**: The claim is updated with the verification results

5. **Real-time Updates**: The extension/UI can subscribe to SSE endpoint to receive live updates

## Worker Implementation

The fact-checking worker is implemented in `/lib/workers/fact-checker.ts` and includes:

- `factCheckClaim(claim)`: Fact-checks a single claim using Perplexity Sonar
- `processClaimFactCheck(claimId)`: Processes a single claim and updates the database
- `processAllPendingClaims()`: Processes all pending claims sequentially

## Rate Limiting

The worker includes a 1-second delay between requests to respect API rate limits. For production use, consider:

- Using a job queue system (Bull, BullMQ, or Inngest)
- Implementing exponential backoff for failed requests
- Batching requests where possible

## Chrome Extension Integration

The extension can trigger fact-checking and subscribe to updates:

```javascript
// Trigger fact-checking for a video
fetch('/api/fact-check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ processAll: true })
});

// Subscribe to real-time updates
const eventSource = new EventSource(`/api/fact-check/webhook?videoId=${videoId}`);

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'update') {
    // Update UI with new claim statuses
    updateClaimsUI(data.claims);
  }
});
```

## Automatic Triggering

For automatic fact-checking, you can modify the claim extraction in `/lib/trpc/routers/ai.ts` to automatically trigger fact-checking after claims are created:

```typescript
// After saving claims
for (const claim of savedClaims) {
  processClaimFactCheck(claim.id).catch(console.error);
}
```

## Monitoring

The worker logs all activity to the console:

- When claims are being fact-checked
- The results of each fact-check
- Any errors that occur

In production, consider integrating with a logging service like:
- Sentry for error tracking
- LogTail for structured logging
- Your hosting provider's logging (e.g., Vercel logs)

