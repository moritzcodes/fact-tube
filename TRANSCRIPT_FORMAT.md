# Transcript Format Documentation

## Simplified Structure (Option 2 - Token Efficient)

As of this implementation, transcripts are returned in a **simplified, token-efficient format** optimized for AI processing.

### Structure

```json
{
  "videoId": "TTCDLykCk5I",
  "lang": "en",
  "segments": [
    {
      "start": 0.48,
      "text": "Take a look at these chocolate bars."
    },
    {
      "start": 2.48,
      "text": "They're identical except one costs 120%"
    }
  ],
  "totalSegments": 2
}
```

### Fields

#### Root Level
- **`videoId`** (string): The YouTube video ID
- **`lang`** (string): Language code (e.g., "en")
- **`segments`** (array): Array of transcript segments
- **`totalSegments`** (number): Total number of segments

#### Segment Object
- **`start`** (number): Start time in seconds (float)
- **`text`** (string): The transcript text for this segment

### Why This Format?

**Token Efficiency**: Removed redundant fields that can be calculated:
- ❌ Removed `duration` - can be calculated as `nextSegment.start - currentSegment.start`
- ❌ Removed `end` - same as next segment's start
- ✅ Kept `start` - essential for timing
- ✅ Kept `text` - the actual content

**Result**: ~25-30% reduction in token count when sending to AI APIs

### When to Calculate Duration/End

If you need `duration` or `end` times:

```typescript
// Calculate duration (time until next segment starts)
const segmentWithDuration = segments.map((seg, i) => ({
  ...seg,
  duration: i < segments.length - 1 
    ? segments[i + 1].start - seg.start 
    : 0 // or use video duration
}));

// Calculate end time
const segmentWithEnd = segments.map((seg, i) => ({
  ...seg,
  end: i < segments.length - 1 
    ? segments[i + 1].start 
    : seg.start // or use video duration
}));
```

### API Endpoint

**tRPC Route**: `transcripts.fetchFromYouTube`

```typescript
const transcript = await trpc.transcripts.fetchFromYouTube.useQuery({
  videoId: "dQw4w9WgXcQ",
  lang: "en"
});
```

### Use Cases

1. **Sending to AI for Claim Extraction**:
   ```typescript
   const payload = {
     videoId: transcript.videoId,
     segments: transcript.segments // Already in optimal format!
   };
   ```

2. **Chunking for Streaming** (as per Project.md):
   ```typescript
   // Send 30-60 second chunks
   const chunkDuration = 60; // seconds
   const chunks = [];
   let currentChunk = [];
   let chunkStart = 0;
   
   for (const segment of transcript.segments) {
     if (segment.start - chunkStart > chunkDuration) {
       chunks.push({ segments: currentChunk });
       currentChunk = [];
       chunkStart = segment.start;
     }
     currentChunk.push(segment);
   }
   if (currentChunk.length > 0) {
     chunks.push({ segments: currentChunk });
   }
   ```

3. **Display with Timestamps**:
   ```typescript
   segments.map(seg => (
     <div>
       <span>{formatTimestamp(seg.start)}</span>
       <span>{seg.text}</span>
     </div>
   ))
   ```

### Migration Notes

**Previous format** (before this change):
```json
{
  "start": 0.48,
  "duration": 2,
  "end": 2.48,
  "text": "Take a look at these chocolate bars."
}
```

**Current format**:
```json
{
  "start": 0.48,
  "text": "Take a look at these chocolate bars."
}
```

If you need to support legacy code, use the calculation methods shown above.

### Related Files

- **API Router**: `lib/trpc/routers/transcripts.ts`
- **Frontend Demo**: `app/page.tsx`
- **CLI Tool**: `get-transcript.js` (uses full format for SRT generation)

