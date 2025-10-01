# FactTube Setup Guide

This project has been configured with **Neon Database**, **Drizzle ORM**, and **tRPC** for type-safe API development.

## 🚀 Quick Start

### 1. Set Up Neon Database

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project
3. Copy your connection string (it looks like: `postgresql://username:password@host/database?sslmode=require`)

### 2. Configure Environment Variables

```bash
cp env.example .env.local
```

Edit `.env.local` and add your Neon database URL:

```env
DATABASE_URL="postgresql://username:password@host/database?sslmode=require"
```

### 3. Push Database Schema

```bash
pnpm db:push
```

This will create all the tables in your Neon database based on the schema defined in `lib/db/schema.ts`.

### 4. Start Development Server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app!

## 📁 Project Structure

```
fact-tube/
├── app/
│   ├── api/
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts          # tRPC API endpoint
│   ├── layout.tsx                    # Root layout with TRPCProvider
│   └── page.tsx                      # Home page with setup status
├── lib/
│   ├── db/
│   │   ├── schema.ts                 # Database schema (Drizzle)
│   │   └── index.ts                  # Database connection
│   └── trpc/
│       ├── index.ts                  # Main tRPC router
│       ├── init.ts                   # tRPC initialization
│       ├── context.ts                # tRPC context
│       ├── client.ts                 # Server-side tRPC client
│       ├── react.tsx                 # Client-side tRPC hooks & provider
│       └── routers/
│           ├── claims.ts             # Claims endpoints
│           ├── videos.ts             # Videos endpoints
│           └── transcripts.ts        # Transcript segments endpoints
└── drizzle.config.ts                 # Drizzle Kit configuration
```

## 🗃️ Database Schema

The project includes three main tables:

### Claims
Stores fact-check claims extracted from videos with timestamps.

```typescript
{
  id: uuid,
  videoId: string,
  claim: string,
  speaker: string,
  timestamp: number,      // in seconds
  status: enum,           // pending, verified, false, partially_true, unverifiable
  verdict: string,
  sources: string,        // JSON
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Videos
Stores YouTube video metadata.

```typescript
{
  id: string,            // YouTube video ID
  title: string,
  channelName: string,
  publishedAt: timestamp,
  duration: number,      // in seconds
  createdAt: timestamp
}
```

### Transcript Segments
Stores processed transcript chunks.

```typescript
{
  id: uuid,
  videoId: string,
  text: string,
  startTime: number,     // in seconds
  endTime: number,       // in seconds
  processed: timestamp,
  createdAt: timestamp
}
```

## 🔌 tRPC API Routes

### Claims Router

```typescript
// Get all claims for a video
trpc.claims.getByVideoId.useQuery({ videoId: 'xyz' });

// Get claim by ID
trpc.claims.getById.useQuery({ id: 'uuid' });

// Create a claim
trpc.claims.create.useMutation({
  videoId: 'xyz',
  claim: 'Some claim',
  speaker: 'Speaker name',
  timestamp: 123
});

// Update claim status
trpc.claims.updateStatus.useMutation({
  id: 'uuid',
  status: 'verified',
  verdict: 'This claim is true',
  sources: JSON.stringify([...])
});

// Get claims by time range
trpc.claims.getByTimeRange.useQuery({
  videoId: 'xyz',
  startTime: 0,
  endTime: 300
});
```

### Videos Router

```typescript
// Get video by ID
trpc.videos.getById.useQuery({ id: 'youtube-video-id' });

// Create or update video
trpc.videos.upsert.useMutation({
  id: 'youtube-video-id',
  title: 'Video Title',
  channelName: 'Channel Name',
  publishedAt: new Date(),
  duration: 3600
});

// Get all videos
trpc.videos.getAll.useQuery();
```

### Transcripts Router

```typescript
// Create transcript segment
trpc.transcripts.create.useMutation({
  videoId: 'xyz',
  text: 'Transcript text...',
  startTime: 0,
  endTime: 60
});

// Mark segment as processed
trpc.transcripts.markProcessed.useMutation({ id: 'uuid' });

// Get unprocessed segments
trpc.transcripts.getUnprocessed.useQuery({ videoId: 'xyz' });

// Get all segments for a video
trpc.transcripts.getByVideoId.useQuery({ videoId: 'xyz' });
```

## 🛠️ Available Scripts

```bash
# Development
pnpm dev              # Start dev server

# Database
pnpm db:generate      # Generate migration files
pnpm db:push          # Push schema changes to database
pnpm db:studio        # Open Drizzle Studio (database GUI)
pnpm db:migrate       # Run migrations

# Build
pnpm build            # Build for production
pnpm start            # Start production server

# Linting
pnpm lint             # Run ESLint
```

## 🎯 Usage in Components

### Client Components

```tsx
'use client';

import { trpc } from '@/lib/trpc/react';

export default function MyComponent() {
  // Query
  const { data, isLoading, error } = trpc.videos.getAll.useQuery();
  
  // Mutation
  const createClaim = trpc.claims.create.useMutation({
    onSuccess: (data) => {
      console.log('Claim created:', data);
    }
  });

  const handleSubmit = () => {
    createClaim.mutate({
      videoId: 'abc123',
      claim: 'Test claim',
      timestamp: 100
    });
  };

  return (
    // Your component JSX
  );
}
```

### Server Components

```tsx
import { trpcClient } from '@/lib/trpc/client';

export default async function ServerComponent() {
  const videos = await trpcClient.videos.getAll.query();
  
  return (
    // Your component JSX
  );
}
```

## 🔒 Type Safety

All tRPC routes are fully type-safe! TypeScript will autocomplete:
- Available routes
- Input parameters
- Return types
- Error types

No need to manually type API responses!

## 📝 Next Steps

1. ✅ Database and tRPC setup complete
2. Implement authentication (if needed)
3. Create API endpoints for claim extraction
4. Implement fact-checking worker
5. Build Chrome extension integration
6. Add real-time updates with Server-Sent Events or WebSockets

## 🆘 Troubleshooting

### Database Connection Error

Make sure:
- Your `DATABASE_URL` in `.env.local` is correct
- Your Neon project is active
- You've run `pnpm db:push` to create tables

### tRPC Type Errors

If you see type errors:
1. Restart your TypeScript server in your IDE
2. Delete `.next` folder and rebuild: `rm -rf .next && pnpm dev`

## 📚 Resources

- [Neon Documentation](https://neon.tech/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [tRPC Documentation](https://trpc.io/)
- [Next.js 15 Documentation](https://nextjs.org/docs)


