# Database Guide

FactTube supports two database options: **SQLite** (default) and **PostgreSQL** (optional).

## 🎯 Quick Comparison

| Feature | SQLite (Default) | PostgreSQL |
|---------|-----------------|------------|
| **Setup Time** | 0 seconds | ~5 minutes |
| **External Dependencies** | None | Cloud database |
| **Cost** | Free | Free tier available (Neon) |
| **Performance** | Great for dev | Better for production |
| **Best For** | Local development, testing | Production, multiple users |
| **Data Storage** | Local file (`./data/local.db`) | Cloud database |
| **Backup** | Copy `.db` file | Database snapshots |
| **Multi-user** | Single connection | Multiple connections |

## 📊 SQLite (Default)

### ✅ Advantages

- **Zero Setup**: Works immediately, no configuration needed
- **Local-First**: All data stored on your machine
- **Perfect for Development**: Fast, simple, no network latency
- **Easy Backup**: Just copy the `./data/local.db` file
- **Portable**: Move the `.db` file to any machine
- **No External Dependencies**: No internet, no cloud accounts

### ⚠️ Limitations

- **Single Writer**: One process writes at a time (fine for dev)
- **File-Based**: Not ideal for distributed systems
- **Size Limits**: Works great up to several GB

### 🚀 Usage

**Automatic!** Just run:
```bash
pnpm dev
```

The database is created automatically at `./data/local.db`

### 📂 Database Location

```
fact-tube/
└── data/
    ├── local.db          # Main database file
    ├── local.db-shm      # Shared memory file (temp)
    └── local.db-wal      # Write-ahead log (temp)
```

### 🔍 Viewing Data

**Option 1: Drizzle Studio** (Recommended)
```bash
pnpm db:studio
```

**Option 2: SQLite CLI**
```bash
sqlite3 data/local.db

# List tables
.tables

# View videos
SELECT * FROM videos;

# View claims
SELECT * FROM claims LIMIT 10;

# Exit
.quit
```

### 💾 Backup & Restore

**Backup:**
```bash
# Copy the database file
cp data/local.db data/backup-$(date +%Y%m%d).db
```

**Restore:**
```bash
# Replace with backup
cp data/backup-20250101.db data/local.db
```

### 🗑️ Reset Database

```bash
# Stop the server (Ctrl+C)
rm data/local.db
pnpm dev  # Creates fresh database
```

## 🐘 PostgreSQL (Optional)

### ✅ Advantages

- **Production-Ready**: Built for high-traffic applications
- **Advanced Features**: Full-text search, JSON columns, etc.
- **Concurrent Access**: Multiple connections simultaneously
- **Cloud Hosting**: Automated backups and scaling
- **Better for Deployment**: Vercel, Railway, etc.

### ⚠️ Requirements

- **External Service**: Requires cloud database (Neon, Supabase, etc.)
- **Setup Time**: ~5 minutes to create and configure
- **Internet Required**: Needs network connection
- **API Keys**: Database URL must be configured

### 🚀 Setup

**1. Create a Database**

Choose a provider (all have free tiers):

- **[Neon](https://console.neon.tech/)** - Serverless PostgreSQL (Recommended)
- **[Supabase](https://supabase.com/)** - PostgreSQL with extras
- **[Railway](https://railway.app/)** - Easy deployment platform

**2. Get Connection String**

After creating a database, you'll get a URL like:
```
postgresql://username:password@hostname/database?sslmode=require
```

**3. Configure FactTube**

Create `.env.local`:
```env
DATABASE_URL="postgresql://your-connection-string"
```

**4. Push Schema**
```bash
pnpm db:push
```

**Done!** The app automatically detects `DATABASE_URL` and uses PostgreSQL.

### 🔍 Viewing Data

```bash
pnpm db:studio
```

Opens Drizzle Studio with your PostgreSQL data.

### 💾 Backup & Restore

**Using Neon Dashboard:**
1. Go to your project dashboard
2. Navigate to "Backups"
3. Create or restore snapshots

**Using pg_dump:**
```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## 🔄 Switching Databases

### SQLite → PostgreSQL

```bash
# 1. Export data from SQLite (if needed)
sqlite3 data/local.db .dump > dump.sql

# 2. Add DATABASE_URL to .env.local
echo 'DATABASE_URL="postgresql://..."' >> .env.local

# 3. Push schema to PostgreSQL
pnpm db:push

# 4. Restart server
pnpm dev
```

### PostgreSQL → SQLite

```bash
# 1. Remove DATABASE_URL from .env.local
# (or just delete .env.local)

# 2. Restart server - SQLite will be used automatically
pnpm dev
```

## 📊 Schema Management

### SQLite

Tables are automatically created on first run. No migration needed!

If you modify `lib/db/schema.ts`, you may need to:
```bash
# Reset database
rm data/local.db
pnpm dev
```

### PostgreSQL

Use Drizzle Kit for schema changes:

```bash
# Generate migration
pnpm db:generate

# Push changes to database
pnpm db:push

# Or run migration
pnpm db:migrate
```

## 🧪 Testing Both Databases

Good practice: test your changes with both databases.

**Test with SQLite:**
```bash
# Remove .env.local (or rename it)
mv .env.local .env.local.backup
pnpm dev
# ... test your features ...
```

**Test with PostgreSQL:**
```bash
# Restore .env.local
mv .env.local.backup .env.local
pnpm dev
# ... test your features ...
```

## 🎯 Recommendations

### Use SQLite If You're:

- 👨‍💻 Developing locally
- 🧪 Testing features
- 📚 Learning the codebase
- 🏃 Want to start immediately
- 💻 Working on a single machine

### Use PostgreSQL If You're:

- 🚀 Deploying to production
- 👥 Expecting multiple users
- ☁️ Using Vercel/Railway/etc.
- 🔄 Need replication/backups
- 📈 Planning to scale

## ❓ FAQ

**Q: Can I use MySQL instead?**
A: Not currently, but you could add support by modifying `lib/db/index.ts`.

**Q: Will my SQLite data work with PostgreSQL?**
A: The schema is compatible, but you'll need to export/import data manually.

**Q: How big can my SQLite database get?**
A: SQLite handles several GB easily. For most development, size isn't an issue.

**Q: Is SQLite fast enough?**
A: Yes! SQLite is extremely fast for local development. It's used by apps like Chrome and Apple Music.

**Q: Do I need to commit the database file?**
A: No! `./data/` is in `.gitignore`. Never commit database files to git.

**Q: Can I use both databases simultaneously?**
A: No, the app uses one database at a time based on environment variables.

## 🛠️ Troubleshooting

### SQLite Issues

**"Database is locked"**
- Close other applications accessing the database
- Stop multiple dev servers
- Restart the dev server

**"Cannot open database"**
- Check if `./data/` directory exists
- Ensure you have write permissions
- Try deleting and recreating: `rm data/local.db && pnpm dev`

### PostgreSQL Issues

**"Connection refused"**
- Check `DATABASE_URL` is correct
- Ensure database is running (check cloud dashboard)
- Verify network connection

**"SSL connection error"**
- Add `?sslmode=require` to your DATABASE_URL
- Check SSL certificate settings

**"Too many connections"**
- Close unused connections
- Check your database plan limits
- Use connection pooling (already configured)

## 📚 Additional Resources

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Neon Documentation](https://neon.tech/docs/introduction)

---

**Need help?** Open an issue on GitHub or check the [CONTRIBUTING.md](./CONTRIBUTING.md) guide!
