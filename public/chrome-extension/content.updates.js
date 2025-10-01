// Logic that reacts to current time and updates visible UI

YouTubeFactChecker.prototype.setupResizeListener = function() {
    // Debounced resize handler to prevent excessive repositioning
    let resizeTimeout;
    const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            this.repositionElements();
        }, 100);
    };

    // Listen for window resize
    window.addEventListener('resize', handleResize);

    // Listen for YouTube player size changes (fullscreen, theater mode, etc.)
    const playerContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (playerContainer && window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(playerContainer);
        this.playerResizeObserver = resizeObserver;
    }
};

YouTubeFactChecker.prototype.repositionElements = function() {
    // Reposition active indicator if it exists
    if (this.activeIndicator) {
        const playerContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
        const containerRect = playerContainer ? playerContainer.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };

        const cardWidth = this.motionTokens ? this.motionTokens.card.width : 320;
        const cardHeight = this.motionTokens ? this.motionTokens.card.height : 180;
        const margin = 20;

        // Recalculate position
        const wouldBeCutOffRight = (containerRect.width - margin) < cardWidth;
        const horizontalPosition = wouldBeCutOffRight ? `left: ${margin}px` : `right: ${margin}px`;
        const topPosition = Math.max(margin, Math.min(margin, containerRect.height - cardHeight - margin));

        // Update positioning
        this.activeIndicator.style.top = `${topPosition}px`;
        if (wouldBeCutOffRight) {
            this.activeIndicator.style.left = `${margin}px`;
            this.activeIndicator.style.right = 'auto';
        } else {
            this.activeIndicator.style.right = `${margin}px`;
            this.activeIndicator.style.left = 'auto';
        }
    }

    // Reposition any visible claim overlays
    const visibleClaims = document.querySelectorAll('.fact-check-claim');
    visibleClaims.forEach((overlay, index) => {
        const playerContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
        const containerRect = playerContainer ? playerContainer.getBoundingClientRect() : { width: window.innerWidth };

        const overlayWidth = 320;
        const margin = 20;
        const topPosition = 20 + index * 70;

        // Recalculate edge detection
        const wouldBeCutOff = (containerRect.width - margin) < overlayWidth;
        const adjustedWidth = Math.min(overlayWidth, containerRect.width - 80);
        const maxTop = Math.max(20, containerRect.height - 200);
        const adjustedTop = Math.min(topPosition, maxTop);

        // Update positioning
        overlay.style.top = `${adjustedTop}px`;
        overlay.style.width = `${adjustedWidth}px`;
        overlay.dataset.wouldBeCutOff = wouldBeCutOff;

        if (wouldBeCutOff) {
            overlay.style.left = `${margin}px`;
            overlay.style.right = 'auto';
        } else {
            overlay.style.right = `${margin}px`;
            overlay.style.left = 'auto';
        }
    });
};

YouTubeFactChecker.prototype.updateVisibleClaims = function() {
    // Work with both real API data and mock data - removed mockMode restriction
    if (!this.mockFactChecks || !this.activeIndicator || this.mockFactChecks.length === 0) return;

    // Debounce rapid calls to prevent excessive state changes
    if (this.updateDebounceTimer) {
        clearTimeout(this.updateDebounceTimer);
    }

    this.updateDebounceTimer = setTimeout(() => {
        this._performClaimUpdate();
    }, 100); // 100ms debounce
};

YouTubeFactChecker.prototype._performClaimUpdate = function() {
    // Find claims that should trigger at the current time (more precise matching)
    const currentClaim = this.mockFactChecks.find((factCheck) => {
        const startTime = this._getClaimStartTime(factCheck);
        // Only trigger when we cross the exact start time (within 0.5 second tolerance)
        return Math.abs(this.currentTime - startTime) <= 0.5 && this.currentTime >= startTime;
    });

    // Find if we're still within an active claim's duration (for display purposes)
    const activeClaim = this.mockFactChecks.find((factCheck) => {
        const startTime = this._getClaimStartTime(factCheck);
        const endTime = factCheck.endTimestamp || startTime + 8; // Shorter default duration
        return this.currentTime >= startTime && this.currentTime <= endTime;
    });

    // Only morph to card when we encounter a new claim start time
    if (currentClaim && !this.isMorphed && !this.isMorphing && !this.userInteracted) {
        console.log('🎯 Triggering morph for claim at', this._getClaimStartTime(currentClaim) + 's');
        this.morphToCard(currentClaim, true); // true indicates auto-open
        this.currentDisplayedClaim = currentClaim;
        this.scheduleAutoClose(currentClaim);
    }
    // Close when no active claims and user hasn't interacted
    else if (!activeClaim && this.isMorphed && !this.userInteracted) {
        console.log('⏹️ Auto-closing - no active claims');
        this.morphToFab();
        this.currentDisplayedClaim = null;
        this.clearAutoCloseTimer();
    }
    // Update content if we're morphed and have a different active claim
    else if (activeClaim && this.isMorphed && this.currentDisplayedClaim &&
        this._getClaimStartTime(this.currentDisplayedClaim) !== this._getClaimStartTime(activeClaim)) {
        console.log('🔄 Updating displayed claim content');
        this.injectCardContent(activeClaim);
        this.currentDisplayedClaim = activeClaim;
        this.scheduleAutoClose(activeClaim);
    }

    // Update FAB visual state only when not morphed
    if (this.activeIndicator && !this.isMorphed && activeClaim) {
        this._updateFabVisualState(activeClaim);
    }
};

