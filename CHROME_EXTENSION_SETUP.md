# Chrome Extension Setup Guide

This guide will help you set up and connect the YouTube Fact-Checker Chrome extension to your Next.js backend.

## 🎯 Overview

The chrome extension has been completely restructured to connect to your tRPC/Next.js backend with:
- ✅ **REST API endpoints** for extension communication
- ✅ **Server-Sent Events (SSE)** for real-time claim streaming
- ✅ **Database integration** for caching and persistence
- ✅ **Background fact-checking** using Perplexity Sonar
- ✅ **Maintained UI/UX** - all existing designs and interactions preserved

## 📁 Architecture

### Backend (Next.js + tRPC)

Three new API routes were created specifically for the chrome extension:

```
app/api/extension/
├── process-video/route.ts       # Check for cached claims or initiate processing
├── stream-claims/route.ts       # SSE endpoint for real-time claim updates
└── submit-transcript/route.ts   # Submit transcript segments for claim extraction
```

These routes integrate with your existing:
- **Database** (Neon PostgreSQL via Drizzle ORM)
- **AI services** (OpenRouter for extraction, Perplexity for verification)
- **Workers** (Background fact-checking)

### Extension Structure

```
public/chrome-extension/
├── background.js              # Service worker (API orchestration, SSE)
├── content.core.js           # Main content script
├── content.transcript.js     # NEW: YouTube transcript extraction
├── content.messaging.js      # UPDATED: SSE message handlers
├── content.overlay.js        # Timeline markers
├── content.player.js         # YouTube player integration
├── content.modals.js         # Claim detail popups
├── config.js                 # NEW: Configuration
└── manifest.json             # UPDATED: New permissions
```

## 🚀 Quick Start

### 1. Install the Extension

```bash
# Navigate to Chrome extensions
chrome://extensions/

# Enable Developer mode (toggle in top right)
# Click "Load unpacked"
# Select: /public/chrome-extension
```

### 2. Configure Backend URL

Open `public/chrome-extension/background.js` and verify:

```javascript
const IS_PRODUCTION = false; // For local development
const API_BASE_URL = 'http://localhost:3000';
```

### 3. Start Your Backend

```bash
# Make sure your .env.local is configured
pnpm dev
```

Your backend should be running at `http://localhost:3000`

### 4. Test It Out

1. Go to any YouTube video with captions
2. Click the "Fact-Check" button on the video
3. Watch claims appear in real-time!

## 🔄 Data Flow

```
┌─────────────────┐
│  YouTube Video  │
└────────┬────────┘
         │
         │ Extract transcript
         ↓
┌─────────────────────┐
│  Chrome Extension   │
│  (content.transcript.js) │
└────────┬────────────┘
         │
         │ POST /api/extension/submit-transcript
         │ { videoId, segments: [...] }
         ↓
┌──────────────────────────┐
│  Next.js Backend         │
│  ├─ OpenAI (extraction)  │
│  └─ Save claims to DB    │
└────────┬─────────────────┘
         │
         │ SSE: GET /api/extension/stream-claims
         │
         ↓
┌────────────────────┐     ┌──────────────────────┐
│  Extension (SSE)   │ ←─→ │  Fact-Checker Worker │
│  Real-time updates │     │  (Perplexity Sonar)  │
└────────────────────┘     └──────────────────────┘
         │
         │ Display claims on timeline
         ↓
┌─────────────────┐
│  YouTube UI     │
│  with overlays  │
└─────────────────┘
```

## 🔌 API Endpoints

### 1. Process Video (Initial Check)

```http
GET /api/extension/process-video?video_url=https://youtube.com/watch?v=...
```

**Response (Cached):**
```json
{
  "video_id": "abc123",
  "title": "Video Title",
  "total_claims": 5,
  "claim_responses": [...],
  "summary": { "verified": 3, "false": 1, "inconclusive": 1 }
}
```

**Response (Processing):**
```json
{
  "video_id": "abc123",
  "status": "processing",
  "message": "Video is being processed..."
}
```

### 2. Submit Transcript (Process Segments)

