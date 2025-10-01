# FactTube - Real-time YouTube Fact Checking

A real-time fact-checking application for YouTube videos that extracts claims as they're spoken and verifies them in the background.

## ✨ Features

- 🎥 Real-time claim extraction from YouTube videos
- ⚡ Streaming transcript processing
- 🔍 Background fact-checking with source citations
- 🎯 Time-synced claim display during video playback
- 🔌 Chrome extension for seamless YouTube integration

## 🛠️ Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Neon (Serverless PostgreSQL)
- **ORM:** Drizzle ORM
- **API:** tRPC with React Query
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

2. **Set up your Neon database:**
   - Create a project at [console.neon.tech](https://console.neon.tech/)
   - Copy `env.example` to `.env.local`
   - Add your `DATABASE_URL`

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
│   ├── api/trpc/            # tRPC API endpoints
│   ├── layout.tsx           # Root layout with providers
│   └── page.tsx             # Home page
├── lib/
│   ├── db/                  # Database schema and connection
│   ├── trpc/                # tRPC routers and configuration
│   └── env.ts               # Type-safe environment variables
├── public/
│   └── chrome-extension/    # Chrome extension files
└── drizzle.config.ts        # Drizzle ORM configuration
```

## 🗃️ Database Schema

- **Claims:** Extracted claims with timestamps, verification status, and sources
- **Videos:** YouTube video metadata
- **Transcript Segments:** Processed transcript chunks

## 🔌 API Routes (tRPC)

All routes are fully type-safe with end-to-end TypeScript:

- `claims.*` - Claim extraction and verification
- `videos.*` - Video metadata management
- `transcripts.*` - Transcript segment processing

See [SETUP.md](./SETUP.md) for complete API documentation.

## 🎯 Development Status

### ✅ Completed
- [x] Next.js 15 setup with App Router
- [x] Neon database integration
- [x] Drizzle ORM schema
- [x] tRPC with React Query
- [x] Type-safe API routes
- [x] Database migrations
- [x] Toast notifications

### 🚧 In Progress
- [ ] Chrome extension integration
- [ ] Claim extraction API
- [ ] Fact-checking worker
- [ ] Real-time streaming (SSE/WebSocket)
- [ ] Frontend UI components

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
DATABASE_URL="postgresql://..."  # Your Neon database URL
NODE_ENV="development"
```

## 📚 Documentation

- [Setup Guide](./SETUP.md) - Detailed setup and usage instructions
- [Project Requirements](./Project.md) - Original project specifications

## 🤝 Contributing

This project is currently in development. See [Project.md](./Project.md) for the implementation roadmap.

## 📄 License

MIT
