// Background script for YouTube Fact-Checker extension

const API_BASE_URL = 'http://localhost:8000';

// Mock mode flag - when true, no API calls are made  
// Set to false to use real backend API
const MOCK_MODE = false;

// Track active fact-checking sessions
const activeSessions = new Map();

// Cache for storing video analysis results
const videoCache = new Map();

// Initialize cache by checking for existing video analysis files
async function initializeCache() {
    try {
        console.log('🗄️ Initializing video cache...');
        const cacheStatus = await checkCacheStatus();
        if (cacheStatus.success) {
            console.log(`✅ Cache initialized with ${cacheStatus.cached_videos.length} videos`);
            // Store the list of cached video IDs for quick lookup
            cacheStatus.cached_videos.forEach(videoId => {
                videoCache.set(videoId, { exists: true, loaded: false });
            });
        }
    } catch (error) {
        console.warn('⚠️ Could not initialize cache:', error.message);
    }
}

// Check what videos are available in cache
async function checkCacheStatus() {
    const response = await fetch(`${API_BASE_URL}/api/cache/status`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`Failed to check cache status: ${response.statusText}`);
    }

    return await response.json();
}

// Load cached video data
async function loadCachedVideo(videoId) {
    try {
        console.log(`🗄️ Loading cached data for video: ${videoId}`);
        const response = await fetch(`${API_BASE_URL}/api/cache/video/${videoId}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
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

    // If not in cache memory, try checking with backend (maybe cache wasn't initialized)
    try {
        console.log(`🔄 Cache miss for ${videoId}, checking backend directly...`);
        const cacheStatus = await checkCacheStatus();
        if (cacheStatus.success && cacheStatus.cached_videos.includes(videoId)) {
            // Update local cache with this video
            videoCache.set(videoId, { exists: true, loaded: false });
            console.log(`✅ Found ${videoId} in backend cache, updated local cache`);
            return true;
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

// Initialize cache when background script loads
initializeCache();

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

        // Notify content script that processing started
        chrome.tabs.sendMessage(tabId, {
            type: 'PROCESSING_STARTED',
            data: { videoId }
        });

        try {
            // Process video and get results directly
            const result = await processVideo(videoUrl);

            console.log('✅ API Response received successfully!');
            console.log('📊 Response type:', typeof result);
            console.log('📊 Response keys:', Object.keys(result || {}));
            console.log('📊 Full response object:', result);

            // Validate the response structure
            if (result && typeof result === 'object') {
                console.log('✅ Response is a valid object');

                if (result.claim_responses && Array.isArray(result.claim_responses)) {
                    console.log(`✅ Found ${result.claim_responses.length} claim responses`);
                    result.claim_responses.forEach((claim, index) => {
                        console.log(`📋 Claim ${index + 1}:`, {
                            claim: claim.claim,
                            status: claim.status,
                            start: claim.start,
                            evidenceCount: claim.evidence ? claim.evidence.length : 0
                        });
                    });
                } else {
                    console.warn('⚠️ No claim_responses array found in response');
                }
            } else {
                console.error('❌ Response is not a valid object:', result);
            }

            // Update session status
            activeSessions.set(videoId, {
                tabId,
                videoId,
                videoUrl,
                status: 'completed',
                result: result // Store the result in session
            });

            // Send processed data directly to content script
            console.log('📤 Sending ANALYSIS_COMPLETE message to content script...');
            chrome.tabs.sendMessage(tabId, {
                type: 'ANALYSIS_COMPLETE',
                data: result
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Error sending message to content script:', chrome.runtime.lastError);
                } else {
                    console.log('✅ Message sent to content script successfully');
                }
            });

        } catch (error) {
            console.error('❌ Error processing video:', error);

            // Update session status
            activeSessions.set(videoId, {
                tabId,
                videoId,
                videoUrl,
                status: 'error'
            });

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

async function processVideo(videoUrl) {
    console.log('🌐 processVideo called with URL:', videoUrl);

    if (MOCK_MODE) {
        console.log('🎭 Running in mock mode');
        // In mock mode, return a fake job ID
        return { job_id: 'mock-job-' + Date.now() };
    }

    // Encode the video URL as a query parameter
    const encodedVideoUrl = encodeURIComponent(videoUrl);
    const apiUrl = `${API_BASE_URL}/api/process-video?video_url=${encodedVideoUrl}`;
    console.log('🚀 Making API call to:', apiUrl);

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        console.log('📡 API response status:', response.status, response.statusText);
        console.log('📡 API response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response Body:', errorText);
            throw new Error(`Failed to process video: ${response.statusText} - ${errorText}`);
        }

        // Get the raw response text first to debug
        const responseText = await response.text();
        console.log('📄 Raw API response text:', responseText);
        console.log('📄 Raw API response length:', responseText.length);

        // Try to parse the JSON
        let result;
        try {
            result = JSON.parse(responseText);
            console.log('✅ Successfully parsed JSON response');
            console.log('📝 Parsed JSON structure:', {
                keys: Object.keys(result),
                video_id: result.video_id,
                title: result.title,
                total_claims: result.total_claims,
                claim_responses_count: result.claim_responses ? result.claim_responses.length : 'undefined'
            });
            console.log('📝 Full API response data:', JSON.stringify(result, null, 2));
        } catch (parseError) {
            console.error('❌ Failed to parse JSON response:', parseError);
            console.error('❌ Response text that failed to parse:', responseText);
            throw new Error(`Invalid JSON response: ${parseError.message}`);
        }

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
            activeSessions.delete(videoId);
            break;
        }
    }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Background received message:', message.type, message);

    if (message.type === 'GET_SESSION_DATA') {
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
    } else if (message.type === 'START_MOCK_ANALYSIS') {
        const videoId = message.videoId;
        const tabId = sender.tab ? sender.tab.id : message.tabId;

        if (MOCK_MODE && videoId) {
            // Set session as processing in mock mode
            activeSessions.set(videoId, {
                tabId,
                videoId,
                status: 'processing'
            });

            // Simulate processing completion after a delay
            setTimeout(() => {
                const session = activeSessions.get(videoId);
                if (session) {
                    session.status = 'completed';

                    // Notify content script that mock processing is complete
                    try {
                        chrome.tabs.sendMessage(tabId, {
                            type: 'MOCK_ANALYSIS_COMPLETE',
                            data: { videoId }
                        });
                    } catch (error) {
                        console.log('Could not send message to content script');
                    }
                }
            }, 2000);

            sendResponse({ success: true, status: 'processing' });
        } else {
            sendResponse({ success: false, error: 'Not in mock mode or missing video ID' });
        }
    }
});

console.log('YouTube Fact-Checker background script loaded');