```http
POST /api/extension/submit-transcript
Content-Type: application/json

{
  "videoId": "abc123",
  "videoUrl": "https://youtube.com/watch?v=abc123",
  "videoTitle": "Video Title",
  "channelName": "Channel Name",
  "segments": [
    { "start": 0, "text": "Hello everyone..." },
    { "start": 5, "text": "Today we'll discuss..." }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "claimsExtracted": 2,
  "claims": [
    {
      "id": "uuid",
      "claim": "The unemployment rate is 3.7%",
      "speaker": "Unknown",
      "timestamp": 45,
      "status": "pending"
    }
  ]
}
```

### 3. Stream Claims (Real-time Updates)

```http
GET /api/extension/stream-claims?video_id=abc123
```

**SSE Messages:**

```
data: {"type":"connected","data":{"videoId":"abc123"}}

data: {"type":"claim","data":{"id":"uuid","claim":{...},"status":"pending"}}

data: {"type":"claim_update","data":{"id":"uuid","status":"verified","written_summary":"..."}}
```

## 🛠️ Configuration

### Extension Config

**For Development:**
```javascript
// background.js
const IS_PRODUCTION = false;
const API_BASE_URL = 'http://localhost:3000';
```

**For Production:**
```javascript
// background.js
const IS_PRODUCTION = true;
const API_BASE_URL = 'https://your-app.vercel.app';
```

### Backend Environment

```env
# .env.local
DATABASE_URL="postgresql://..."
OPENROUTER_API_KEY="sk-or-..."
PERPLEXITY_API_KEY="pplx-..."
```

## 🎨 Features Preserved

All original extension features are maintained:

✅ **Timeline Markers** - Color-coded dots on YouTube progress bar  
✅ **Claim Popups** - Appear at the right timestamp  
✅ **Morphing Animations** - Smooth UI transitions  
✅ **Interactive Overlays** - Click for detailed information  
✅ **Mock Mode** - For testing without backend  

## 🐛 Debugging

### Check Extension Logs

1. Go to `chrome://extensions/`
2. Find "YouTube Fact-Checker"
3. Click "service worker" to see background logs
4. Open any YouTube video and check page console for content script logs

### Check SSE Connection

1. Open Chrome DevTools → Network tab
2. Filter by "EventSource" or search for "stream-claims"
3. You should see an open connection with messages

### Check API Calls

1. DevTools → Network tab
2. Look for calls to `localhost:3000/api/extension/*`
3. Check request/response payloads

## 🔍 Common Issues

### "No transcript available"

- Video must have captions enabled
- Most popular videos have auto-generated captions
- Try a different video

### "Failed to connect to backend"

- Verify backend is running: `curl http://localhost:3000/api/extension/process-video?video_url=test`
- Check CORS settings (should be handled by Next.js)
- Verify `host_permissions` in `manifest.json`

### Claims not appearing

- Check browser console for errors
- Verify SSE connection in DevTools → Network
- Check backend logs for claim extraction errors

### Fact-checking stuck on "pending"

- Verify `PERPLEXITY_API_KEY` is valid
- Check backend logs for worker errors
- May take 10-30 seconds per claim

## 📊 Performance

- **Transcript Processing**: Videos processed in 60-second chunks
- **Claim Extraction**: ~2-3 seconds per chunk
- **Fact-Checking**: ~10-30 seconds per claim (runs in background)
- **Caching**: Previously analyzed videos load instantly

## 🚀 Deployment

### Deploy Backend to Vercel

```bash
# Push to GitHub
git push origin main

# Deploy with Vercel
vercel --prod
```

### Update Extension for Production

1. Get your Vercel URL (e.g., `https://fact-tube.vercel.app`)
2. Update `background.js`:
   ```javascript
   const IS_PRODUCTION = true;
   const API_BASE_URL = 'https://fact-tube.vercel.app';
   ```
3. Reload extension in Chrome

### Publish to Chrome Web Store (Optional)

1. Create a ZIP of the extension folder
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Upload and publish

## 📝 Next Steps

- [ ] Test with various YouTube videos
- [ ] Monitor API rate limits (OpenRouter, Perplexity)
- [ ] Add user authentication (optional)
- [ ] Customize claim categories
- [ ] Add more languages/captions support

## 🆘 Support

For issues:
1. Check this guide's troubleshooting section
2. Review browser console and network logs
3. Check backend logs: `pnpm dev`
4. Review the full README in `/public/chrome-extension/README.md`

---

**You're all set!** The extension is now fully integrated with your tRPC backend. Enjoy real-time fact-checking on YouTube! 🎉

