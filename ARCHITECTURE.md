# FactTube Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER EXPERIENCE                               │
│  ┌─────────────────┐                    ┌──────────────────────┐   │
│  │  YouTube Video  │                    │  Chrome Extension    │   │
│  │   with Claims   │◄───────────────────┤  Timeline Overlays   │   │
│  │   & Overlays    │                    │  & Claim Popups      │   │
│  └─────────────────┘                    └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      CHROME EXTENSION                                │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Content Scripts (YouTube Page)                            │    │
│  │  ├─ content.core.js        - Main controller              │    │
│  │  ├─ content.transcript.js  - Extract YouTube transcript   │    │
│  │  ├─ content.overlay.js     - Timeline markers             │    │
│  │  ├─ content.messaging.js   - SSE message handlers         │    │
│  │  └─ content.player.js      - YouTube player integration   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                               │                                      │
│                               │ Messages                             │
│                               ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Background Script (Service Worker)                        │    │
│  │  ├─ API orchestration                                      │    │
│  │  ├─ SSE connection management                              │    │
│  │  ├─ Session tracking                                       │    │
│  │  └─ Cache management                                       │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTP/SSE
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS BACKEND                                 │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Chrome Extension API Routes (REST)                        │    │
│  │  ├─ GET  /api/extension/process-video                      │    │
│  │  │   └─ Check cache, return existing claims               │    │
│  │  ├─ POST /api/extension/submit-transcript                  │    │
│  │  │   └─ Process segments, extract claims                  │    │
│  │  └─ GET  /api/extension/stream-claims (SSE)               │    │
│  │      └─ Stream real-time claim updates                     │    │
│  └────────────────────────────────────────────────────────────┘    │
│                               │                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  tRPC API Routes (Type-safe)                               │    │
│  │  ├─ claims.*        - Claim CRUD operations               │    │
│  │  ├─ videos.*        - Video metadata                      │    │
│  │  ├─ transcripts.*   - Transcript segments                 │    │
│  │  └─ ai.*            - AI processing                        │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
            │                       │                       │
            │                       │                       │
            ↓                       ↓                       ↓
┌──────────────────┐  ┌──────────────────────┐  ┌─────────────────┐
│   Database       │  │   AI Services        │  │  Background     │
│   (Neon)         │  │  ┌────────────────┐  │  │  Workers        │
│  ┌────────────┐  │  │  │ OpenRouter     │  │  │  ┌───────────┐ │
│  │  claims    │  │  │  │ (GPT-4o-mini)  │  │  │  │ Fact-     │ │
│  │  videos    │  │  │  │ Claim Extract  │  │  │  │ Checker   │ │
│  │  segments  │  │  │  └────────────────┘  │  │  │ Worker    │ │
│  └────────────┘  │  │  ┌────────────────┐  │  │  └───────────┘ │
│                  │  │  │ Perplexity     │  │  │       │        │
│                  │  │  │ Sonar Pro      │  │  │       │        │
│                  │  │  │ Fact-checking  │  │  │       ↓        │
│                  │  │  └────────────────┘  │  │  Updates DB    │
└──────────────────┘  └──────────────────────┘  └─────────────────┘
```

## Data Flow: Claim Extraction & Verification

### Step 1: Transcript Extraction
```
User clicks "Fact-Check" on YouTube
         ↓
Extension extracts transcript from captions
         ↓
Transcript chunked into 60-second segments
         ↓
Segments sent to backend sequentially
```

### Step 2: Claim Extraction
```
POST /api/extension/submit-transcript
         ↓
Backend receives segment with:
  - videoId
  - videoUrl
  - segments: [{ start: 0, text: "..." }]
         ↓
OpenRouter GPT-4o-mini analyzes segment
         ↓
Claims extracted with timestamps:
  - claim: "The unemployment rate is 3.7%"
  - speaker: "Unknown"
  - timestamp: 45 (seconds)
         ↓
Claims saved to database (status: "pending")
         ↓
Background fact-checker worker triggered
         ↓
Response sent to extension:
  {
    success: true,
    claimsExtracted: 2,
    claims: [...]
  }
```

### Step 3: Real-time Updates (SSE)
```
GET /api/extension/stream-claims?video_id=abc123
         ↓
SSE connection established
         ↓
Backend polls database every 2 seconds
         ↓
New claims detected:
  data: {"type":"claim","data":{...}}
         ↓
Extension receives message
         ↓
Timeline marker added
         ↓
Popup configured for timestamp
```

### Step 4: Fact-checking (Background)
```
Fact-checker worker picks up pending claim
         ↓
Perplexity Sonar API called:
  - Verifies claim against reliable sources
  - Returns: status, verdict, sources
         ↓
Database updated:
  - status: "verified" | "false" | "disputed" | "inconclusive"
  - verdict: "Detailed explanation..."
  - sources: ["url1", "url2"]
         ↓
SSE stream detects update
         ↓
Message sent to extension:
  data: {"type":"claim_update","data":{...}}
         ↓
Extension updates UI:
  - Marker color changes
  - Popup shows verdict
  - Sources added
