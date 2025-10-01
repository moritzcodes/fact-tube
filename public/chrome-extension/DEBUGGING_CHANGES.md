# Chrome Extension Debugging Changes

## Overview
Added comprehensive console logging throughout the extension to help diagnose issues and track execution flow.

## Changes Made

### 1. **bootstrap.js** - Entry Point Logging
- ✅ Added logging when `startYouTubeFactChecker()` is called
- ✅ Logs current URL and pathname
- ✅ Only initializes on YouTube `/watch` pages
- ✅ Logs when cleaning up existing instances
- ✅ Logs when creating new instances
- ✅ Logs document ready state

**Key logs to look for:**
```
🚀 YouTube Fact-Checker content scripts loaded
🎬 startYouTubeFactChecker called
📍 Current URL: https://www.youtube.com/watch?v=...
✅ YouTubeFactChecker instance created and initialized
```

### 2. **content.core.js** - Core Initialization
- ✅ Added logging in `init()` method
- ✅ Logs mock mode status
- ✅ Logs each initialization step (player detection, time tracking, overlay creation, etc.)
- ✅ Logs when message listener is registered
- ✅ Logs incoming messages with type

**Key logs to look for:**
```
🎯 YouTubeFactChecker.init() called
🎥 Mock mode: false
✅ YouTube player detected
✅ YouTubeFactChecker initialization complete!
📨 Content script received message: ANALYSIS_COMPLETE
```

### 3. **content.player.js** - Player Integration
- ✅ Added logging in `waitForPlayer()` with attempt counter
- ✅ Logs when player is found
- ✅ Added detailed logging in `extractVideoId()`
- ✅ Logs video ID extraction
- ✅ Logs session data requests and responses

**Key logs to look for:**
```
⏳ Waiting for YouTube player...
🔍 Player check attempt 1: player=true, pathname=/watch
✅ YouTube player found!
🔍 Extracting video ID from URL...
🆔 Video ID: abc123xyz
🎨 Creating active indicator button...
```

### 4. **content.morph.js** - Button & UI
- ✅ Added logging in `createActiveIndicator()`
- ✅ Logs when removing existing indicators
- ✅ Logs glass filter creation
- ✅ Logs when button is added to DOM
- ✅ Added detailed logging in `updateButtonState()`
- ✅ Shows button state changes (loading, ready, data loaded)
- ✅ **FIXED: Button click handler now calls `startAnalysis()`**

**Key logs to look for:**
```
🎨 createActiveIndicator called
🔍 Player container found: true
✅ Active indicator added to player container
✨ FAB animation complete - button visible!
🖱️ FAB/Button clicked
🚀 Starting analysis from button click...
```

**Button States:**
- `▶` - Ready for analysis (clickable)
- Spinner - Analysis in progress
- `✓` - Data loaded (clickable to view)

### 5. **content.messaging.js** - Message Handling
- ✅ Added logging for all message types
- ✅ Logs data structure when loading data
- ✅ Logs transformation of API responses
- ✅ Enhanced `showProcessingIndicator()` with custom messages
- ✅ Logs when hiding processing indicator

**Key logs to look for:**
```
📨 handleMessage called with type: ANALYSIS_COMPLETE
✅ ANALYSIS_COMPLETE message received
📥 loadData called with data
🔄 Transforming 5 claim responses...
```

### 6. **content.mock.js** - Analysis Functions
- ✅ Added logging in `startAnalysis()`
- ✅ Logs cache check operations
- ✅ Logs live analysis startup
- ✅ Detailed logging in `handleAnalysisComplete()`
- ✅ Detailed error logging in `handleAnalysisError()`

**Key logs to look for:**
```
🚀 startAnalysis called!
📹 Starting analysis for video: https://...
🗄️ Checking cache for video: abc123
📨 Sending message to background script
✅ handleAnalysisComplete called
📊 Result object: {...}
```

### 7. **content.utils.js** - Utilities
- ✅ Logs when module is loaded
- ✅ Documents that `safeSendMessage` is in error-handler.js
- ✅ Added global `safeSendMessage` wrapper with logging

**Key logs to look for:**
```
✅ Content utilities loaded
📤 safeSendMessage called with: {type: "START_ANALYSIS"}
✅ Message sent successfully, response: {...}
```