YouTubeFactChecker.prototype._updateFabVisualState = function(claim) {
    if (!this.activeIndicator) return;

    // Only update visual state if it's different from current state
    const newBackground = this._getClaimBackgroundColor(claim);
    const newBoxShadow = this._getClaimBoxShadow(claim);

    if (this.activeIndicator.style.background !== newBackground) {
        this.activeIndicator.style.background = newBackground;
        this.activeIndicator.style.boxShadow = newBoxShadow;
    }
};

YouTubeFactChecker.prototype._getClaimBackgroundColor = function(claim) {
    if (claim.categoryOfLikeness === 'false') {
        return 'rgba(0, 0, 0, 0.2)';
    } else if (claim.categoryOfLikeness === 'neutral') {
        return 'rgba(0, 0, 0, 0.2)';
    } else {
        return 'rgba(0, 0, 0, 0.2)';
    }
};

YouTubeFactChecker.prototype._getClaimBoxShadow = function(claim) {
    if (claim.categoryOfLikeness === 'false') {
        return '0 0 0 1px rgba(255, 255, 255, 0.4), 0 8px 24px rgba(255, 59, 48, 0.3)';
    } else if (claim.categoryOfLikeness === 'neutral') {
        return '0 0 0 1px rgba(255, 255, 255, 0.4), 0 8px 24px rgba(255, 149, 0, 0.3)';
    } else {
        return '0 0 0 1px rgba(255, 255, 255, 0.4), 0 8px 24px rgba(10, 132, 255, 0.3)';
    }
};

YouTubeFactChecker.prototype._getClaimStartTime = function(claim) {
    // Handle different data structures:
    // - API format: claim.timestamp (mapped from claim.start)
    // - Raw JSON format: claim.start or claim.claim.start
    return claim.timestamp || claim.start || (claim.claim && claim.claim.start) || 0;
};

// Auto-close functionality
YouTubeFactChecker.prototype.scheduleAutoClose = function(claim) {
    // Clear any existing auto-close timer
    this.clearAutoCloseTimer();

    // Don't auto-close if user has manually interacted with the card
    if (this.userInteracted) {
        console.log('Skipping auto-close - user has interacted with overlay');
        return;
    }

    // Configure auto-close duration (in seconds)
    const autoCloseDuration = claim.autoCloseDuration || 8; // Default 8 seconds

    console.log(`⏰ Scheduling auto-close for claim at ${claim.timestamp}s in ${autoCloseDuration} seconds`);

    this.autoCloseTimer = setTimeout(() => {
        // Only auto-close if:
        // 1. We're still morphed
        // 2. User hasn't interacted
        // 3. The current claim is still the same one we scheduled for
        if (this.isMorphed && !this.userInteracted &&
            this.currentDisplayedClaim &&
            this.currentDisplayedClaim.timestamp === claim.timestamp) {

            console.log('⏰ Auto-closing fact-check overlay after timeout');
            this.morphToFab();
            this.currentDisplayedClaim = null;
        } else {
            console.log('⏰ Auto-close cancelled - conditions not met:', {
                isMorphed: this.isMorphed,
                userInteracted: this.userInteracted,
                hasCurrentClaim: !!this.currentDisplayedClaim,
                timestampMatch: this.currentDisplayedClaim ? this.currentDisplayedClaim.timestamp === claim.timestamp : false
            });
        }
        this.autoCloseTimer = null;
    }, autoCloseDuration * 1000);
};

YouTubeFactChecker.prototype.clearAutoCloseTimer = function() {
    if (this.autoCloseTimer) {
        clearTimeout(this.autoCloseTimer);
        this.autoCloseTimer = null;
    }
};

console.log('✅ Content updates module loaded');