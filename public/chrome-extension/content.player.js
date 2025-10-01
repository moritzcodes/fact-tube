// Player-related methods and video ID handling

YouTubeFactChecker.prototype.waitForPlayer = function() {
    return new Promise((resolve) => {
        const checkPlayer = () => {
            const player = document.querySelector('video');
            if (player && window.location.pathname === '/watch') {
                this.player = player;
                resolve();
            } else {
                setTimeout(checkPlayer, 500);
            }
        };
        checkPlayer();
    });
};

YouTubeFactChecker.prototype.extractVideoId = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');

    if (videoId && videoId !== this.videoId) {
        this.videoId = videoId;
        this.claims = [];
        this.factChecks = [];
        this.clearOverlays();
        this.clearTimeouts();

        // Reset interaction tracking for new video
        this.userInteracted = false;
        this.clearAutoCloseTimer();

        // Create active indicator only once for this video
        this.createActiveIndicator();

        if (this.mockMode) {
            // Load mock data instead of API calls
            this.loadMockData();
        } else {
            // Request session data from background script (this will trigger API call)
            chrome.runtime.sendMessage({
                    type: 'GET_SESSION_DATA',
                    videoId: videoId,
                },
                (response) => {
                    if (response) {
                        this.handleSessionData(response);
                    }
                }
            );
        }
    }
};

YouTubeFactChecker.prototype.setupTimeTracking = function() {
    if (!this.player) return;

    // Track video time updates
    this.player.addEventListener('timeupdate', () => {
        this.currentTime = this.player.currentTime;
        this.updateVisibleClaims();
    });

    // Handle video navigation
    this.player.addEventListener('seeked', () => {
        this.currentTime = this.player.currentTime;
        this.updateVisibleClaims();
    });

    // Listen for metadata loaded to create timeline markers
    this.player.addEventListener('loadedmetadata', () => {
        if (this.mockFactChecks) {
            this.createTimelineMarkers();
        }
    });

    // Also listen for duration change
    this.player.addEventListener('durationchange', () => {
        if (this.mockFactChecks) {
            this.createTimelineMarkers();
        }
    });
};