# Quick Reference Guide

## 🎯 Common tRPC Usage Patterns

### In Client Components ('use client')

```tsx
'use client';
import { trpc } from '@/lib/trpc/react';
import { toast } from 'sonner';

export default function MyComponent() {
  // Query example
  const { data, isLoading, error } = trpc.videos.getById.useQuery({
    id: 'video-id'
  });

  // Mutation example
  const createClaim = trpc.claims.create.useMutation({
    onSuccess: () => {
      toast.success('Claim created!');
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const handleCreate = () => {
    createClaim.mutate({
      videoId: 'xyz',
      claim: 'Some claim text',
      timestamp: 120
    });
  };

  return <div>{/* Your JSX */}</div>;
}
```

### In Server Components

```tsx
import { trpcClient } from '@/lib/trpc/client';

export default async function ServerComponent() {
  const videos = await trpcClient.videos.getAll.query();
  
  return <div>{/* Your JSX */}</div>;
}
```

### In API Routes

```tsx
import { trpcClient } from '@/lib/trpc/client';

export async function GET(request: Request) {
  const claims = await trpcClient.claims.getByVideoId.query({
    videoId: 'xyz'
  });
  
  return Response.json(claims);
}
```

## 🗃️ Database Operations

### Query with Drizzle (if you need raw SQL)

```tsx
import { db, claims } from '@/lib/db';
import { eq } from 'drizzle-orm';

// Select
const results = await db.select().from(claims).where(eq(claims.videoId, 'xyz'));

// Insert
const newClaim = await db.insert(claims).values({...}).returning();

// Update
const updated = await db.update(claims).set({...}).where(eq(claims.id, id)).returning();

// Delete
await db.delete(claims).where(eq(claims.id, id));
```

## 🎨 Toast Notifications

```tsx
import { toast } from 'sonner';

// Success
toast.success('Operation completed!');

// Error
toast.error('Something went wrong');

// Loading
const toastId = toast.loading('Processing...');
// Later...
toast.success('Done!', { id: toastId });

// Custom
toast('Custom message', {
  description: 'Additional details',
  duration: 5000,
});
```

## 🔧 Database Commands

```bash
# Push schema changes (development)
pnpm db:push

# Generate migration files
pnpm db:generate

# Apply migrations (production)
pnpm db:migrate

# Open database GUI
pnpm db:studio
```

## 🐛 Debugging

### Check Database Connection

```tsx
'use client';
import { trpc } from '@/lib/trpc/react';

export default function TestConnection() {
  const { data, error } = trpc.videos.getAll.useQuery();
  
  if (error) return <div>Error: {error.message}</div>;
  return <div>Connected! Found {data?.length} videos</div>;
}
```

### Enable tRPC Logging

The tRPC endpoint already logs errors in development mode (see `app/api/trpc/[trpc]/route.ts`).

### Check Environment Variables

```tsx
import { env } from '@/lib/env';

console.log('Database URL configured:', !!env.DATABASE_URL);
```

## 📦 Adding New Tables

1. **Define schema** in `lib/db/schema.ts`:
   ```tsx
   export const myTable = pgTable("my_table", {
     id: uuid("id").defaultRandom().primaryKey(),
     name: text("name").notNull(),
   });
   ```

2. **Push to database**:
   ```bash
   pnpm db:push
   ```

3. **Create tRPC router** in `lib/trpc/routers/myRouter.ts`:
   ```tsx
   export const myRouter = router({
     getAll: publicProcedure.query(async ({ ctx }) => {
       return await ctx.db.select().from(myTable);
     }),
   });
   ```

4. **Add to main router** in `lib/trpc/index.ts`:
   ```tsx
   export const appRouter = router({
     // ... existing routes
     myResource: myRouter,
   });
   ```

## 🚀 Deployment Checklist

- [ ] Set `DATABASE_URL` in production environment
- [ ] Run `pnpm db:push` or `pnpm db:migrate` on production database
- [ ] Verify environment variables are set
- [ ] Test database connection in production
- [ ] Check that WebSocket configuration works in production

## 💡 Pro Tips

1. **Type Safety**: Let TypeScript autocomplete guide you - all tRPC routes are fully typed!
2. **React Query**: Use `refetchOnWindowFocus: false` to prevent unnecessary refetches
3. **Mutations**: Always invalidate related queries after mutations for consistent UI
4. **Error Handling**: Zod validation errors are automatically formatted in tRPC responses
5. **Performance**: Use `trpc.useQueries()` for parallel queries

## 🔗 Helpful Links

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [tRPC Docs](https://trpc.io/)
- [Neon Docs](https://neon.tech/docs)
- [React Query Docs](https://tanstack.com/query/latest)


