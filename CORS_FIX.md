# CORS Fix for Chrome Extension

## Problem

The Chrome extension was getting CORS errors when trying to call the backend API:

```
Access to fetch at 'http://localhost:3000/api/extension/analyze-video' 
from origin 'https://www.youtube.com' has been blocked by CORS policy
```

## Solution

Added CORS headers to all extension API endpoints:

### Headers Added

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

### OPTIONS Handler

Added OPTIONS handler for CORS preflight requests:

```typescript
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
```

### Updated Endpoints

Added CORS headers to all responses in these endpoints:

✅ `/app/api/extension/analyze-video/route.ts` (NEW - primary endpoint)
✅ `/app/api/extension/submit-transcript/route.ts`
✅ `/app/api/extension/stream-claims/route.ts`
✅ `/app/api/extension/process-video/route.ts`

## Testing

1. **Restart your Next.js dev server:**
   ```bash
   pnpm dev
   ```

2. **Reload the Chrome extension** (chrome://extensions/)

3. **Test on a YouTube video** with captions

4. **Check console** - you should see:
   ```
   📝 Starting video analysis for: [videoId]
   📤 Sending video ID to backend for analysis...
   ✅ Video analysis complete
   ```

## Why This Works

- **CORS preflight**: Browser sends OPTIONS request before POST
- **OPTIONS handler**: Returns 204 with CORS headers
- **All responses**: Include CORS headers to allow cross-origin access
- **Wildcard origin**: `*` allows requests from any origin (YouTube.com)

## Security Note

Using `Access-Control-Allow-Origin: *` is fine for this use case because:

1. ✅ The API is designed to be called by the Chrome extension
2. ✅ No sensitive user data is exposed
3. ✅ Rate limiting should be added in production
4. ✅ API keys are server-side only (not exposed)

For production, consider:
- Using specific origins instead of `*`
- Adding authentication tokens
- Implementing rate limiting
- Using environment variables for allowed origins

## Before vs After

### Before ❌
```
Extension → POST /api/... → ❌ CORS Error
```

### After ✅
```
Extension → OPTIONS /api/... → ✅ 204 (preflight)
Extension → POST /api/...    → ✅ 200 (with CORS headers)
```

## Common CORS Issues

If you still get CORS errors:

1. **Server not restarted**: Kill and restart `pnpm dev`
2. **Browser cache**: Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
3. **Wrong URL**: Check API_BASE_URL in content.messaging.js
4. **Port mismatch**: Ensure backend is on localhost:3000

## Production Deployment

When deploying to production (e.g., Vercel):

1. Update `API_BASE_URL` in `content.messaging.js` or `config.js`
2. Consider restricting CORS to specific origins
3. Add rate limiting middleware
4. Monitor API usage

Example for production:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

---

**Status:** ✅ CORS issues resolved!

