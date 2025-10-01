# YouTube.js Migration Guide

## Overview

This project has been successfully migrated from `youtube-transcript` to `youtubei.js` (YouTube.js v15.1.1) for improved reliability, better proxy support, and more features.

## What Changed

### 1. Package Changes
- ✅ **Installed**: `youtubei.js@15.1.1`
- ❌ **Removed**: `youtube-transcript@1.2.1`

### 2. Updated Files

#### `/lib/trpc/routers/transcripts.ts`
- Replaced `YoutubeTranscript` with `Innertube` from `youtubei.js`
- Added proxy configuration support via environment variables
- Improved error handling and segment parsing
- Language preference is now passed during instance creation

#### `/get-transcript.js`
- CLI tool completely rewritten to use YouTube.js
- Maintains the same command-line interface
- Supports all previous features (plain text, SRT format, language selection)

#### `/env.example`
- Added optional proxy configuration variables:
  - `YOUTUBE_PROXY_URL`: Custom proxy server endpoint
  - `YOUTUBE_USER_AGENT`: Custom user agent string

## Features

### Language Support
```typescript
// Specify language during transcript fetch
const result = await trpc.transcripts.fetchFromYouTube.query({
  videoId: 'dQw4w9WgXcQ',
  lang: 'en', // Default: 'en'
});
```

### Proxy Configuration (Optional)

Add these to your `.env` file if you need proxy support:

```bash
# Use a proxy to bypass rate limits or geo-restrictions
YOUTUBE_PROXY_URL="https://your-proxy-server.com/proxy"
YOUTUBE_USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

The implementation will automatically use the proxy if configured.

## CLI Usage

The `get-transcript.js` tool works exactly as before:

```bash
# Basic usage
node get-transcript.js dQw4w9WgXcQ

# With video URL
node get-transcript.js https://www.youtube.com/watch?v=dQw4w9WgXcQ

# With language
node get-transcript.js dQw4w9WgXcQ --lang es

# SRT format output
node get-transcript.js dQw4w9WgXcQ --format srt --out transcript.srt

# Plain text to file
node get-transcript.js dQw4w9WgXcQ --format plain --out transcript.txt
```

## Technical Details

### YouTube.js Features
- ✅ Runs on Node.js, Deno, and modern browsers
- ✅ Uses `undici`'s fetch implementation (requires Node.js 16.8+)
- ✅ Spec-compliant Response objects with ReadableStream support
- ✅ EventTarget and CustomEvent support
- ✅ Built-in proxy support via custom fetch implementation

### Transcript Data Structure

The API response format remains unchanged:
```typescript
{
  videoId: string;
  lang: string;
  segments: Array<{
    start: number;      // seconds
    duration: number;   // seconds
    end: number;        // seconds
    text: string;
  }>;
  totalSegments: number;
}
```

### Proxy Implementation

The proxy implementation allows you to route all YouTube API requests through a custom proxy server. The implementation:

1. Checks for `YOUTUBE_PROXY_URL` environment variable
2. If present, wraps all fetch requests to go through the proxy
3. Adds custom User-Agent header if `YOUTUBE_USER_AGENT` is set
4. Maintains full compatibility with the YouTube.js library

Example proxy URL format:
```
https://your-proxy.com/proxy?url={ENCODED_YOUTUBE_URL}
```

## Error Handling

Enhanced error messages for common scenarios:
- No captions/subtitles available
- Captions disabled for the video
- Video unavailable or doesn't exist
- No transcript segments found

## Testing

To test the new implementation:

```bash
# Test the CLI tool
node get-transcript.js dQw4w9WgXcQ

# Test via the tRPC API (in your Next.js app)
# Navigate to your app and try fetching a transcript
```

## Troubleshooting

### Issue: "Video not found or unavailable"
- Verify the video ID is correct
- Check if the video is public and accessible
- Ensure the video exists and hasn't been deleted

### Issue: "No transcript available"
- Not all videos have captions/subtitles
- Try a different video with known captions
- Check if auto-generated captions are available

### Issue: Rate limiting
- Configure a proxy server using `YOUTUBE_PROXY_URL`
- Implement request throttling in your application
- Consider caching transcript results

## Migration Benefits

1. **Better Reliability**: YouTube.js is actively maintained and uses official YouTube InnerTube API
2. **Proxy Support**: Built-in proxy configuration for production deployments
3. **More Features**: Access to additional YouTube data beyond transcripts
4. **Type Safety**: Better TypeScript support and type definitions
5. **Modern API**: Uses modern fetch API and Response objects

## Support

YouTube.js Documentation: https://github.com/LuanRT/YouTube.js

For issues specific to this implementation, check the project's main README or documentation.

