// Background script for YouTube Fact-Checker extension

console.log('🚀 YouTube Fact-Checker initialized');

// Get settings from Chrome storage
async function getSettings() {
    try {
        const result = await chrome.storage.local.get(['openrouterApiKey', 'apiBaseUrl']);
        return {
            apiKey: result.openrouterApiKey || '',
            apiBaseUrl: result.apiBaseUrl || 'http://localhost:3000'
        };
    } catch (error) {
        console.error('❌ Error loading settings:', error);
        return {
            apiKey: '',
            apiBaseUrl: 'http://localhost:3000'
        };
    }
}

// Track active fact-checking sessions
const activeSessions = new Map();

// Cache for storing video analysis results
const videoCache = new Map();

// Track active SSE connections
const activeSSEConnections = new Map();

// Load cached video data from backend database
async function loadCachedVideo(videoId) {
    try {
        console.log(`🗄️ Loading cached data for video: ${videoId}`);
        const settings = await getSettings();
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const headers = { 'Accept': 'application/json' };

        // Add API key if available
        if (settings.apiKey) {
            headers['X-OpenRouter-API-Key'] = settings.apiKey;
        }

        const response = await fetch(`${settings.apiBaseUrl}/api/extension/process-video?video_url=${encodeURIComponent(videoUrl)}`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Failed to load cached video: ${response.statusText}`);
        }

        const cachedData = await response.json();
        console.log(`✅ Loaded cached data for video ${videoId}:`, {
            total_claims: cachedData.total_claims,
            claim_responses_count: cachedData.claim_responses ? cachedData.claim_responses.length : 0
        });

        // Mark as loaded in cache
        videoCache.set(videoId, { exists: true, loaded: true, data: cachedData });

        return cachedData;
    } catch (error) {
        console.error(`❌ Error loading cached video ${videoId}:`, error);
        throw error;
    }
}

// Check if video is available in cache
async function isVideoInCache(videoId) {
    const cacheEntry = videoCache.get(videoId);
    if (cacheEntry && cacheEntry.exists) {
        return true;
    }

    // If not in cache memory, try loading from backend
    try {
        console.log(`🔄 Cache miss for ${videoId}, checking backend directly...`);
        const settings = await getSettings();
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const headers = { 'Accept': 'application/json' };

        // Add API key if available
        if (settings.apiKey) {
            headers['X-OpenRouter-API-Key'] = settings.apiKey;
        }

        const response = await fetch(`${settings.apiBaseUrl}/api/extension/process-video?video_url=${encodeURIComponent(videoUrl)}`, {
            method: 'GET',
            headers: headers
        });

        if (response.ok) {
            const data = await response.json();
            // Check if we got actual claims (cached) or just a processing status
            if (data.claim_responses && data.claim_responses.length > 0) {
                videoCache.set(videoId, { exists: true, loaded: false });
                console.log(`✅ Found ${videoId} in backend cache, updated local cache`);
                return true;
            }
        }
    } catch (error) {
        console.warn(`⚠️ Failed to check backend cache for ${videoId}:`, error.message);
    }

    return false;
}

// Send cached data with retry mechanism for content script readiness
function sendCachedDataWithRetry(tabId, cachedResult, retryCount) {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    chrome.tabs.sendMessage(tabId, {
        type: 'DATA_LOADED',
        data: {...cachedResult, fromCache: true }
    }, (response) => {
        if (chrome.runtime.lastError) {
            if (retryCount < maxRetries) {
                console.warn(`⚠️ Content script not ready yet (attempt ${retryCount + 1}/${maxRetries + 1}), retrying in ${retryDelay}ms...`);
                setTimeout(() => {
                    sendCachedDataWithRetry(tabId, cachedResult, retryCount + 1);
                }, retryDelay);
            } else {
                console.error('❌ Failed to send cached data to content script after all retries:', chrome.runtime.lastError.message);
            }
        } else {
            console.log('✅ Cached data sent to content script successfully');
        }
    });
}

// Note: Cache initialization removed - backend handles caching via database

// Listen for tab updates to detect YouTube video navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const url = new URL(tab.url);
        if (url.hostname === 'www.youtube.com' && url.pathname === '/watch') {
            const videoId = url.searchParams.get('v');
            if (videoId) {
                // Just initialize session, don't auto-start processing
                initializeSession(tabId, videoId, tab.url);
            }
        }
    }
});

// Initialize session and check for cached data
async function initializeSession(tabId, videoId, videoUrl) {
    try {
        // Check if video is already in cache
        if (await isVideoInCache(videoId)) {
            console.log(`🗄️ Video ${videoId} found in cache during initialization, loading cached data...`);

            try {
                const cachedResult = await loadCachedVideo(videoId);

                // Mark session as completed with cached data
                activeSessions.set(videoId, {
                    tabId,
                    videoId,
                    videoUrl,
                    status: 'completed',
                    result: cachedResult,
                    fromCache: true
                });

                console.log(`✅ Session initialized for video ${videoId} with cached data`);

                // Send cached data to content script with retry mechanism
                console.log('📤 Sending cached DATA_LOADED message to content script...');
                sendCachedDataWithRetry(tabId, cachedResult, 0);

                return;
            } catch (error) {
                console.error(`❌ Error loading cached data for video ${videoId}:`, error);
                // Fall through to regular initialization
            }
        }

        // No cached data or error loading cache - just mark as ready for manual analysis
        activeSessions.set(videoId, {
            tabId,
            videoId,
            videoUrl,
            status: 'ready'
        });

        console.log(`Session initialized for video ${videoId} - ready for manual analysis`);

    } catch (error) {
        console.error('Error initializing session:', error);
    }
}

// Handle video detection and start processing
async function handleVideoDetection(tabId, videoId, videoUrl) {
    try {
        console.log(`🎬 Starting video processing for: ${videoUrl}`);

        // Check cache first
        if (await isVideoInCache(videoId)) {
            console.log(`🗄️ Video ${videoId} found in cache, loading cached data...`);

            try {
                const cachedResult = await loadCachedVideo(videoId);

                // Mark session as completed with cached data
                activeSessions.set(videoId, {
                    tabId,
                    videoId,
                    videoUrl,
                    status: 'completed',
                    result: cachedResult,
                    fromCache: true
                });

                // Send cached data to content script
                console.log('📤 Sending cached ANALYSIS_COMPLETE message to content script...');
                chrome.tabs.sendMessage(tabId, {
                    type: 'ANALYSIS_COMPLETE',
                    data: {...cachedResult, fromCache: true }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Error sending cached message to content script:', chrome.runtime.lastError);
                    } else {
                        console.log('✅ Cached message sent to content script successfully');
                    }
                });

                return; // Exit early, no need to process
            } catch (cacheError) {
                console.warn('⚠️ Failed to load cached data, falling back to live processing:', cacheError);
                // Continue with live processing if cache fails
            }
        } else {
            console.log(`📡 Video ${videoId} not in cache, proceeding with live analysis...`);
        }

        // Mark session as processing (for live analysis)
        activeSessions.set(videoId, {
            tabId,
            videoId,
            videoUrl,
            status: 'processing'
        });

        // Establish SSE connection for real-time updates
        connectToClaimStream(videoId, tabId);

        // Notify content script that processing started
        chrome.tabs.sendMessage(tabId, {
            type: 'PROCESSING_STARTED',
            data: { videoId }
        });

        try {
            // Check if video is already cached
            const result = await processVideo(videoUrl);

            console.log('✅ API Response received successfully!');
            console.log('📊 Response type:', typeof result);
            console.log('📊 Response keys:', Object.keys(result || {}));
            console.log('📊 Response status:', result.status);

            // Check if we got cached results (claim_responses array exists)
            if (result.claim_responses && Array.isArray(result.claim_responses) && result.claim_responses.length > 0) {
                console.log(`✅ Found ${result.claim_responses.length} cached claim responses`);

                // Update session status with cached data
                activeSessions.set(videoId, {
                    tabId,
                    videoId,
                    videoUrl,
                    status: 'completed',
                    result: result,
                    fromCache: true
                });

                // Close SSE connection since we have cached data
                closeClaimStream(videoId);

                // Send cached data directly to content script
                console.log('📤 Sending cached ANALYSIS_COMPLETE message to content script...');
                chrome.tabs.sendMessage(tabId, {
                    type: 'ANALYSIS_COMPLETE',
                    data: {...result, fromCache: true }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Error sending message to content script:', chrome.runtime.lastError);
                    } else {
                        console.log('✅ Cached message sent to content script successfully');
                    }
                });
            }
            // If status is "processing", we need to extract and submit the transcript
            else if (result.status === 'processing') {
                console.log('⚙️ Video needs processing, extracting transcript...');

                // Request transcript extraction from content script
                chrome.tabs.sendMessage(tabId, {
                    type: 'EXTRACT_TRANSCRIPT',
                    data: { videoId, videoUrl }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Error requesting transcript extraction:', chrome.runtime.lastError);
                        // Fallback: SSE will handle real-time updates if backend processes it another way
                        console.log('⏳ Waiting for SSE updates...');
                    } else if (response && response.success) {
                        console.log('✅ Transcript extraction started');
                    }
                });

                // Keep session in processing state - SSE will deliver results
                console.log('⏳ Waiting for SSE stream to deliver claims...');
            } else {
                console.warn('⚠️ Unexpected API response format:', result);
            }

        } catch (error) {
            console.error('❌ Error processing video:', error);

            // Update session status
            activeSessions.set(videoId, {
                tabId,
                videoId,
                videoUrl,
                status: 'error'
            });

            // Close SSE connection
            closeClaimStream(videoId);

            // Notify content script of error
            chrome.tabs.sendMessage(tabId, {
                type: 'ANALYSIS_ERROR',
                data: { error: error.message }
            });
        }
    } catch (error) {
        console.error('❌ Error handling video detection:', error);
    }
}

// API Functions

// Establish SSE connection for real-time claim updates
async function connectToClaimStream(videoId, tabId) {
    // Close existing connection if any
    const existingConnection = activeSSEConnections.get(videoId);
    if (existingConnection) {
        existingConnection.close();
    }

    console.log(`📡 Establishing SSE connection for video: ${videoId}`);
    const settings = await getSettings();
    const sseUrl = `${settings.apiBaseUrl}/api/extension/stream-claims?video_id=${videoId}`;

    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
        console.log(`✅ SSE connection established for video: ${videoId}`);
    };

    eventSource.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('📨 Received SSE message:', message.type, message.data);

            switch (message.type) {
                case 'connected':
                    console.log(`🔗 SSE connected for video: ${message.data.videoId}`);
                    break;

                case 'claim':
                    // New claim extracted
                    console.log('🆕 New claim received:', message.data);

                    // Send to content script
                    chrome.tabs.sendMessage(tabId, {
                        type: 'NEW_CLAIM',
                        data: message.data
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn('⚠️ Could not send claim to content script:', chrome.runtime.lastError.message);
                        }
                    });
                    break;

                case 'claim_update':
                    // Claim status updated (e.g., fact-check completed)
                    console.log('🔄 Claim updated:', message.data);

                    // Send to content script
                    chrome.tabs.sendMessage(tabId, {
                        type: 'CLAIM_UPDATE',
                        data: message.data
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn('⚠️ Could not send update to content script:', chrome.runtime.lastError.message);
                        }
                    });
                    break;

                case 'error':
                    console.error('❌ SSE error:', message.data);
                    break;
            }
        } catch (error) {
            console.error('❌ Error parsing SSE message:', error);
        }
    };

    eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        eventSource.close();
        activeSSEConnections.delete(videoId);
    };

    activeSSEConnections.set(videoId, eventSource);
}

// Close SSE connection for a video
function closeClaimStream(videoId) {
    const connection = activeSSEConnections.get(videoId);
    if (connection) {
        console.log(`🔌 Closing SSE connection for video: ${videoId}`);
        connection.close();
        activeSSEConnections.delete(videoId);
    }
}

async function processVideo(videoUrl) {
    console.log('🌐 processVideo called with URL:', videoUrl);

    const settings = await getSettings();
    const encodedVideoUrl = encodeURIComponent(videoUrl);
    const apiUrl = `${settings.apiBaseUrl}/api/extension/process-video?video_url=${encodedVideoUrl}`;
    console.log('🚀 Making API call to:', apiUrl);

    const headers = {
        'Accept': 'application/json',
    };

    // Add API key if available
    if (settings.apiKey) {
        headers['X-OpenRouter-API-Key'] = settings.apiKey;
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: headers,
        });

        console.log('📡 API response status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response Body:', errorText);
            throw new Error(`Failed to process video: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ Successfully parsed JSON response');
        console.log('📝 Response data:', {
            keys: Object.keys(result),
            video_id: result.video_id,
            status: result.status,
            total_claims: result.total_claims,
            claim_responses_count: result.claim_responses ? result.claim_responses.length : 'undefined'
        });

        return result;
    } catch (error) {
        console.error('❌ Error in processVideo:', error);
        console.error('❌ Error stack:', error.stack);
        throw error;
    }
}


// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    // Find and remove any sessions associated with this tab
    for (const [videoId, session] of activeSessions.entries()) {
        if (session.tabId === tabId) {
            // Close SSE connection
            closeClaimStream(videoId);
            activeSessions.delete(videoId);
            break;
        }
    }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Background received message:', message.type, message);

    if (message.type === 'VIDEO_CHANGED') {
        // Content script notifies us of a video change
        const videoId = message.videoId;
        const tabId = sender.tab ? sender.tab.id : message.tabId;
        console.log('🔄 Video changed to:', videoId, 'on tab:', tabId);

        // Close any old SSE connections for the previous video
        // Find old sessions for this tab and close their connections
        for (const [oldVideoId, session] of activeSessions.entries()) {
            if (session.tabId === tabId && oldVideoId !== videoId) {
                console.log('🔌 Closing old SSE connection for previous video:', oldVideoId);
                closeClaimStream(oldVideoId);
                activeSessions.delete(oldVideoId);
            }
        }

        // Initialize new session
        if (videoId) {
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            initializeSession(tabId, videoId, videoUrl);
        }

        sendResponse({ success: true });
    } else if (message.type === 'GET_SESSION_DATA') {
        const videoId = message.videoId;
        const session = activeSessions.get(videoId);
        console.log('📋 GET_SESSION_DATA for video:', videoId, 'session:', session);
        sendResponse(session || null);
    } else if (message.type === 'CHECK_CACHE') {
        const videoId = message.videoId;
        isVideoInCache(videoId).then(isInCache => {
            console.log('🗄️ CHECK_CACHE for video:', videoId, 'found:', isInCache);
            sendResponse({ inCache: isInCache });
        }).catch(error => {
            console.error('❌ Error checking cache:', error);
            sendResponse({ inCache: false });
        });
        return true; // Keep message channel open for async response
    } else if (message.type === 'START_ANALYSIS') {
        console.log('🎬 Background received START_ANALYSIS message:', message);
        const videoId = message.videoId;
        const videoUrl = message.videoUrl;
        const tabId = sender.tab ? sender.tab.id : message.tabId;
        console.log('📋 Processing analysis request:', { videoId, videoUrl, tabId });

        if (videoId && videoUrl) {
            console.log('✅ Starting analysis for video:', videoId);

            // Start processing immediately
            handleVideoDetection(tabId, videoId, videoUrl);
            sendResponse({ success: true, status: 'processing' });
        } else {
            console.error('❌ Missing video ID or URL:', { videoId, videoUrl });
            sendResponse({ success: false, error: 'Missing video ID or URL' });
        }
        return true; // Keep message channel open for async response
    }
});

console.log('YouTube Fact-Checker background script loaded');