### 8. **Other Modules**
- ✅ content.overlay.js: Module loaded log
- ✅ content.updates.js: Module loaded log  
- ✅ content.morph.js: Module loaded log
- ✅ content.transcript.js: Module loaded log
- ✅ content.mock.js: Module loaded log

## How to Debug

### 1. **Open Chrome DevTools**
- Go to any YouTube video page
- Press F12 or right-click → Inspect
- Go to the **Console** tab

### 2. **Expected Console Output on Page Load**
You should see these logs in order:
```
🚀 YouTube Fact-Checker content scripts loaded
✅ Extension error handler initialized
✅ Content utilities loaded
✅ Content overlay module loaded
✅ Content morph module loaded
✅ Content mock/analysis module loaded
✅ Content updates module loaded
✅ Content transcript module loaded
📄 Document already loaded, starting immediately
🎬 startYouTubeFactChecker called
📍 Current URL: https://www.youtube.com/watch?v=abc123
✨ Creating new YouTubeFactChecker instance
🎯 YouTubeFactChecker.init() called
⏳ Waiting for YouTube player...
🔍 Player check attempt 1: player=true, pathname=/watch
✅ YouTube player found!
✅ Time tracking setup complete
✅ Overlay container created
🔍 Extracting video ID from URL...
🆔 Video ID: abc123
🎨 Creating active indicator button...
✅ Active indicator created
✅ YouTubeFactChecker initialization complete!
```

### 3. **When Clicking the Button**
```
🖱️ FAB/Button clicked
🚀 Starting analysis from button click...
📹 Starting analysis for video: https://...
🆔 Extracted video ID: abc123
🗄️ Checking cache for video: abc123
📨 Sending message to background script: {type: "START_ANALYSIS"}
```

### 4. **Background Script Logs**
To see background script logs:
- Go to `chrome://extensions/`
- Find "YouTube Fact-Checker"
- Click "service worker" link under the extension
- New DevTools window opens with background logs

Expected background logs:
```
🚀 YouTube Fact-Checker initialized
📡 API Base URL: http://localhost:3000
🎭 Mock mode: disabled
📨 Background received message: START_ANALYSIS
🎬 Starting video processing for: https://...
```

### 5. **Common Issues to Check**

#### Issue: Button doesn't appear
**Look for:**
- ❌ "Could not find player container to attach indicator!"
- Check if on `/watch` page
- Check if player loaded

#### Issue: Button click does nothing
**Look for:**
- 🖱️ "FAB/Button clicked" (if not present, click handler not registered)
- 🚀 "Starting analysis from button click..." (if not present, startAnalysis not called)
- ⚠️ "Analysis already in progress" (if already running)

#### Issue: Analysis starts but no results
**Look for:**
- Background script errors
- API connection errors (check Network tab)
- "❌ Chrome runtime error:" messages

#### Issue: Extension context invalidated
**Look for:**
- "⚠️ Extension context invalidated. Please reload the page."
- Reload notification should appear
- Happens when extension is reloaded while page is open

## Testing Checklist

- [ ] Extension loads without errors
- [ ] Button appears on YouTube video page
- [ ] Button is visible and styled correctly
- [ ] Clicking button starts analysis
- [ ] Processing indicator appears
- [ ] Background script receives START_ANALYSIS message
- [ ] API calls are made to backend
- [ ] Results are received and displayed
- [ ] Console logs show complete flow

## Quick Fixes

### If button doesn't work:
1. Check console for errors
2. Reload extension in `chrome://extensions/`
3. Reload YouTube page
4. Verify backend is running on localhost:3000

### If no logs appear:
1. Make sure you're on a `/watch` page
2. Check if extension is enabled
3. Check content scripts are injected (Sources tab in DevTools)
4. Reload page

### If backend connection fails:
1. Verify backend is running: `curl http://localhost:3000/api/extension/process-video?video_url=test`
2. Check CORS settings
3. Check background.js `API_BASE_URL` setting

## Next Steps

If you still have issues after reviewing logs:
1. Copy ALL console logs from both content script and background script
2. Check Network tab for failed requests
3. Verify environment variables in backend
4. Check database connection

## Module Loading Order

Scripts load in this order (per manifest.json):
1. config.js
2. content.core.js
3. content.utils.js
4. content.player.js
5. content.transcript.js
6. content.messaging.js
7. content.overlay.js
8. content.mock.js
9. content.morph.js
10. content.modals.js
11. content.updates.js
12. bootstrap.js (initializes everything)

Each should log "✅ Content [module] module loaded"

