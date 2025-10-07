# FactTube - Real-time YouTube Fact Checking

A real-time fact-checking application for YouTube videos that extracts claims as they're spoken and verifies them in the background.

## ✨ Features

- 🎥 Real-time claim extraction from YouTube videos
- ⚡ Streaming transcript processing
- 🔍 **Automated fact-checking with Perplexity Sonar** - Using AI-powered research with reliable sources
- ✅ Claims categorized as: verified, false, disputed, or inconclusive
- 📚 Only uses data-driven and renowned sources (academic, government, reputable news)
- 🎯 Time-synced claim display during video playback
- 🔌 Chrome extension for seamless YouTube integration

## 🛠️ Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Neon (Serverless PostgreSQL)
- **ORM:** Drizzle ORM
- **API:** tRPC with React Query
- **AI/ML:** 
  - OpenRouter (GPT-4o-mini) for claim extraction
  - Perplexity Sonar for fact-checking
- **Styling:** Tailwind CSS
- **Notifications:** Sonner Toast
- **Type Safety:** TypeScript

## 🚀 Getting Started

See [SETUP.md](./SETUP.md) for detailed setup instructions.

### Quick Start

1. **Clone and install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   - Create a project at [console.neon.tech](https://console.neon.tech/)
   - Get API keys from [OpenRouter](https://openrouter.ai/keys) and [Perplexity](https://www.perplexity.ai/settings/api)
   - Copy `env.example` to `.env.local`
   - Add your `DATABASE_URL`, `OPENROUTER_API_KEY`, and `PERPLEXITY_API_KEY`

3. **Push database schema:**
   ```bash
   pnpm db:push
   ```

4. **Start the dev server:**
   ```bash
   pnpm dev
   ```

Visit [http://localhost:3000](http://localhost:3000) to verify setup!

## 📁 Project Structure

```
fact-tube/
├── app/                      # Next.js App Router
│   ├── api/
│   │   ├── trpc/            # tRPC API endpoints
│   │   └── fact-check/      # Fact-checking REST endpoints
│   ├── layout.tsx           # Root layout with providers
│   └── page.tsx             # Home page
├── lib/
│   ├── db/                  # Database schema and connection
│   ├── trpc/                # tRPC routers and configuration
│   ├── workers/             # Background workers (fact-checker)
│   └── env.ts               # Type-safe environment variables
├── public/
│   └── chrome-extension/    # Chrome extension files
└── drizzle.config.ts        # Drizzle ORM configuration
```

## 🗃️ Database Schema

- **Claims:** Extracted claims with timestamps, verification status, and sources
- **Videos:** YouTube video metadata
- **Transcript Segments:** Processed transcript chunks

## 🔌 API Routes

### tRPC Routes (Type-safe)

All routes are fully type-safe with end-to-end TypeScript:

- `claims.*` - Claim extraction and verification
- `videos.*` - Video metadata management
- `transcripts.*` - Transcript segment processing
- `ai.*` - AI-powered claim extraction

### Chrome Extension REST APIs

Special endpoints for the chrome extension:

- `GET /api/extension/process-video` - Check for cached claims
- `POST /api/extension/submit-transcript` - Submit transcript segments
- `GET /api/extension/stream-claims` - SSE stream for real-time updates

See [CHROME_EXTENSION_SETUP.md](./CHROME_EXTENSION_SETUP.md) for detailed documentation.

## 🎯 Development Status

### ✅ Completed
- [x] Next.js 15 setup with App Router
- [x] Neon database integration
- [x] Drizzle ORM schema
- [x] tRPC with React Query
- [x] Type-safe API routes
- [x] Database migrations
- [x] Toast notifications

### ✅ Completed (Phase 2)
- [x] Claim extraction API with OpenRouter
- [x] **Automated fact-checking worker with Perplexity Sonar**
- [x] Real-time streaming updates (SSE)
- [x] tRPC routes for fact-checking
- [x] Source quality validation

### ✅ Completed (Phase 3 - Chrome Extension)
- [x] Chrome extension integration with streaming support
- [x] Real-time claim updates via Server-Sent Events (SSE)
- [x] YouTube transcript extraction
- [x] Timeline overlays and claim popups
- [x] Database caching for instant loading

### 🚧 In Progress
- [ ] Frontend UI components (web dashboard)
- [ ] User authentication
- [ ] Analytics and usage tracking

## 📝 Scripts

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint

# Database commands
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Drizzle Studio
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
```

## 🔒 Environment Variables

Create a `.env.local` file with:

```env
DATABASE_URL="postgresql://..."           # Your Neon database URL
OPENROUTER_API_KEY="sk-or-..."           # OpenRouter API key for claim extraction
PERPLEXITY_API_KEY="pplx-..."            # Perplexity API key for fact-checking
NODE_ENV="development"
```

See `env.example` for complete configuration options.

## 📚 Documentation

- **[Chrome Extension Setup](./CHROME_EXTENSION_SETUP.md)** - Complete guide to setting up the extension
- [Fact-Checking Setup](./SETUP_FACT_CHECKING.md) - Quick guide to set up fact-checking
- [Fact-Checking Documentation](./FACT_CHECKING.md) - Detailed fact-checking system docs
- [Project Requirements](./Project.md) - Original project specifications
- [Improvements](./IMPROVEMENTS.md) - Changelog and improvements

### Chrome Extension

The Chrome extension provides real-time fact-checking directly on YouTube:

```bash
# Load the extension
1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select /public/chrome-extension

# Configure settings
5. Click the extension icon to open settings
6. Add your OpenRouter API key (get one at openrouter.ai/keys)
7. Configure backend URL (default: http://localhost:3000)
8. Click "Save Settings"

# Test the extension
9. Start backend: pnpm dev
10. Visit any YouTube video
11. Click "Fact-Check" button
```

**Important for Production:** Users must configure their own OpenRouter API key in the extension settings. This gives users full control over their API usage and costs.

See [CHROME_EXTENSION_SETUP.md](./CHROME_EXTENSION_SETUP.md) for detailed instructions and [public/chrome-extension/SETTINGS.md](./public/chrome-extension/SETTINGS.md) for the settings guide.

## 🤝 Contributing

This project is currently in development. See [Project.md](./Project.md) for the implementation roadmap.

## 📄 License

MIT