```

## Technology Stack

### Frontend (Chrome Extension)
```
├─ Vanilla JavaScript
├─ Chrome Extension APIs
│  ├─ chrome.runtime (messaging)
│  ├─ chrome.tabs (tab management)
│  └─ chrome.storage (settings)
├─ YouTube Player API
├─ EventSource API (SSE)
└─ DOM manipulation
```

### Backend (Next.js)
```
├─ Next.js 15 (App Router)
├─ TypeScript
├─ tRPC (type-safe APIs)
├─ Drizzle ORM
├─ React Query
├─ Tailwind CSS
└─ Sonner (toasts)
```

### Database
```
├─ Neon (Serverless PostgreSQL)
├─ Drizzle ORM
└─ Schema:
    ├─ claims
    ├─ videos
    └─ transcript_segments
```

### AI Services
```
├─ OpenRouter
│  └─ GPT-4o-mini (claim extraction)
└─ Perplexity
    └─ Sonar Pro (fact-checking)
```

## Scaling Considerations

### Current Architecture
- ✅ Stateless backend (scales horizontally)
- ✅ Database handles concurrent requests
- ✅ Background workers process asynchronously
- ✅ Caching prevents duplicate processing

### Future Optimizations
1. **Redis Cache**: Faster claim retrieval
2. **Queue System**: Bull/BullMQ for job processing
3. **Rate Limiting**: Prevent API abuse
4. **CDN**: Cache static extension assets
5. **Webhook**: Alternative to SSE polling
6. **Batch Processing**: Process multiple videos simultaneously

## Security

### Extension Security
- ✅ Content Security Policy (CSP)
- ✅ Limited host permissions
- ✅ No eval() or inline scripts
- ✅ Manifest V3 compliance

### API Security
- ✅ CORS configured for extension origin
- ✅ Input validation (Zod schemas)
- ✅ Rate limiting (Future: implement)
- ✅ API key rotation (Environment variables)

### Data Privacy
- ✅ No user tracking
- ✅ No personal data stored
- ✅ Public video data only
- ✅ Claims attributed to videos, not users

## Performance Metrics

### Extension
- **Transcript Extraction**: ~1-2 seconds
- **Timeline Rendering**: <100ms
- **Memory Usage**: ~50-100 MB
- **Network**: Minimal (SSE connection)

### Backend
- **Claim Extraction**: ~2-3 seconds/chunk
- **Database Query**: <50ms
- **SSE Latency**: <500ms
- **Cache Hit**: <100ms

### AI Processing
- **OpenRouter (GPT-4o-mini)**: ~2-3 seconds/request
- **Perplexity (Sonar Pro)**: ~10-30 seconds/claim
- **Cost**: ~$0.01-0.05 per video

## Monitoring & Debugging

### Extension Debugging
```
chrome://extensions/
  └─ Click "service worker" link
  └─ View background script logs

YouTube page
  └─ F12 DevTools
  └─ Console tab (content scripts)
  └─ Network tab (API calls, SSE)
```

### Backend Monitoring
```
Development:
  └─ pnpm dev (console logs)

Production (Vercel):
  └─ Vercel Dashboard → Logs
  └─ Real-time function logs
  └─ Error tracking
```

### Database Monitoring
```
Development:
  └─ pnpm db:studio (Drizzle Studio)

Production:
  └─ Neon Dashboard
  └─ Query performance
  └─ Connection pooling
```

## Deployment Architecture

### Development
```
┌──────────────────┐
│  Chrome Browser  │
│  ├─ Extension    │ ───┐
│  └─ DevTools     │    │
└──────────────────┘    │
                        │ HTTP
                        ↓
┌──────────────────┐
│  localhost:3000  │
│  ├─ Next.js dev  │
│  └─ Hot reload   │
└──────────────────┘
         │
         ↓
┌──────────────────┐
│  Neon Database   │
│  (Dev branch)    │
└──────────────────┘
```

### Production
```
┌──────────────────┐
│  Chrome Store    │
│  └─ Extension    │ ───┐
└──────────────────┘    │
                        │ HTTPS
                        ↓
┌──────────────────┐
│  Vercel          │
│  ├─ Edge Runtime │
│  └─ Auto-scale   │
└──────────────────┘
         │
         ↓
┌──────────────────┐
│  Neon Database   │
│  (Prod instance) │
└──────────────────┘
```

## Future Architecture Enhancements

### Phase 1: Authentication
```
Add user system:
  ├─ NextAuth.js
  ├─ User database table
  ├─ Usage tracking
  └─ Premium features
```

### Phase 2: Real-time WebSockets
```
Replace SSE with WebSockets:
  ├─ Socket.io
  ├─ Bi-directional communication
  ├─ Reduced latency
  └─ Better connection management
```

### Phase 3: Distributed Processing
```
Add queue system:
  ├─ Redis + Bull
  ├─ Multiple workers
  ├─ Job prioritization
  └─ Failure recovery
```

### Phase 4: Analytics Dashboard
```
Web dashboard:
  ├─ Most fact-checked videos
  ├─ Claim statistics
  ├─ Trending misinformation
  └─ User leaderboard
```

---

**Current Status**: Phase 1 Complete ✅
- Extension fully integrated
- Real-time streaming working
- Database persistence enabled
- Background fact-checking operational

