// Core class definition for YouTube Fact-Checker content script

class YouTubeFactChecker {
    constructor() {
        this.videoId = null;
        this.claims = [];
        this.factChecks = [];
        this.overlayContainer = null;
        this.currentTime = 0;
        this.player = null;
        this.isInitialized = false;
        this.activeIndicator = null;
        this.popupTimeouts = [];
        this.currentDisplayedClaim = null;
        this.motionTokens = null;
        this.indicatorIcon = null;
        this.isMorphed = false;
        this.isMorphing = false;
        this.currentTooltip = null; // Track current tooltip
        this.isAnalysisInProgress = false; // Track analysis state
        this.mockFactChecks = []; // Store fact-check results
        this.userInteracted = false; // Track if user has manually interacted with overlay
        this.autoCloseTimer = null; // Timer for auto-closing overlay (legacy)
        this.videoPlaybackTimer = null; // Timer for video playback-based auto-close
        this.autoCloseTargetTime = null; // Target video time for auto-close
        this.autoCloseClaimTimestamp = null; // Claim timestamp for auto-close verification
    }

    init() {
        console.log('🎯 YouTubeFactChecker.init() called');

        // Wait for YouTube player to load
        this.waitForPlayer().then(() => {
            console.log('✅ YouTube player detected');
            this.setupTimeTracking();
            console.log('✅ Time tracking setup complete');
            this.createOverlayContainer();
            console.log('✅ Overlay container created');
            this.extractVideoId(); // This will create the active indicator
            console.log('✅ Video ID extracted and indicator created');
            this.setupResizeListener(); // Add resize listener for dynamic repositioning
            console.log('✅ Resize listener setup complete');
            this.isInitialized = true;
            console.log('✅ YouTubeFactChecker initialization complete!');
        }).catch(error => {
            console.error('❌ Error during initialization:', error);
        });

        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📨 Content script received message:', message.type);
            this.handleMessage(message, sendResponse);
            // Return true to indicate we'll respond asynchronously
            if (message.type === 'EXTRACT_TRANSCRIPT') {
                return true;
            }
        });
        console.log('✅ Message listener registered');
    }
}