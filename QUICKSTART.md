# ⚡ Quick Start Guide

Get FactTube running in **under 2 minutes** with zero configuration!

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/fact-tube.git
cd fact-tube

# Install dependencies (takes ~1 minute)
pnpm install

# Start the development server
pnpm dev
```

That's it! Open [http://localhost:3000](http://localhost:3000) and you're ready to go! 🎉

## ✨ What Just Happened?

When you ran `pnpm dev`, FactTube automatically:

1. ✅ Created a local SQLite database at `./data/local.db`
2. ✅ Initialized all required tables (videos, claims, transcripts)
3. ✅ Started the Next.js development server
4. ✅ Enabled hot-reload for instant feedback

**No database setup. No API keys. No cloud services. Just code.**

## 🧪 Try It Out

### Option 1: Use the Web Interface

1. Visit [http://localhost:3000](http://localhost:3000)
2. Enter a YouTube video URL
3. See claims extracted in real-time!

### Option 2: Use the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the folder: `YOUR_PROJECT_PATH/public/chrome-extension`
5. Click the extension icon to configure:
   - Backend URL: `http://localhost:3000`
   - (Optional) Add your OpenRouter API key
6. Visit any YouTube video and click **"Fact-Check"**!

## 🔧 Configuration (Optional)

FactTube works perfectly without any configuration, but you can customize it:

### Add AI Fact-Checking

Create `.env.local` in the project root:

```env
# Get a free API key from: https://openrouter.ai/keys
OPENROUTER_API_KEY="sk-or-v1-YOUR-KEY-HERE"
```

Restart the dev server:
```bash
# Ctrl+C to stop, then:
pnpm dev
```

Now you'll get AI-powered fact-checking with sources!

### Use PostgreSQL (Advanced)

Want to use PostgreSQL instead of SQLite?

1. Create a free database at [console.neon.tech](https://console.neon.tech/)
2. Add to `.env.local`:
   ```env
   DATABASE_URL="postgresql://username:password@host/database?sslmode=require"
   ```
3. Push the schema:
   ```bash
   pnpm db:push
   ```

The app automatically detects `DATABASE_URL` and switches to PostgreSQL.

## 📊 Viewing Your Data

### SQLite (Default)

**Option 1: Drizzle Studio (Recommended)**
```bash
pnpm db:studio
```

Opens a beautiful web UI at [http://localhost:4983](http://localhost:4983)

**Option 2: SQLite CLI**
```bash
sqlite3 data/local.db
sqlite> SELECT * FROM videos;
sqlite> SELECT * FROM claims;
sqlite> .quit
```

### PostgreSQL

```bash
pnpm db:studio
```

## 🛠️ Useful Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Run production build
pnpm lint             # Check code quality

# Database (PostgreSQL only)
pnpm db:push          # Push schema changes
pnpm db:studio        # Open database UI
pnpm db:generate      # Generate migrations
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database Locked (SQLite)

This happens if you have multiple processes accessing the database.

```bash
# Stop the dev server (Ctrl+C)
# Remove the database
rm data/local.db
# Restart
pnpm dev
```

### Extension Not Loading

1. Make sure dev server is running (`pnpm dev`)
2. Check extension settings (click extension icon):
   - Backend URL: `http://localhost:3000` (no trailing slash)
3. Reload the extension:
   - Go to `chrome://extensions/`
   - Click the reload icon on FactTube
4. Refresh the YouTube page

### Claims Not Showing Up

**Without API Key:**
- Claims are extracted from transcripts but not fact-checked
- This is normal! Add an `OPENROUTER_API_KEY` for AI features

**With API Key:**
- Check the browser console (F12) for errors
- Check the server logs in your terminal
- Make sure your API key is valid

## 📚 Next Steps

- **Read the full [README.md](./README.md)** for features and architecture
- **Check [CONTRIBUTING.md](./CONTRIBUTING.md)** to start contributing
- **Explore the code** - it's well-documented and type-safe!
- **Join discussions** - Share ideas and feedback

## 💡 Tips for Development

1. **Hot Reload**: Edit any file and see changes instantly
2. **Type Safety**: TypeScript catches errors as you code
3. **Database Browser**: Use `pnpm db:studio` to inspect data
4. **Console Logs**: Check terminal and browser console for debugging
5. **Git Branches**: Create feature branches for your changes

## 🎯 Common Use Cases

### Testing the API

```bash
# Start the server
pnpm dev

# In another terminal, test the API:
curl http://localhost:3000/api/extension/process-video?videoId=dQw4w9WgXcQ
```

### Resetting Everything

```bash
# Stop the server (Ctrl+C)
# Remove database
rm -rf data
# Clear Next.js cache
rm -rf .next
# Restart fresh
pnpm dev
```

### Adding a New Feature

```bash
# Create a feature branch
git checkout -b feature/my-awesome-feature

# Make your changes
# ...

# Test locally
pnpm dev

# Commit and push
git add .
git commit -m "feat: add my awesome feature"
git push origin feature/my-awesome-feature
```

## 🎉 You're All Set!

You now have a fully functional fact-checking system running locally. Start coding, experimenting, and contributing!

**Questions?** Open an issue or start a discussion on GitHub.

**Happy coding!** 🚀
