# What Is Actually Being Used - Chrome Extension Architecture

## Quick Overview

Your Chrome extension is a **YouTube fact-checker** that adds a floating button (FAB) to YouTube videos. When clicked, it analyzes the video for claims and shows fact-check results with timeline markers.

---

## File-by-File Explanation

### 🎯 **manifest.json** - Extension Configuration
**What it does:** Tells Chrome what your extension is and how to run it

**Key parts:**
- Lists all JavaScript files to load (in order)
- Defines permissions needed (YouTube access, API access)
- Sets up background worker
- Configures icons and extension name

**Status:** ✅ Active, cleaned up

---

### 🔧 **background.js** (~540 lines) - Background Service Worker
**What it does:** Runs in the background, manages API calls and caching

**Key responsibilities:**
1. **Video Processing**: Calls your backend API to analyze videos
2. **Caching**: Checks if video already analyzed, loads cached results
3. **SSE Connections**: Maintains Server-Sent Events connection for real-time claim updates
4. **Message Routing**: Relays data between content scripts and backend

**Main functions you care about:**
- `handleVideoDetection()` - Starts processing when user clicks analyze
- `processVideo()` - Calls backend API endpoint
- `connectToClaimStream()` - Opens SSE for live updates
- `loadCachedVideo()` - Loads previously analyzed video data

**Status:** ✅ Active, cleaned (removed mock mode and dead cache functions)

---

### 🚀 **bootstrap.js** (58 lines) - Entry Point
**What it does:** First thing that runs when you open a YouTube page

**Flow:**
1. Checks if you're on a `/watch` page (actual video, not homepage)
2. Cleans up any previous extension instance
3. Creates new `YouTubeFactChecker` instance
4. Handles YouTube's single-page navigation (when you click another video)

**Status:** ✅ Active, clean

---

### 🏗️ **content.core.js** (58 lines) - Class Definition
**What it does:** Defines the main `YouTubeFactChecker` class structure

**Properties it tracks:**
- `videoId` - Current video being watched
- `mockFactChecks` - Stores fact-check results
- `isAnalysisInProgress` - Whether currently analyzing
- `isMorphed` - Whether FAB is expanded to card
- `currentTime` - Current video playback position
- `activeIndicator` - The FAB button element
- `mockFactChecks` - Array of claims with fact-check data

**Status:** ✅ Active, cleaned (removed unused mockMode property)

---

### ⚡ **content.error-handler.js** (142 lines) - Error Handling
**What it does:** Handles Chrome extension context errors gracefully

**Why you need it:**
When you reload the extension while a page is open, Chrome invalidates the old extension context. This file:
- Detects when that happens
- Shows a user-friendly "reload page" notification
- Prevents console spam from failed message sends
- Wraps message sending in `safeSendMessage()` function

**Status:** ✅ Active, clean

---

### 🎨 **content.morph.js** (641 lines) - Morphing FAB UI
**What it does:** Creates and manages the beautiful glass-effect FAB button

**Key features:**
1. **FAB Creation**: Creates the circular floating button with liquid glass effect
2. **Morph Animation**: Smooth animation from FAB → Card when showing claims
3. **Button States**: 
   - Play icon (▶) = Ready to analyze
   - Spinner = Currently analyzing
   - Checkmark (✓) = Has results, click to view
4. **Card Display**: Shows claim details when morphed
5. **Edge Detection**: Positions button/card to avoid screen edges
6. **Resize Handling**: Repositions on fullscreen/theater mode

**Main functions:**
- `createActiveIndicator()` - Creates the FAB button
- `morphToCard()` - Expands FAB to show claim details
- `morphToFab()` - Collapses back to button
- `injectCardContent()` - Populates card with claim data
- `updateButtonState()` - Changes icon based on state

**Status:** ✅ Active, clean - this is your modern UI system

---

### 📨 **content.messaging.js** (~360 lines) - Message Handler
**What it does:** Receives and processes messages from background script

**Message types it handles:**

| Message Type | When Sent | What It Does |
|--------------|-----------|--------------|
| `PROCESSING_STARTED` | Analysis begins | Shows spinner on FAB |
| `DATA_LOADED` | Cached data loaded | Populates UI with cached claims |
| `ANALYSIS_COMPLETE` | Analysis finished | Shows all claims, creates timeline markers |
| `ANALYSIS_ERROR` | Something failed | Shows error notification |
| `NEW_CLAIM` | SSE: New claim found | Adds claim to timeline in real-time |
| `CLAIM_UPDATE` | SSE: Claim fact-checked | Updates claim with fact-check results |
| `EXTRACT_TRANSCRIPT` | Backend needs transcript | Extracts and sends transcript data |

