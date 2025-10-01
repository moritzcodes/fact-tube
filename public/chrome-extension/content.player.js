// Player-related methods and video ID handling

YouTubeFactChecker.prototype.waitForPlayer = function() {
    console.log('⏳ Waiting for YouTube player...');
    return new Promise((resolve) => {
        let attempts = 0;
        const checkPlayer = () => {
            attempts++;
            const player = document.querySelector('video');
            console.log(`🔍 Player check attempt ${attempts}: player=${!!player}, pathname=${window.location.pathname}`);

            if (player && window.location.pathname === '/watch') {
                console.log('✅ YouTube player found!');
                this.player = player;
                resolve();
            } else {
                if (attempts > 20) {
                    console.warn('⚠️ Player not found after 20 attempts (10 seconds)');
                }
                setTimeout(checkPlayer, 500);
            }
        };
        checkPlayer();
    });
};

YouTubeFactChecker.prototype.extractVideoId = function() {
    console.log('🔍 Extracting video ID from URL...');
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    console.log('🆔 Video ID:', videoId);

    if (videoId && videoId !== this.videoId) {
        console.log('🆕 New video detected:', videoId);
        this.videoId = videoId;
        this.claims = [];
        this.factChecks = [];
        this.clearOverlays();
        this.clearTimeouts();

        // Reset interaction tracking for new video
        this.userInteracted = false;
        this.clearAutoCloseTimer();

        // Create active indicator only once for this video
        console.log('🎨 Creating active indicator button...');
        this.createActiveIndicator();
        console.log('✅ Active indicator created');

        console.log('📡 Requesting session data from background script...');
        // Request session data from background script (this will trigger API call)
        safeSendMessage({
                type: 'GET_SESSION_DATA',
                videoId: videoId,
            },
            (response) => {
                console.log('📬 Session data response:', response);
                if (response) {
                    this.handleSessionData(response);
                } else {
                    console.log('ℹ️ No existing session data, ready for manual analysis');
                }
            }
        );
    } else if (!videoId) {
        console.warn('⚠️ No video ID found in URL');
    } else {
        console.log('ℹ️ Same video ID, skipping re-initialization');
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