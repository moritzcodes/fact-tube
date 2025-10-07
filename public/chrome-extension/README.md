# YouTube Fact-Checker Chrome Extension

A Chrome extension that provides real-time fact-checking for YouTube videos with timestamp-based overlays and popups.

## ✨ Features

- 🎥 **Real-time Claim Extraction** - Automatically extracts fact-checkable claims from YouTube video transcripts
- ⚡ **Live Streaming Updates** - Receives claim updates via Server-Sent Events (SSE) as they're processed
- 🎯 **Timestamp Overlays** - Visual markers on the YouTube timeline showing where claims occur
- 💬 **Popup Notifications** - Contextual popups display claim verification status at the right moment
- 🗄️ **Intelligent Caching** - Previously analyzed videos load instantly from the database
- 🔍 **Perplexity-Powered Verification** - Claims are fact-checked using Perplexity Sonar AI with reliable sources

## 🚀 Installation

### Step 1: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `/public/chrome-extension` folder from your project

### Step 2: Configure Extension Settings

**New in v1.0:** The extension now has a settings popup for easy configuration!

1. Click on the FactTube extension icon in your Chrome toolbar
2. A settings popup will appear
3. Configure the following:
   - **OpenRouter API Key**: Get yours at [openrouter.ai/keys](https://openrouter.ai/keys)
   - **Backend URL**: 
     - Development: `http://localhost:3000` (default)
     - Production: Your deployed URL (e.g., `https://your-app.vercel.app`)
4. Click **Save Settings**
5. Click **Test Connection** to verify everything works

**Benefits:**
- ✅ No need to edit code files
- ✅ Users control their own API keys and costs
- ✅ Easy switching between development and production
- ✅ Secure local storage of credentials

See [SETTINGS.md](./SETTINGS.md) for detailed configuration guide.

### Step 3: Start Your Backend

Make sure your Next.js backend is running:

```bash
cd /path/to/fact-tube
pnpm dev
```

The backend should be accessible at `http://localhost:3000`

## 📖 How to Use

### Basic Usage

1. **Navigate to YouTube**: Go to any YouTube video (e.g., `https://www.youtube.com/watch?v=videoId`)

2. **Start Analysis**: Click the **Fact-Check** button that appears on the video page

3. **Watch in Real-Time**: 
   - Claims are extracted from the video transcript
   - Timeline markers appear showing where claims occur
   - As the video plays, popups show claim verification status
   - Claims are fact-checked in the background and update live

### Visual Indicators

The extension now displays real API status values with beautiful pill-shaped badges:

- **✓ Verified/True** (Green): Claims supported by reliable sources
- **✕ False** (Red): Claims contradicted by evidence  
- **⚠ Disputed** (Yellow): Claims with conflicting evidence
- **? Inconclusive** (Gray): Claims without sufficient evidence
- **− Neutral** (Gray): Neutral or subjective statements
- **⋯ Pending** (Blue): Claims still being fact-checked

Each status appears in a modern, pill-shaped badge with:
- Adaptive background and border colors
- Status-specific icons
- Glassmorphic design with backdrop blur
- Smooth animations and transitions

### Cached Results

If you revisit a previously analyzed video, the extension will:
- ✅ Load results instantly from the database
- 📊 Display all claims immediately
- 🗄️ Show a "Loaded from cache" notification

## 🏗️ Architecture

### Components

```
chrome-extension/
├── background.js           # Service worker: API calls, SSE connections, session management
├── content.core.js         # Main content script class
├── content.transcript.js   # YouTube transcript extraction
├── content.messaging.js    # Message handlers for real-time updates
├── content.overlay.js      # Timeline markers and overlay UI
├── content.player.js       # YouTube player integration
├── content.modals.js       # Popup modals for claim details
├── content.morph.js        # Morphing animations
├── content.mock.js         # Mock data (for testing)
├── content.updates.js      # UI updates and animations
├── content.utils.js        # Utility functions
├── config.js               # Configuration
├── bootstrap.js            # Initialization
└── manifest.json           # Extension manifest
```

### Data Flow

```
YouTube Video
    ↓
[Extension] Extracts transcript
    ↓
[Background Script] Chunks transcript into 60-second segments
    ↓
[Backend API] /api/extension/submit-transcript
    ↓
[AI Processing] GPT-4o-mini extracts claims
    ↓
[Database] Claims saved as "pending"
    ↓
[SSE Stream] /api/extension/stream-claims
    ↓
[Extension] Receives new claims in real-time
    ↓
[Fact-Checker Worker] Perplexity Sonar verifies claims
    ↓
[SSE Stream] Sends claim updates
    ↓
[Extension] Updates UI with verification status
```

## 🔌 API Endpoints

The extension communicates with three main endpoints:

### 1. Process Video
```
GET /api/extension/process-video?video_url={url}
```
- Checks if video has cached claims
- Returns existing claims or indicates processing needed

### 2. Submit Transcript
```
POST /api/extension/submit-transcript
Body: {
  videoId: string,
  videoUrl: string,
  videoTitle: string,
  channelName: string,
  segments: Array<{ start: number, text: string }>
}
```
- Processes transcript segments
- Extracts claims using AI
- Triggers background fact-checking

### 3. Stream Claims (SSE)
```
GET /api/extension/stream-claims?video_id={id}
```
- Opens Server-Sent Events connection
- Streams new claims as they're extracted
- Streams claim updates as fact-checking completes

## 🛠️ Configuration

### Environment Variables

The extension connects to your backend, which requires these environment variables:

```env
DATABASE_URL="postgresql://..."      # Neon database
OPENROUTER_API_KEY="sk-or-..."       # For claim extraction
PERPLEXITY_API_KEY="pplx-..."        # For fact-checking
```

### Extension Settings

Edit `background.js` to customize:

```javascript
// Switch between development and production
const IS_PRODUCTION = false;

// Enable/disable mock mode (for testing without API)
const MOCK_MODE = false;
```

## 🐛 Troubleshooting

### Extension doesn't connect to backend

1. Check that backend is running: `curl http://localhost:3000/api/extension/process-video?video_url=test`
2. Verify `background.js` has correct `API_BASE_URL`
3. Check browser console for CORS or network errors
4. Ensure `manifest.json` has correct `host_permissions`

### No transcript available

- Video must have captions/subtitles enabled
- YouTube auto-generated captions work
- Check browser console for transcript extraction errors

### Claims not updating

1. Check SSE connection in browser DevTools → Network → Type: eventsource
2. Verify database connection in backend logs
3. Check that OpenRouter and Perplexity API keys are valid

### Performance issues

- Extension processes videos in 60-second chunks
- Larger videos take longer but won't block the UI
- Claims appear incrementally as they're processed

## 📝 Development

### Testing Locally

1. Start the backend:
   ```bash
   pnpm dev
   ```

2. Load the extension in Chrome (see Installation)

3. Open Chrome DevTools and check:
   - **Console**: Extension logs
   - **Network**: API calls and SSE connections
   - **Application → Service Workers**: Background script status

### Debugging

Add debug logging in any content script:
```javascript
console.log('🐛 Debug:', yourVariable);
```

Background script logs appear in:
- `chrome://extensions/` → Click "service worker" link under your extension

## 🔐 Security

- Extension only runs on YouTube domains
- API calls are made through secure HTTPS (in production)
- No user data is collected or stored
- All fact-checking sources are cited and transparent

## 📄 License

MIT

## 🤝 Contributing

1. Make your changes
2. Test thoroughly with various YouTube videos
3. Update documentation if needed
4. Submit a pull request

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console logs
3. Check backend logs
4. Open an issue with reproduction steps

---

**Note**: This extension requires YouTube videos to have captions/subtitles enabled. Most popular videos have auto-generated captions that work perfectly with the extension.



