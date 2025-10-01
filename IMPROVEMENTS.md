# AI Claim Extraction Improvements

## ✅ Issues Fixed

### 1. **Real-Time Display** 
**Problem**: Claims only appeared after all chunks finished processing.

**Solution**: 
- Modified UI to display `extractedClaims` state during processing
- Claims now appear instantly as each chunk completes
- Progress bar and count update in real-time
- After processing, shows final results from database

### 2. **Too Many Claims**
**Problem**: AI was extracting too many trivial or non-fact-checkable claims.

**Solution**: Enhanced AI prompt with strict criteria:

**✅ Claims Must Be:**
- Specific, objective statements with measurable data (numbers, dates, statistics)
- Verifiable through credible sources
- Significant and impactful (not common knowledge)
- Clear assertions (not vague or ambiguous)

**❌ Now Excludes:**
- Opinions and predictions
- Questions or rhetorical statements
- Common knowledge facts
- Vague statements without specific data
- Personal anecdotes
- Promotional content
- Filler content (greetings, acknowledgments)

**Result**: Only 1-3 claims per minute of content, filtered to the most important facts.

### 3. **Video Context**
**Problem**: AI lacked context about the video's topic and purpose.

**Solution**: 
- Added `transcripts.getVideoMetadata` endpoint
- Fetches YouTube video metadata (title, description, channel)
- Video description passed to AI for every chunk
- AI uses context to better understand claims
- First 500 characters of description included in prompts

## 🎯 Example Improvements

### Before:
```
- "Today we're going to talk about the economy"
- "I think this is interesting"
- "The sky is blue"
- "Subscribe to my channel"
- "In my opinion, this is important"
```
❌ All extracted (not fact-checkable)

### After:
```
- "The unemployment rate dropped to 3.7% in October 2023"
- "Tesla sold 1.8 million vehicles in 2023"
- "The new law will cut corporate taxes from 35% to 21%"
```
✅ Only significant, verifiable claims extracted

## 📊 Technical Changes

### New Endpoint
```typescript
// Get video metadata including description
const metadata = await trpc.transcripts.getVideoMetadata.useQuery({
  videoId: "video-id"
});
```

### Enhanced AI Input
```typescript
await trpc.ai.extractClaims.mutate({
  videoId: "video-id",
  segments: [...],
  videoContext: {
    title: "Video Title",
    description: "Video description...",
    channelName: "Channel Name"
  }
});
```

### UI Improvements
- **Video Context Card**: Shows title, channel, and expandable description
- **Real-Time Counter**: Updates as claims are found
- **Dynamic Header**: Shows "Claims Being Extracted..." during processing
- **Better Toasts**: Differentiates between finding claims vs. no claims
- **Improved Status**: "No significant claims" message when appropriate

## 🚀 Usage

1. **Fetch Transcript** - Automatically loads video metadata
2. **View Context** - See what information AI will use (optional)
3. **Extract Claims** - Watch claims appear in real-time
4. **Review Results** - Only important, fact-checkable claims shown

## 📈 Expected Results

### Low-Value Content (Vlogs, Tutorials)
- Few or no claims extracted
- Message: "No significant fact-checkable claims found"

### News/Political Content
- 5-15 claims per 10-minute video
- Only statements with specific data/statistics
- Verifiable, impactful information

### Documentary/Educational
- 10-30 claims per 10-minute video
- Historical facts, scientific data
- Significant events and measurements

## 🎨 UI Enhancements

### Video Context Section (New)
```
┌─────────────────────────────────────┐
│ Video Context                       │
│ Title: [Video Title]                │
│ Channel: [Channel Name]             │
│ ▶ View Description                  │
└─────────────────────────────────────┘
```

### Claim Extraction Section (Improved)
```
┌─────────────────────────────────────┐
│ AI Claim Extraction (Improved)      │
│ Extract only important claims...    │
│ Video context is used for better    │
│ understanding.                      │
│                                     │
│ [Extract Claims with AI]            │
│                                     │
│ ████████░░░░░░░ 60%                │
│ 6 of 10 chunks processed           │
└─────────────────────────────────────┘
```

### Claims Display (Enhanced)
```
┌─────────────────────────────────────┐
│ Claims Being Extracted...    3 claims│
│                                     │
│ [2:15] The unemployment rate...     │
│ Speaker: Unknown                    │
│ [pending]                           │
│                                     │
│ [5:42] Tesla sold 1.8M vehicles...  │
│ Speaker: Elon Musk                  │
│ [pending]                           │
└─────────────────────────────────────┘
```

## 🔧 Configuration

### AI Model
- **Current**: `openai/gpt-4o-mini`
- **Temperature**: 0.3 (more deterministic)
- **Max Tokens**: 1000 per chunk

### Processing
- **Chunk Size**: 60 seconds
- **Claims per Chunk**: 1-3 maximum
- **Context Length**: First 500 chars of description

### Customization
To adjust selectivity, edit the system prompt in:
- `lib/trpc/routers/ai.ts` (lines 66-106)

## 📝 Files Modified

1. **`lib/trpc/routers/ai.ts`**
   - Enhanced system prompt with strict criteria
   - Added videoContext parameter
   - Improved error messages

2. **`lib/trpc/routers/transcripts.ts`**
   - Added `getVideoMetadata` endpoint
   - Fetches title, description, channel, etc.

3. **`app/page.tsx`**
   - Added video metadata fetching
   - Real-time claim display during processing
   - Video context card UI
   - Better progress tracking
   - Enhanced status messages

## ✨ Benefits

1. **Quality**: Only important, verifiable claims
2. **Context**: Better understanding using video metadata
3. **Speed**: See results immediately as they're found
4. **UX**: Clear progress and status indicators
5. **Accuracy**: Video description helps AI understand context

## 🎯 Next Steps

Possible future enhancements:
- Allow user to adjust selectivity level (strict/normal/lenient)
- Show why a claim was extracted (confidence score)
- Filter claims by type (statistics, events, policies)
- Export claims to different formats
- Add claim similarity detection to avoid duplicates

---

**Status**: ✅ All improvements implemented and tested
**Date**: October 1, 2025

