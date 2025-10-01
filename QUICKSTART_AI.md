# 🚀 Quick Start - AI Claim Extraction

## 1. Get Your API Key (2 minutes)
1. Go to [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up/login
3. Create a new API key
4. Copy it (starts with `sk-or-v1-...`)

## 2. Configure (30 seconds)
```bash
# Copy the example env file
cp env.example .env.local

# Edit .env.local and add your key:
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
```

## 3. Run (1 minute)
```bash
# Install dependencies (if not already done)
pnpm install

# Start the dev server
pnpm dev
```

## 4. Test (2 minutes)
1. Open [http://localhost:3000](http://localhost:3000)
2. Enter video ID: `jNQXAC9IVRw` (or click "Try example video")
3. Click **Fetch Transcript**
4. Click **Extract Claims with AI**
5. Watch the magic happen! ✨

## That's It! 🎉

You should see:
- ✅ Progress bar showing chunk processing
- ✅ Claims appearing in real-time
- ✅ Timestamps, speakers, and status badges
- ✅ Toast notifications for each chunk

## What's Happening?

```
YouTube Video → Transcript → Chunk (60s) → GPT-4o-mini → Claims → Database
```

Each claim includes:
- 📝 The factual statement
- 👤 Speaker name (if detected)
- ⏱️ Exact timestamp
- 🏷️ Status (pending/verified/false)

## Need Help?

- Full setup guide: `OPENROUTER_SETUP.md`
- Technical details: `AI_INTEGRATION_SUMMARY.md`
- OpenRouter docs: [https://openrouter.ai/docs](https://openrouter.ai/docs)

## Cost?

Super cheap! ~$0.001-0.005 per 10-minute video 💰

---

**Ready to fact-check the world!** 🌍

