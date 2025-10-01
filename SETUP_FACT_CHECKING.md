# Quick Setup Guide: Fact-Checking with Perplexity Sonar

## 1. Get Your Perplexity API Key

1. Visit https://www.perplexity.ai/settings/api
2. Create an account if you don't have one
3. Generate a new API key

## 2. Add API Key to Environment

Add the following to your `.env` file:

```env
PERPLEXITY_API_KEY="your-actual-key-here"
```

## 3. Update Database Schema

Run these commands to update your database schema with the new claim statuses:

```bash
pnpm db:generate
pnpm db:push
```

This updates the claim status enum to support:
- `pending` - Claim awaiting fact-check
- `verified` - Claim is supported by reliable evidence
- `false` - Claim is contradicted by reliable evidence
- `disputed` - Conflicting evidence or partially true/false
- `inconclusive` - Unable to verify with reliable sources

## 4. How It Works

### Automatic Fact-Checking

Claims are **automatically fact-checked** as soon as they're extracted from video transcripts. The system:

1. Extracts claims from transcript segments
2. Saves them to the database with `status = 'pending'`
3. **Immediately triggers fact-checking in the background**
4. Updates the claim with verification results from Perplexity Sonar

### Source Quality

The fact-checker only uses data-driven and renowned sources:
- Academic journals and peer-reviewed research
- Government official statistics
- Reputable news organizations
- Official institutional reports (WHO, UN, World Bank, etc.)

If reliable sources aren't found, the claim is marked as `inconclusive`.

## 5. Usage Examples

### From Chrome Extension

```javascript
// Claims are automatically fact-checked when extracted
// Subscribe to real-time updates:
const eventSource = new EventSource(`/api/fact-check/webhook?videoId=${videoId}`);

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'update') {
    // data.claims contains all claims with their current status
    updateUI(data.claims);
  }
});
```

### Manual Fact-Checking (if needed)

```typescript
// Using tRPC (recommended)
import { api } from '@/lib/trpc/client';

// Fact-check a specific claim
await api.claims.factCheckClaim.mutate({ claimId: 'uuid' });

// Fact-check all pending claims for a video
await api.claims.factCheckByVideoId.mutate({ videoId: 'youtube-id' });

// Fact-check ALL pending claims
await api.claims.factCheckAllPending.mutate();
```

## 6. Testing

To test the fact-checking system:

1. Start your development server:
   ```bash
   pnpm dev
   ```

2. Extract some claims from a video using your Chrome extension

3. Watch the console logs to see fact-checking in progress

4. Check the database to see updated claim statuses

## 7. Rate Limiting

The worker includes a 1-second delay between requests to respect Perplexity's rate limits. For production:

- Consider using a job queue (Bull, BullMQ, Inngest)
- Monitor your API usage on Perplexity's dashboard
- Implement exponential backoff for failed requests

## 8. Monitoring

Check the console logs for:
- `Fact-checking claim {id}: "{claim text}"`
- `Claim {id} fact-checked: {status}`
- Any errors during the process

For production, integrate with:
- Sentry for error tracking
- Your hosting provider's logging (e.g., Vercel logs)

## Need Help?

See `FACT_CHECKING.md` for detailed documentation on:
- API endpoints
- Worker implementation details
- Chrome extension integration
- Advanced configuration

