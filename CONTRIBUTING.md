# Contributing to FactTube

Thank you for your interest in contributing to FactTube! This guide will help you get started.

## 🚀 Quick Setup for Contributors

FactTube is designed to be **zero-configuration** for local development:

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/fact-tube.git
cd fact-tube

# 2. Install dependencies
pnpm install

# 3. Start developing!
pnpm dev
```

That's it! No database setup, no API keys, no external services required. The app will:
- ✅ Automatically create a local SQLite database in `./data/local.db`
- ✅ Initialize all tables on first run
- ✅ Work completely offline for core features

## 📁 Project Structure

```
fact-tube/
├── app/                      # Next.js App Router
│   ├── api/
│   │   ├── trpc/            # tRPC API endpoints
│   │   └── extension/       # Chrome extension endpoints
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── lib/
│   ├── db/                  # Database (SQLite/Postgres)
│   │   ├── index.ts        # DB connection
│   │   └── schema.ts       # Drizzle schema
│   ├── trpc/               # tRPC routers
│   └── env.ts              # Environment config
├── public/
│   └── chrome-extension/   # Chrome extension files
└── data/                   # Local SQLite database (gitignored)
```

## 🗄️ Database

### Local Development (Default)

By default, FactTube uses **SQLite** which requires zero setup:
- Database file: `./data/local.db`
- Auto-created on first run
- Perfect for development and testing
- All data persists locally

### PostgreSQL (Optional)

If you want to use PostgreSQL (e.g., for production-like testing):

1. Create a free database at [console.neon.tech](https://console.neon.tech/)
2. Add to `.env.local`:
   ```env
   DATABASE_URL="postgresql://..."
   ```
3. Push schema:
   ```bash
   pnpm db:push
   ```

The app automatically detects `DATABASE_URL` and switches to PostgreSQL.

**📖 For detailed database comparison and troubleshooting, see [DATABASE.md](./DATABASE.md)**

## 🔧 Development Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm lint             # Run linter

# Database (only needed for PostgreSQL)
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Drizzle Studio
pnpm db:generate      # Generate migrations
```

## 🧪 Testing the Chrome Extension

1. Start the dev server:
   ```bash
   pnpm dev
   ```

2. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `/public/chrome-extension`

3. Configure the extension:
   - Click the extension icon
   - Set backend URL: `http://localhost:3000`
   - (Optional) Add OpenRouter API key for AI features

4. Test on YouTube:
   - Visit any YouTube video
   - Click "Fact-Check" button

## 🤝 Contribution Guidelines

### Before You Start

1. Check existing [issues](../../issues) and [pull requests](../../pulls)
2. For major changes, open an issue first to discuss
3. Make sure tests pass and code follows existing style

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes:
   - Write clear, readable code
   - Follow existing code style (Tailwind CSS, TypeScript)
   - Use Lucide React icons when needed
   - Add comments for complex logic

3. Test your changes:
   - Test with SQLite (default)
   - If database-related, test with PostgreSQL too
   - Test the Chrome extension if relevant

4. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```
   
   Use conventional commits:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation
   - `refactor:` - Code refactoring
   - `test:` - Tests
   - `chore:` - Maintenance

5. Push and create a Pull Request:
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- **TypeScript**: Use type-safe code throughout
- **Styling**: Use Tailwind CSS classes
- **Icons**: Use Lucide React icons
- **Components**: Follow existing component patterns
- **API**: Use tRPC for type-safe API routes
- **Toasts**: Use Sonner for notifications
- **Encoding**: UTF-8 always

### What We're Looking For

- 🐛 Bug fixes
- ✨ New features (discuss first for large ones)
- 📚 Documentation improvements
- 🎨 UI/UX enhancements
- ♿ Accessibility improvements
- 🌐 Internationalization
- 🧪 Tests

### Areas That Need Help

- [ ] Frontend UI components and dashboard
- [ ] User authentication system
- [ ] Enhanced fact-checking algorithms
- [ ] Performance optimizations
- [ ] Mobile-responsive design
- [ ] Accessibility features
- [ ] Internationalization (i18n)
- [ ] Unit and integration tests

## 📝 Environment Variables

For most development, you don't need any environment variables. The app works out of the box.

### Optional Configuration

Create `.env.local` only if you need:

```env
# PostgreSQL instead of SQLite (optional)
DATABASE_URL="postgresql://..."

# AI fact-checking (optional)
OPENROUTER_API_KEY="sk-or-..."

# Development
NODE_ENV="development"
```

See `env.example` for all options.

## 🔍 Debugging

### Database Issues

**SQLite** (check database):
```bash
# View database contents
pnpm db:studio

# Or use sqlite3 CLI
sqlite3 data/local.db "SELECT * FROM videos;"
```

**PostgreSQL** (if using):
```bash
# Push schema
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

### Extension Issues

1. Check browser console (F12) on YouTube page
2. Check extension background page console:
   - Go to `chrome://extensions/`
   - Click "Inspect views: background page"
3. Check backend logs in your terminal

### Common Issues

**Port already in use:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Database locked (SQLite):**
```bash
# Remove database and restart
rm data/local.db
pnpm dev
```

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 💬 Questions?

- Open an [issue](../../issues) for bugs or feature requests
- Start a [discussion](../../discussions) for questions or ideas

Thank you for contributing to FactTube! 🎉
