# FactTube Quick Start Guide

Get up and running with FactTube in 5 minutes!

## Prerequisites

- Chrome browser
- Node.js 18+ and pnpm installed
- OpenRouter API key (free to get at [openrouter.ai](https://openrouter.ai))

## Step 1: Setup Backend (2 minutes)

```bash
# Clone and install
git clone <your-repo>
cd fact-tube
pnpm install

# Configure environment
cp env.example .env.local
# Edit .env.local and add:
# - DATABASE_URL (get from neon.tech)
# - PERPLEXITY_API_KEY (get from perplexity.ai)
# - OPENROUTER_API_KEY (optional, for dev testing)

# Setup database
pnpm db:push

# Start development server
pnpm dev
```

Your backend should now be running at `http://localhost:3000`

## Step 2: Install Chrome Extension (1 minute)

```bash
# In Chrome browser:
1. Go to chrome://extensions/
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the folder: /path/to/fact-tube/public/chrome-extension
```

## Step 3: Configure Extension (1 minute)

```bash
1. Click the FactTube extension icon in Chrome toolbar
2. In the settings popup:
   - Paste your OpenRouter API key (get from openrouter.ai/keys)
   - Keep backend URL as: http://localhost:3000
3. Click "Save Settings"
4. Click "Test Connection" to verify
```

## Step 4: Test It! (1 minute)

```bash
1. Visit any YouTube video
2. Click the "Fact-Check" button that appears
3. Watch as claims are extracted and fact-checked in real-time!
```

## What to Expect

### First Video (New Analysis)
- ⏱️ Takes 30-60 seconds to analyze
- 🔄 Shows loading spinner
- 📊 Claims appear as they're extracted
- ✅ Fact-checks complete in background
- 💾 Results are cached for instant loading next time

### Cached Video (Previously Analyzed)
- ⚡ Loads instantly (< 1 second)
- 📦 All claims pre-loaded from database
- 🎯 Timeline markers already positioned
- ✨ Ready to use immediately

## Features to Try

### Timeline Markers
- Colored dots on YouTube timeline show where claims appear
- Green = verified, Red = false, Gray = disputed/inconclusive
- Click to jump to that timestamp

### Claim Popups
- Appear automatically when claim is spoken in video
- Show claim text, verification status, and sources
- Click sources to read more
- Close automatically or manually

### Fact-Check Details
- View AI-powered verification
- See source bias ratings
- Read evidence from reliable sources
- Check reasoning behind verdicts

## Common Issues

### "API key is required" Error
✅ **Solution**: Make sure you saved your API key in extension settings

### Extension button not appearing
✅ **Solution**: Refresh the YouTube page after installing extension

### "Connection failed" when testing
✅ **Solution**: Verify backend is running with `pnpm dev`

### No claims found
✅ **Reasons**: 
- Video has no captions/subtitles
- Video contains no fact-checkable claims
- Try a news or educational video instead

## Development Tips

### View Extension Logs
```bash
# Right-click extension icon → "Inspect"
# Or check YouTube page console (F12)
```

### View Backend Logs
```bash
# Terminal where you ran `pnpm dev`
# Watch for API calls and processing steps
```

### Clear Cache
```bash
# To re-analyze a video:
# Delete claims from database using Drizzle Studio
pnpm db:studio
```

## Next Steps

- ✅ Read [CHROME_EXTENSION_SETUP.md](./CHROME_EXTENSION_SETUP.md) for detailed docs
- ✅ Check [SETTINGS.md](./public/chrome-extension/SETTINGS.md) for settings guide
- ✅ Review [FACT_CHECKING.md](./FACT_CHECKING.md) for how fact-checking works
- ✅ Deploy to production (Vercel + update extension settings)

## Need Help?

- 📖 Check the [main README](./README.md)
- 🐛 Open an issue on GitHub
- 💬 Review the documentation files

## Production Deployment

When ready to go live:

1. **Deploy Backend**
   ```bash
   # Deploy to Vercel
   vercel deploy --prod
   # Get your production URL: https://your-app.vercel.app
   ```

2. **Update Extension**
   - Users update backend URL in settings to your production URL
   - Each user provides their own OpenRouter API key
   - No code changes needed!

3. **Publish Extension** (optional)
   - Package extension as .zip
   - Submit to Chrome Web Store
   - Add setup instructions for users

---

**Ready to fact-check YouTube!** 🎉