**Key functions:**
- `handleMessage()` - Routes incoming messages
- `loadData()` - Transforms API data and displays it
- `handleAnalysisComplete()` - Processes full analysis results
- `handleNewClaim()` - Adds real-time claim from SSE
- `mapApiStatusToCategory()` - Converts API status to UI colors

**Status:** ✅ Active, cleaned (removed 4 unused message handlers)

---

### 🎬 **content.player.js** (~95 lines) - YouTube Player Integration
**What it does:** Interacts with YouTube's video player

**Key responsibilities:**
1. **Player Detection**: Waits for YouTube player to load
2. **Video ID Extraction**: Gets video ID from URL
3. **Time Tracking**: Monitors video playback position
4. **Session Management**: Requests cached data for current video
5. **Event Listening**: Responds to player metadata loaded

**Why time tracking matters:** 
- Auto-opens claim overlay at the right timestamp
- Highlights active claim on timeline
- Triggers claim display at exact moments

**Status:** ✅ Active, cleaned (removed mock mode logic)

---

### 📍 **content.mock.js** (652 lines) - Timeline & Analysis
**What it does:** Despite the name, this handles timeline markers and analysis flow

**⚠️ BAD NAME**: Should be renamed to `content.timeline.js` - it's not about mocking anymore!

**Key responsibilities:**
1. **Analysis Start Flow**: Handles when user clicks analyze button
2. **Timeline Markers**: Creates colored dots on YouTube progress bar
3. **Tooltips**: Shows claim preview on marker hover
4. **Jump to Timestamp**: Seeks video when clicking marker
5. **Notifications**: Shows completion/error notifications

**Timeline marker features:**
- Color-coded by fact-check result (green = true, red = false, orange = neutral)
- Liquid glass effect for consistency
- Hover shows claim preview
- Click jumps to that timestamp

**Status:** ✅ Active, but has some duplicate functions that could be consolidated

---

### 📦 **content.overlay.js** (47 lines) - Overlay Container
**What it does:** Creates the container that holds timeline markers

**Why it's small:** Used to be 201 lines with old popup overlay system. Now just:
- Creates overlay container on YouTube player
- Clears overlays when switching videos
- That's it!

**Status:** ✅ Active, massively cleaned (removed 154 lines of dead overlay code)

---

### 🔄 **content.updates.js** (227 lines) - Real-time UI Updates
**What it does:** Monitors video playback and updates UI accordingly

**Key responsibilities:**
1. **Auto-open Overlay**: When video reaches a claim timestamp, auto-opens the morphed card
2. **Auto-close Overlay**: Closes card after 8 seconds (unless user interacted)
3. **Resize Handling**: Repositions FAB/card when window resizes or goes fullscreen
4. **Visual State Updates**: Changes FAB color based on active claim

**Auto-open logic:**
```
Video plays → Reaches claim timestamp → Card auto-opens → Shows claim → 
Auto-closes after 8s (unless user clicked something)
```

**Status:** ✅ Active, clean

---

### 🛠️ **content.utils.js** (72 lines) - Helper Utilities
**What it does:** Shared utility functions used across all modules

**Functions:**
- `getCategoryColor()` - Maps claim status to color (true=green, false=red, etc.)
- `getCategoryIcon()` - Maps claim status to emoji (true=✅, false=❌, etc.)
- `formatTime()` - Converts seconds to MM:SS format
- `clearTimeouts()` - Cleanup function

**Status:** ✅ Active, clean

---

## How It All Works Together

### **1. Page Load Flow**

```
YouTube page loads
    ↓
bootstrap.js → Creates YouTubeFactChecker instance
    ↓
content.core.js → init() method runs
    ↓
content.player.js → Waits for YouTube player
    ↓
content.player.js → Extracts video ID
    ↓
content.morph.js → Creates FAB button
    ↓
content.player.js → Asks background for cached data
    ↓
background.js → Checks if video cached
    ↓
If cached: Sends DATA_LOADED → content.messaging.js → Displays claims
If not: FAB shows "play" icon, ready for user to click
```

---

### **2. User Clicks Analyze**

