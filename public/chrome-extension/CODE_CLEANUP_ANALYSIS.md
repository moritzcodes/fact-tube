# Chrome Extension Code Cleanup Analysis

## Summary
After analyzing all extension files, I found **significant dead code** that can be removed. The extension has evolved from an overlay-based UI to a morphing FAB (Floating Action Button) UI, but old code wasn't cleaned up.

## Files Analysis

### ✅ **ACTIVE FILES** (Keep and Use)

#### 1. **background.js** (585 lines)
**Status**: ACTIVE - Core background service worker
**Purpose**: 
- Manages video processing requests
- Handles SSE connections for real-time claim updates
- Manages caching of analyzed videos
- Routes messages between content scripts and backend API

**Key Functions**:
- `processVideo()` - Calls backend API
- `connectToClaimStream()` - SSE for real-time updates
- `handleVideoDetection()` - Main processing flow
- `initializeSession()` - Auto-loads cached data

**Issues**: 
- ⚠️ MOCK_MODE flag (line 15) is never actually used - can be removed
- ⚠️ `checkCacheStatus()` function (line 48) returns dummy data

#### 2. **bootstrap.js** (58 lines)
**Status**: ACTIVE - Entry point
**Purpose**: 
- Initializes extension on YouTube watch pages
- Handles SPA navigation (YouTube's client-side routing)
- Manages instance cleanup on page changes

**Clean**: No issues

#### 3. **content.core.js** (59 lines)
**Status**: ACTIVE - Class definition
**Purpose**: 
- Defines `YouTubeFactChecker` class constructor
- Initializes core properties
- Sets up message listeners

**Issues**:
- ⚠️ `mockMode` property (line 12) is set but never used

#### 4. **content.player.js** (106 lines)
**Status**: ACTIVE - Player integration
**Purpose**:
- Waits for YouTube player to load
- Extracts video ID from URL
- Sets up time tracking for claim timing
- Creates timeline markers when metadata loads

**Clean**: No issues

#### 5. **content.morph.js** (641 lines)
**Status**: ACTIVE - Modern UI system
**Purpose**:
- Creates liquid glass FAB button
- Handles morphing animations (FAB ↔ Card)
- Manages claim display in morphed card
- Handles user interactions

**Clean**: This replaced the old overlay system

#### 6. **content.messaging.js** (399 lines)
**Status**: ACTIVE but has DEAD CODE
**Purpose**:
- Handles messages from background script
- Loads and transforms API data
- Shows notifications

**Dead Code**:
```javascript
// Lines 39-42: REALTIME_UPDATE handler - never sent from background
case 'REALTIME_UPDATE':
    this.handleRealtimeUpdate(message.data);
    break;

// Lines 43-46: PROCESSING_ERROR handler - never sent from background
case 'PROCESSING_ERROR':
    this.handleProcessingError(message.data);
    break;

// Lines 163-179: handleRealtimeUpdate - not used
YouTubeFactChecker.prototype.handleRealtimeUpdate = function(data) {...}

// Lines 311-327: handleProcessingError - duplicate of handleAnalysisError
```

**Duplicate Code**:
- `mapApiStatusToCategory()` - duplicated in content.mock.js
- `createSummaryFromClaims()` - duplicated in content.mock.js

#### 7. **content.mock.js** (652 lines)
**Status**: ACTIVE but poorly named
**Purpose**: 
- Handles analysis start flow
- Creates timeline markers
- Shows tooltips on timeline
- Jump to timestamp

**Issues**:
- ⚠️ Badly named! Not "mock" anymore - should be "content.timeline.js"
- ⚠️ `processVideo()` function (lines 104-129) never called - background handles this
- Duplicate functions (see messaging.js duplicates)

#### 8. **content.updates.js** (227 lines)
**Status**: ACTIVE - Real-time UI updates
**Purpose**:
- Updates visible claims based on video time
- Auto-opens/closes morphed card at claim timestamps
- Handles resize/fullscreen repositioning
- Manages auto-close timers

**Clean**: No issues

#### 9. **content.utils.js** (72 lines)
**Status**: ACTIVE - Helper functions
**Purpose**:
- Color/icon mapping for claim categories
- Time formatting
- Status utilities

**Clean**: No issues

#### 10. **content.error-handler.js** (142 lines)
**Status**: ACTIVE - Error handling
**Purpose**:
- Detects extension context invalidation
- Shows reload notifications
- Wraps message sending with error handling

**Clean**: No issues

---

### ❌ **DEAD FILES** (Can be completely removed)

#### 1. **config.js** (44 lines)
**Status**: ❌ COMPLETELY UNUSED
**Why**: 
- `CONFIG` object is defined but **never referenced anywhere**
- API URLs are hardcoded in:
  - background.js: `const API_BASE_URL = 'http://localhost:3000'`
  - content.messaging.js: `const API_BASE_URL = 'http://localhost:3000'`

**Action**: DELETE FILE + remove from manifest.json

#### 2. **content.overlay.js** (201 lines)
**Status**: ❌ MOSTLY DEAD CODE
**Purpose**: Old overlay system (replaced by morphing FAB)

**Still Used** (12 lines):
- `createOverlayContainer()` - line 3-20
- `clearOverlays()` - line 22-38

**Dead Code** (160 lines):
- `createClaimOverlay()` - lines 40-187: Never called
- `hideClaimOverlay()` - lines 189-199: Never called

**Action**: Keep only the 2 functions still in use, delete the rest

#### 3. **content.modals.js** (139 lines)
**Status**: ❌ COMPLETELY UNUSED
**Why**: 
- `showClaimDetails()` - never called
- `showFactCheckDetails()` - never called
- Modal system was replaced by morphing card UI

**Action**: DELETE FILE + remove from manifest.json

---

## Cleanup Plan

### Phase 1: Remove Dead Files
1. ✅ Delete `config.js`
2. ✅ Delete `content.modals.js`
3. ✅ Update manifest.json to remove these files

### Phase 2: Clean Dead Code in Active Files

**background.js**:
- Remove MOCK_MODE flag and related code
- Remove dummy `checkCacheStatus()` function

**content.messaging.js**:
- Remove REALTIME_UPDATE case
- Remove PROCESSING_ERROR case
- Remove `handleRealtimeUpdate()` function
- Remove `handleProcessingError()` function (keep handleAnalysisError)
- Keep only one copy of duplicate functions

**content.mock.js**:
- ⚠️ RENAME to `content.timeline.js` (more accurate)
- Remove `processVideo()` function
- Remove duplicate functions (keep in messaging.js)

**content.overlay.js**:
- Remove `createClaimOverlay()` and `hideClaimOverlay()`
- Keep only `createOverlayContainer()` and `clearOverlays()`

**content.core.js**:
- Remove unused `mockMode` property

### Phase 3: Consolidate Duplicates
- Keep `mapApiStatusToCategory()` in messaging.js only
- Keep `createSummaryFromClaims()` in messaging.js only
- Keep `showCompletionNotification()` in mock.js (used more there)
- Keep `showProcessingIndicator()` in messaging.js

---

## Final File Structure (After Cleanup)

```
background.js              (~550 lines, -35 dead code)
bootstrap.js               (58 lines, clean)
content.core.js            (58 lines, -1 property)
content.error-handler.js   (142 lines, clean)
content.messaging.js       (350 lines, -50 dead code)
content.morph.js           (641 lines, clean)
content.overlay.js         (40 lines, -160 dead code)
content.player.js          (106 lines, clean)
content.timeline.js        (550 lines, renamed from mock.js, -100 dead code)
content.updates.js         (227 lines, clean)
content.utils.js           (72 lines, clean)
manifest.json              (updated)
```

**Total reduction**: ~400 lines of dead code removed

---

## Architecture Summary (What Actually Runs)

### Extension Flow:

1. **Page Load** (bootstrap.js)
   - Detects YouTube watch page
   - Creates YouTubeFactChecker instance
   - Calls init()

2. **Initialization** (content.core.js → content.player.js)
   - Waits for YouTube player
   - Extracts video ID
   - Creates FAB button
   - Requests session data from background

3. **Background Processing** (background.js)
   - Checks if video is cached
   - If cached: Sends DATA_LOADED message
   - If not: Calls backend API, establishes SSE stream
   - Relays SSE updates (NEW_CLAIM, CLAIM_UPDATE) to content script

4. **Content Script Response** (content.messaging.js)
   - Receives DATA_LOADED or ANALYSIS_COMPLETE
   - Transforms API data format
   - Creates timeline markers
   - Shows notification

5. **User Interaction** (content.morph.js)
   - User clicks FAB → starts analysis or shows claims
   - FAB morphs into card showing claim details
   - User can click timeline markers to jump to claims

6. **Real-time Updates** (content.updates.js)
   - Monitors video playback time
   - Auto-opens morphed card when claim timestamp reached
   - Auto-closes after 8 seconds (unless user interacted)
   - Updates FAB visual state

### Message Flow:
```
Content → Background:
- START_ANALYSIS
- GET_SESSION_DATA
- CHECK_CACHE

Background → Content:
- DATA_LOADED (cached data)
- PROCESSING_STARTED
- EXTRACT_TRANSCRIPT
- ANALYSIS_COMPLETE (full results)
- ANALYSIS_ERROR
- NEW_CLAIM (SSE)
- CLAIM_UPDATE (SSE)
```

