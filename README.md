# FactTube - Real-time YouTube Fact Checking

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)](https://nextjs.org/)

A real-time fact-checking application for YouTube videos that extracts claims as they're spoken and verifies them in the background.

**🎉 Open Source & Easy to Run**: No external database or cloud services required! Just clone, install, and run.

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
- **Database:** SQLite (local) or PostgreSQL/Neon (optional)
- **ORM:** Drizzle ORM
- **API:** tRPC with React Query
- **AI/ML:** 
  - OpenRouter (GPT-4o-mini) for claim extraction
  - Perplexity Sonar for fact-checking
- **Styling:** Tailwind CSS
- **Notifications:** Sonner Toast
- **Type Safety:** TypeScript

## 🚀 Getting Started

> **⚡ Want to get started in 2 minutes?** See [QUICKSTART.md](./QUICKSTART.md) for the fastest setup guide!

### Quick Start (No External Dependencies Required!)

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd fact-tube
   pnpm install
   ```

2. **Optional: Set up environment variables (for AI features)**
   ```bash
   cp env.example .env.local
   # Add your OPENROUTER_API_KEY if you want AI-powered fact-checking
   ```

3. **Start the dev server:**
   ```bash
   pnpm dev
   ```

That's it! The app will automatically:
- ✅ Create a local SQLite database in `./data/local.db`
- ✅ Initialize all tables automatically
- ✅ Work completely offline (except for AI features)

Visit [http://localhost:3000](http://localhost:3000) to start using it!

### Advanced Setup (Optional PostgreSQL)

If you want to use PostgreSQL/Neon instead of SQLite:

1. Create a database at [console.neon.tech](https://console.neon.tech/)
2. Add `DATABASE_URL` to your `.env.local`:
   ```env
   DATABASE_URL="postgresql://username:password@host/database?sslmode=require"
   ```
3. Push the schema:
   ```bash
   pnpm db:push
   ```

The app will automatically detect the `DATABASE_URL` and use PostgreSQL instead of SQLite.

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

All environment variables are **optional**! The app works out of the box with:
- Local SQLite database (no setup needed)
- Mock/demo mode for AI features (if no API keys provided)

### Optional Configuration

Create a `.env.local` file to customize:

```env
# Database (optional - uses SQLite by default)
# DATABASE_URL="postgresql://..."           # Use PostgreSQL/Neon instead

# AI Features (optional - for fact-checking)
# OPENROUTER_API_KEY="sk-or-..."           # OpenRouter API key
# PERPLEXITY_API_KEY="pplx-..."            # Perplexity API key

NODE_ENV="development"
```

See `env.example` for complete configuration options.

## 📚 Documentation

### Getting Started
- **[Quick Start](./QUICKSTART.md)** - Get running in 2 minutes
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project
- **[Database Guide](./DATABASE.md)** - SQLite vs PostgreSQL comparison

### Features & Setup
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

We welcome contributions! This project is designed to be easy to run locally with zero external dependencies.

**Quick Start for Contributors:**
```bash
git clone <your-repo-url>
cd fact-tube
pnpm install
pnpm dev  # That's it! 🎉
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

### Development Highlights

- 🏠 **Local-first**: Uses SQLite by default, no cloud setup needed
- 🔧 **Zero config**: Works out of the box
- 🎯 **Type-safe**: Full TypeScript and tRPC integration
- 🧪 **Easy testing**: Built-in dev tools and hot reload

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

Open source and free to use for personal and commercial projects.