```
User clicks FAB
    ↓
content.morph.js → setupMorphInteractions() click handler
    ↓
content.mock.js → startAnalysis()
    ↓
Sends START_ANALYSIS message to background.js
    ↓
background.js → handleVideoDetection()
    ↓
background.js → processVideo() calls your API
    ↓
background.js → connectToClaimStream() opens SSE
    ↓
Sends PROCESSING_STARTED → content.messaging.js
    ↓
content.messaging.js → Shows spinner on FAB
    ↓
[Waiting for backend...]
    ↓
SSE sends NEW_CLAIM → content.messaging.js → handleNewClaim()
    ↓
content.mock.js → createTimelineMarkers() adds dot to timeline
    ↓
SSE sends CLAIM_UPDATE → content.messaging.js → Updates claim with fact-check
    ↓
[Repeat for each claim...]
    ↓
All done! FAB shows checkmark, timeline full of markers
```

---

### **3. User Watches Video**

```
Video plays
    ↓
content.player.js → Tracks current time
    ↓
content.updates.js → updateVisibleClaims() checks timestamps
    ↓
Timestamp matches claim → content.updates.js → scheduleAutoClose()
    ↓
content.morph.js → morphToCard() expands FAB
    ↓
Shows claim details for 8 seconds
    ↓
If user doesn't interact → morphToFab() collapses back
    ↓
If user clicks → stays open, cancels auto-close
```

---

### **4. User Hovers Timeline Marker**

```
Mouse hovers marker
    ↓
content.mock.js → showTimelineTooltip()
    ↓
Creates tooltip with liquid glass effect
    ↓
Shows claim preview
    ↓
Mouse leaves → hideTimelineTooltip()
```

---

### **5. User Clicks Timeline Marker**

```
User clicks marker
    ↓
content.mock.js → jumpToTimestamp()
    ↓
Seeks video to that time
    ↓
content.updates.js detects new timestamp
    ↓
Auto-opens claim overlay
```

---

## What Was Removed (Dead Code)

### Files Deleted:
- ❌ `config.js` - Never used, API URLs hardcoded instead
- ❌ `content.modals.js` - Old popup modal system, replaced by morphing cards

### Code Removed:
- ❌ MOCK_MODE system - Extension always uses real API now
- ❌ Old overlay popup system - Replaced by morphing FAB
- ❌ Unused message handlers - REALTIME_UPDATE, PROCESSING_ERROR, etc.
- ❌ Duplicate functions - Same function in multiple files
- ❌ Cache initialization - Backend handles caching via database

**Total removed:** ~500 lines of dead code

---

## Current State Summary

### ✅ What Works:
1. **FAB Button**: Beautiful liquid glass button on all YouTube videos
2. **Auto-cache**: Instantly loads results for previously analyzed videos
3. **Real-time Analysis**: SSE streams claims as they're found
4. **Timeline Markers**: Visual indicators on YouTube progress bar
5. **Auto-display**: Claims automatically appear at relevant timestamps
6. **Error Handling**: Graceful handling of extension reloads and API errors

### 📊 Code Stats:
- **Total active code**: ~2,948 lines
- **Number of modules**: 11 files
- **Message types**: 7 active message handlers
- **UI components**: FAB, morphing card, timeline markers, tooltips, notifications

### 🎯 Architecture:
- **Background Worker**: Handles API calls, caching, SSE
- **Content Scripts**: UI rendering, player integration, user interaction
- **Message System**: Clean communication between background and content
- **Modular Design**: Each file has a specific, clear purpose

---

## Recommendations for Future

### High Priority:
1. **Rename `content.mock.js`** → `content.timeline.js` (more accurate)
2. **Consolidate duplicate functions** (mapApiStatusToCategory, createSummaryFromClaims)
3. **Centralize API URLs** (currently hardcoded in 2 places)

### Low Priority:
1. Consider splitting content.morph.js (641 lines) into smaller modules
2. Add JSDoc comments to complex functions
3. Consider TypeScript for better type safety

### Don't Touch:
- The morphing animation system (it's beautiful and working)
- The error handler (it's handling edge cases well)
- The message flow (it's clean and logical)

---

## Summary

Your extension is **well-architected** with clear separation of concerns:
- **background.js** = API & data management
- **content.morph.js** = UI & animations  
- **content.messaging.js** = Message routing
- **content.updates.js** = Real-time updates
- **content.mock.js** = Timeline markers (needs rename!)

After cleanup, you have **~3,000 lines of clean, functional code** with no dead weight. The extension does exactly what it should: analyze YouTube videos, display fact-checks beautifully, and provide a seamless user experience.

