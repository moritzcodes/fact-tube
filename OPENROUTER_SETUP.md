# OpenRouter Setup Guide

This guide will help you set up OpenRouter to use GPT-4o-mini for AI-powered claim extraction.

## 1. Get Your OpenRouter API Key

1. Visit [https://openrouter.ai/](https://openrouter.ai/)
2. Sign up or log in to your account
3. Go to [https://openrouter.ai/keys](https://openrouter.ai/keys)
4. Create a new API key
5. Copy the key (it starts with `sk-or-v1-...`)

## 2. Add the API Key to Your Environment

1. Copy the `.env.example` file to `.env.local`:
   ```bash
   cp env.example .env.local
   ```

2. Open `.env.local` and add your OpenRouter API key:
   ```
   OPENROUTER_API_KEY="sk-or-v1-your-actual-key-here"
   ```

3. Make sure your database URL is also configured in `.env.local`

## 3. How It Works

The integration uses:
- **Model**: `openai/gpt-4o-mini` (fast and cost-effective)
- **Processing**: Transcript segments are chunked into 60-second groups
- **Async**: Each chunk is processed independently and claims are extracted in real-time
- **Storage**: Extracted claims are saved to the database immediately

## 4. Using the Feature

1. Start your development server:
   ```bash
   pnpm dev
   ```

2. Open [http://localhost:3000](http://localhost:3000)

3. Enter a YouTube video ID or URL (try: `jNQXAC9IVRw`)

4. Click **Fetch Transcript**

5. Once the transcript loads, click **Extract Claims with AI**

6. Watch as claims are extracted chunk by chunk asynchronously!

## 5. Cost Estimates

GPT-4o-mini via OpenRouter is very affordable:
- ~$0.15 per million input tokens
- ~$0.60 per million output tokens

A typical 10-minute video transcript (~2,000 words) costs approximately **$0.001-0.005** to process.

## 6. Features

### Current Features
- ✅ Async processing of transcript chunks
- ✅ Real-time progress tracking
- ✅ Automatic claim extraction with timestamps
- ✅ Speaker identification (when possible)
- ✅ Claims saved to database
- ✅ Status tracking (pending/verified/false)

### Future Enhancements
- 🔄 WebSocket streaming for live updates
- 🔄 Background fact-checking workers
- 🔄 Chrome extension integration
- 🔄 Video playback synchronization

## 7. API Routes

### Extract Claims from Segments
```typescript
const result = await trpc.ai.extractClaims.mutate({
  videoId: "dQw4w9WgXcQ",
  segments: [
    { start: 0, text: "Hello world" },
    { start: 5, text: "This is a test" }
  ]
});
```

### Batch Process Multiple Chunks
```typescript
const result = await trpc.ai.extractClaimsBatch.mutate({
  videoId: "dQw4w9WgXcQ",
  segmentChunks: [
    [{ start: 0, text: "Chunk 1" }],
    [{ start: 60, text: "Chunk 2" }]
  ]
});
```

## 8. Troubleshooting

### Error: "Missing environment variable: OPENROUTER_API_KEY"
Make sure you've created `.env.local` and added your API key.

### Error: "Failed to extract claims"
Check your OpenRouter API key is valid and you have credits.

### Claims Not Appearing
Make sure your database is properly set up and running. Run:
```bash
pnpm db:push
```

## 9. Customization

You can customize the AI processing in `/lib/trpc/routers/ai.ts`:
- Change the model (e.g., to `openai/gpt-4o` for better quality)
- Adjust chunk size in `page.tsx` (default: 60 seconds)
- Modify the system prompt for different extraction behavior
- Adjust temperature for more/less creative outputs

## 10. Rate Limits

OpenRouter has generous rate limits, but for production use:
- Consider implementing request queuing
- Add rate limiting middleware
- Cache results when possible
- Monitor usage via OpenRouter dashboard

---

**Need Help?** 
- OpenRouter Docs: [https://openrouter.ai/docs](https://openrouter.ai/docs)
- Project Issues: Check the README.md for support information

