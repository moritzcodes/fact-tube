// API service for real fact-checking data

YouTubeFactChecker.prototype.startAnalysis = function() {
    console.log('🚀 startAnalysis called!');

    if (this.isAnalysisInProgress) {
        console.log('Analysis already in progress');
        return;
    }

    const videoUrl = window.location.href;
    console.log('📹 Starting analysis for video:', videoUrl);

    this.isAnalysisInProgress = true;
    this.updateButtonState();

    // Extract video ID from URL
    const videoId = this.extractVideoIdFromUrl(videoUrl);
    console.log('🆔 Extracted video ID:', videoId);

    if (!videoId) {
        console.error('❌ Could not extract video ID from URL:', videoUrl);
        this.isAnalysisInProgress = false;
        this.updateButtonState();
        this.handleAnalysisError(new Error('Could not extract video ID from URL'));
        return;
    }

    // First check if video is in cache
    this.checkVideoCache(videoId, videoUrl);
};

YouTubeFactChecker.prototype.checkVideoCache = function(videoId, videoUrl) {
    console.log('🗄️ Checking cache for video:', videoId);

    chrome.runtime.sendMessage({
        type: 'CHECK_CACHE',
        videoId: videoId
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn('⚠️ Cache check failed, proceeding with live analysis:', chrome.runtime.lastError);
            this.startLiveAnalysis(videoId, videoUrl);
            return;
        }

        if (response && response.inCache) {
            console.log('✅ Video found in cache, loading cached data...');
            this.startLiveAnalysis(videoId, videoUrl); // Backend will handle cache loading
        } else {
            console.log('📡 Video not in cache, starting live analysis...');
            this.startLiveAnalysis(videoId, videoUrl);
        }
    });
};

YouTubeFactChecker.prototype.startLiveAnalysis = function(videoId, videoUrl) {
    if (!this.isAnalysisInProgress) return; // Safety check

    console.log('📨 Sending message to background script:', {
        type: 'START_ANALYSIS',
        videoId: videoId,
        videoUrl: videoUrl
    });

    // Send message to background script to start analysis
    chrome.runtime.sendMessage({
        type: 'START_ANALYSIS',
        videoId: videoId,
        videoUrl: videoUrl
    }, (response) => {
        console.log('📩 Received response from background script:', response);
        if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            this.isAnalysisInProgress = false;
            this.updateButtonState();
            this.handleAnalysisError(new Error('Failed to communicate with background script'));
            return;
        }

        if (!response || !response.success) {
            this.isAnalysisInProgress = false;
            this.updateButtonState();
        } else {
            console.log('✅ Analysis started successfully, waiting for results...');
        }
        // If successful, the background script will send the results via message
    });
};

YouTubeFactChecker.prototype.extractVideoIdFromUrl = function(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('v');
    } catch (error) {
        console.error('Error parsing URL:', error);
        return null;
    }
};

YouTubeFactChecker.prototype.processVideo = async function(videoUrl) {
    const API_BASE_URL = 'http://localhost:3000';

    try {
        // Encode the video URL as a query parameter
        const encodedVideoUrl = encodeURIComponent(videoUrl);
        const response = await fetch(`${API_BASE_URL}/api/process-video?video_url=${encodedVideoUrl}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Cannot connect to server. Make sure the backend is running on localhost:8000');
        }
        throw error;
    }
};


YouTubeFactChecker.prototype.handleAnalysisComplete = function(result) {
    console.log('✅ handleAnalysisComplete called');
    console.log('📊 Result object:', result);
    console.log('📊 Result keys:', Object.keys(result || {}));
    console.log('📊 Claim responses:', result.claim_responses);

    // Reset analysis state
    console.log('🔄 Resetting analysis state...');
    this.isAnalysisInProgress = false;
    this.updateButtonState();

    // Transform API response to match existing overlay format
    if (result.claim_responses && result.claim_responses.length > 0) {
        this.mockFactChecks = result.claim_responses.map(claimResponse => ({
            timestamp: claimResponse.claim.start,
            endTimestamp: claimResponse.claim.start + 10, // Default 10-second duration
            claim: claimResponse.claim.claim,
            status: claimResponse.status, // Use actual API status instead of mapping
            sources: claimResponse.evidence ? claimResponse.evidence.map(ev => ev.source_url).filter(Boolean) : [],
            evidence: claimResponse.evidence || [], // Preserve full evidence data for clickable links
            judgement: {
                reasoning: claimResponse.written_summary || 'No detailed explanation provided',
                summary: claimResponse.written_summary ?
                    claimResponse.written_summary.split('.')[0] + '.' : `Status: ${claimResponse.status}`
            }
        }));

        console.log('Processed fact-check data:', this.mockFactChecks.length, 'claims');

        // Load or create grouping data
        this.loadOrCreateGrouping();

        // Create timeline markers with real data
        this.createTimelineMarkers();

        // Create summary for logging
        const summary = result.summary || this.createSummaryFromClaims();
        console.log('✅ Analysis complete. Found', this.mockFactChecks.length, 'claims');
        console.log('📊 Summary:', summary);
    } else {
        // No claims found
        console.log('No claims found in video');
    }
};

YouTubeFactChecker.prototype.handleAnalysisError = function(error) {
    console.error('❌ handleAnalysisError called');
    console.error('❌ Error object:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);

    // Reset analysis state
    console.log('🔄 Resetting analysis state after error...');
    this.isAnalysisInProgress = false;
    this.updateButtonState();

    console.error('❌ Analysis failed:', error.message);
};


YouTubeFactChecker.prototype.createSummaryFromClaims = function() {
    const summary = { verified: 0, false: 0, disputed: 0, inconclusive: 0 };

    this.mockFactChecks.forEach(claim => {
        const status = (claim.status || '').toLowerCase();
        if (status === 'verified' || status === 'true') summary.verified++;
        else if (status === 'false') summary.false++;
        else if (status === 'disputed') summary.disputed++;
        else if (status === 'inconclusive' || status === 'neutral') summary.inconclusive++;
    });

    console.log('📊 Created summary from claims:', summary);
    console.log('📊 Claims data:', this.mockFactChecks.map(c => ({
        claim: c.claim,
        status: c.status
    })));

    return summary;
};

/**
 * Load or create grouping data for timeline markers
 * Persists grouping information across page reloads
 */
YouTubeFactChecker.prototype.loadOrCreateGrouping = function() {
    const videoId = this.extractVideoIdFromUrl(window.location.href);
    if (!videoId) return;

    const storageKey = `grouping_${videoId}`;

    try {
        // Try to load stored grouping data
        const storedData = localStorage.getItem(storageKey);

        if (storedData) {
            const parsed = JSON.parse(storedData);
            // Validate that stored data matches current claims
            if (parsed.claimCount === this.mockFactChecks.length && parsed.grouping) {
                console.log('📦 Loaded stored grouping data:', parsed.grouping.length, 'groups');
                this.markerGrouping = parsed.grouping;
                return;
            } else {
                console.log('⚠️ Stored grouping data outdated, recreating...');
            }
        }
    } catch (error) {
        console.warn('⚠️ Error loading grouping data:', error);
    }

    // Create new grouping if no valid stored data exists
    console.log('🆕 Creating new grouping data...');
    const video = document.querySelector('video');
    if (!video || !video.duration) {
        console.warn('⚠️ Cannot create grouping - video not ready');
        this.markerGrouping = null;
        return;
    }

    const videoDuration = video.duration;
    const minVisualSpacing = videoDuration * 0.02; // 2% of video duration
    const groups = this.groupClaimsByProximity(this.mockFactChecks, minVisualSpacing);

    // Store grouping data
    this.markerGrouping = groups;

    // Persist to localStorage
    try {
        localStorage.setItem(storageKey, JSON.stringify({
            claimCount: this.mockFactChecks.length,
            grouping: groups,
            timestamp: Date.now()
        }));
        console.log('💾 Saved grouping data to localStorage');
    } catch (error) {
        console.warn('⚠️ Error saving grouping data:', error);
    }
};

/**
 * Clear stored grouping data for current video
 */
YouTubeFactChecker.prototype.clearStoredGrouping = function() {
    const videoId = this.extractVideoIdFromUrl(window.location.href);
    if (videoId) {
        const storageKey = `grouping_${videoId}`;
        localStorage.removeItem(storageKey);
        console.log('🗑️ Cleared stored grouping data');
    }
    this.markerGrouping = null;
};

/**
 * Clean up old grouping data from localStorage (older than 7 days)
 * Prevents localStorage bloat from accumulating old video data
 */
YouTubeFactChecker.prototype.cleanupOldGroupingData = function() {
    try {
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        const keysToRemove = [];

        // Scan through localStorage for grouping keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('grouping_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data && data.timestamp && (now - data.timestamp) > maxAge) {
                        keysToRemove.push(key);
                    }
                } catch (e) {
                    // Invalid data, mark for removal
                    keysToRemove.push(key);
                }
            }
        }

        // Remove old keys
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('🧹 Cleaned up old grouping data:', key);
        });

        if (keysToRemove.length > 0) {
            console.log(`✅ Cleaned up ${keysToRemove.length} old grouping entries`);
        }
    } catch (error) {
        console.warn('⚠️ Error cleaning up old grouping data:', error);
    }
};



YouTubeFactChecker.prototype.createTimelineMarkers = function() {
    // Remove existing markers and tooltips completely
    const existingMarkers = document.querySelectorAll('.fact-check-timeline-marker, .fact-check-marker-group');
    existingMarkers.forEach((marker) => marker.remove());

    // Also clear any existing tooltips
    this.hideTimelineTooltip();

    if (!this.mockFactChecks || this.mockFactChecks.length === 0) return;

    // Ensure glass filter exists for liquid glass effect
    this.createGlassFilter();

    // Add tooltip animation styles
    this.addTooltipStyles();

    // Find YouTube progress bar container
    const progressContainer =
        document.querySelector('.ytp-progress-bar-container') ||
        document.querySelector('.ytp-progress-bar');

    if (!progressContainer) {
        // Retry after a delay if progress bar not found
        setTimeout(() => this.createTimelineMarkers(), 1000);
        return;
    }

    // Get video duration to calculate marker positions
    const video = document.querySelector('video');
    if (!video || !video.duration) {
        setTimeout(() => this.createTimelineMarkers(), 1000);
        return;
    }

    const videoDuration = video.duration;

    // Use stored grouping data if available, otherwise create new grouping
    let markerGroups;
    if (this.markerGrouping && this.markerGrouping.length > 0) {
        console.log('📦 Using stored marker grouping:', this.markerGrouping.length, 'groups');
        markerGroups = this.markerGrouping;
    } else {
        // Fallback: Create new grouping if none exists
        console.log('🆕 Creating new marker grouping (fallback)...');
        const minVisualSpacing = videoDuration * 0.02; // 2% of video duration
        markerGroups = this.groupClaimsByProximity(this.mockFactChecks, minVisualSpacing);
        this.markerGrouping = markerGroups;
    }

    console.log(`📍 Creating ${markerGroups.length} marker groups from ${this.mockFactChecks.length} claims`);
    console.log('📍 Marker groups:', markerGroups.map(g => ({ claimCount: g.claims.length, timestamp: g.timestamp })));

    // Create markers or groups
    markerGroups.forEach((group, groupIndex) => {
        if (group.claims.length === 1) {
            // Single marker
            this.createSingleMarker(group.claims[0], group.claims[0].index, progressContainer, videoDuration);
        } else {
            // Group marker
            this.createGroupMarker(group, groupIndex, progressContainer, videoDuration);
        }
    });

    console.log(`✅ Created ${markerGroups.length} timeline markers (${this.mockFactChecks.length} total claims)`);
};

/**
 * Group claims that are too close together visually
 */
YouTubeFactChecker.prototype.groupClaimsByProximity = function(claims, minSpacing) {
    if (claims.length <= 1) {
        return claims.map((claim, index) => ({
            claims: [{...claim, index }],
            timestamp: claim.timestamp
        }));
    }

    // Sort by timestamp and add indices
    const sorted = claims.map((claim, index) => ({...claim, index }))
        .sort((a, b) => a.timestamp - b.timestamp);

    const groups = [];
    let currentGroup = { claims: [sorted[0]], timestamp: sorted[0].timestamp };

    for (let i = 1; i < sorted.length; i++) {
        const claim = sorted[i];
        const lastClaim = currentGroup.claims[currentGroup.claims.length - 1];

        // If claim is within minSpacing of last claim in group, add to group
        if (claim.timestamp - lastClaim.timestamp < minSpacing) {
            currentGroup.claims.push(claim);
        } else {
            // Start new group
            groups.push(currentGroup);
            currentGroup = { claims: [claim], timestamp: claim.timestamp };
        }
    }

    // Add last group
    groups.push(currentGroup);

    return groups;
};

/**
 * Create a single timeline marker
 */
YouTubeFactChecker.prototype.createSingleMarker = function(factCheck, index, progressContainer, videoDuration) {
    const marker = document.createElement('div');
    marker.className = 'fact-check-timeline-marker liquidGlass-wrapper';
    marker.setAttribute('data-claim-index', index);
    marker.setAttribute('data-timestamp', factCheck.timestamp);

    // Calculate position as percentage
    const position = (factCheck.timestamp / videoDuration) * 100;

    marker.style.cssText = `
      position: absolute;
      top: -16px;
      left: ${position}%;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      cursor: pointer;
      z-index: 1000;
      opacity: 0.95;
      transition: all 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4), 0 4px 12px rgba(255, 255, 255, 0.25);
      transform: translateX(-50%);
      overflow: hidden;
      pointer-events: auto;
    `;

    // Create liquid glass layers
    const effect = document.createElement('div');
    effect.className = 'liquidGlass-effect';
    effect.style.cssText = `
      position: absolute; z-index: 0; inset: 0; border-radius: inherit; 
      filter: url(#glass-distortion); 
      overflow: hidden; isolation: isolate;
      pointer-events: none;
    `;

    const tint = document.createElement('div');
    tint.className = 'liquidGlass-tint';
    // Map status to simplified category for timeline colors
    const timelineCategory = this.mapStatusToTimelineCategory(factCheck.status);
    tint.style.cssText = `
      z-index: 1; position: absolute; inset: 0; border-radius: inherit; 
      background: ${this.getCategoryColor(timelineCategory)}70;
      pointer-events: none;
    `;

    const shine = document.createElement('div');
    shine.className = 'liquidGlass-shine';
    shine.style.cssText = `
      position: absolute; inset: 0; z-index: 2; border-radius: inherit; overflow: hidden; 
      box-shadow: inset 1px 1px 1px 0 rgba(255, 255, 255, 0.2), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.1);
      pointer-events: none;
    `;

    marker.appendChild(effect);
    marker.appendChild(tint);
    marker.appendChild(shine);

    // Add hover effects
    marker.addEventListener('mouseenter', () => {
        const timelineCategory = this.mapStatusToTimelineCategory(factCheck.status);
        marker.style.opacity = '1';
        marker.style.width = '20px';
        marker.style.height = '20px';
        marker.style.top = '-24px';
        marker.style.transform = 'translateX(-50%) scale(1.15)';
        marker.style.boxShadow = `0 0 0 2px rgba(255, 255, 255, 0.6), 
                                 0 8px 24px rgba(255, 255, 255, 0.4),
                                 0 0 20px ${this.getCategoryColor(timelineCategory)}60`;
        marker.style.zIndex = '1001';
        this.showTimelineTooltip(marker, factCheck);
    });

    marker.addEventListener('mouseleave', () => {
        marker.style.opacity = '0.95';
        marker.style.width = '14px';
        marker.style.height = '14px';
        marker.style.top = '-16px';
        marker.style.transform = 'translateX(-50%) scale(1)';
        marker.style.boxShadow = `0 0 0 1px rgba(255, 255, 255, 0.4), 0 4px 12px rgba(255, 255, 255, 0.25)`;
        marker.style.zIndex = '1000';
        this.hideTimelineTooltip();
    });

    // Add click handler
    marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.jumpToTimestamp(factCheck.timestamp);
    });

    progressContainer.appendChild(marker);
};

/**
 * Create a grouped timeline marker for multiple claims
 */
YouTubeFactChecker.prototype.createGroupMarker = function(group, groupIndex, progressContainer, videoDuration) {
    const marker = document.createElement('div');
    marker.className = 'fact-check-marker-group liquidGlass-wrapper';
    marker.setAttribute('data-group-index', groupIndex);
    marker.setAttribute('data-claim-count', group.claims.length);

    // Use average position of all claims in group
    const avgTimestamp = group.claims.reduce((sum, c) => sum + c.timestamp, 0) / group.claims.length;
    const position = (avgTimestamp / videoDuration) * 100;

    marker.style.cssText = `
      position: absolute;
      top: -16px;
      left: ${position}%;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      cursor: pointer;
      z-index: 1000;
      opacity: 0.95;
      transition: all 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5), 0 4px 12px rgba(255, 255, 255, 0.3);
      transform: translateX(-50%);
      overflow: hidden;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create liquid glass layers
    const effect = document.createElement('div');
    effect.className = 'liquidGlass-effect';
    effect.style.cssText = `
      position: absolute; z-index: 0; inset: 0; border-radius: inherit; 
      filter: url(#glass-distortion); 
      overflow: hidden; isolation: isolate;
      pointer-events: none;
    `;

    // Mix colors based on statuses in group
    const tint = document.createElement('div');
    tint.className = 'liquidGlass-tint';
    tint.style.cssText = `
      z-index: 1; position: absolute; inset: 0; border-radius: inherit; 
      background: linear-gradient(135deg, #60A5FA70, #A78BFA70);
      pointer-events: none;
    `;

    const shine = document.createElement('div');
    shine.className = 'liquidGlass-shine';
    shine.style.cssText = `
      position: absolute; inset: 0; z-index: 2; border-radius: inherit; overflow: hidden; 
      box-shadow: inset 1px 1px 1px 0 rgba(255, 255, 255, 0.2), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.1);
      pointer-events: none;
    `;

    // Add count badge
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: relative;
      z-index: 3;
      font-size: 9px;
      font-weight: 700;
      color: white;
      pointer-events: none;
    `;
    badge.textContent = group.claims.length;

    marker.appendChild(effect);
    marker.appendChild(tint);
    marker.appendChild(shine);
    marker.appendChild(badge);

    // Add hover effects
    marker.addEventListener('mouseenter', () => {
        marker.style.opacity = '1';
        marker.style.width = '24px';
        marker.style.height = '24px';
        marker.style.top = '-24px';
        marker.style.transform = 'translateX(-50%) scale(1.15)';
        marker.style.boxShadow = `0 0 0 2px rgba(255, 255, 255, 0.7), 
                                 0 8px 24px rgba(255, 255, 255, 0.5)`;
        marker.style.zIndex = '1001';
        this.showGroupTooltip(marker, group);
    });

    marker.addEventListener('mouseleave', () => {
        marker.style.opacity = '0.95';
        marker.style.width = '18px';
        marker.style.height = '18px';
        marker.style.top = '-16px';
        marker.style.transform = 'translateX(-50%) scale(1)';
        marker.style.boxShadow = `0 0 0 1px rgba(255, 255, 255, 0.5), 0 4px 12px rgba(255, 255, 255, 0.3)`;
        marker.style.zIndex = '1000';
        this.hideTimelineTooltip();
    });

    // Add click handler - jump to first claim in group and potentially show claims sequentially
    marker.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log(`🔍 Clicked group marker with ${group.claims.length} claims`);
        // Jump to the first claim's timestamp
        this.jumpToTimestamp(group.claims[0].timestamp);
        // Note: The time update listener will automatically show relevant claims as the video plays
    });

    progressContainer.appendChild(marker);
};

/**
 * Show tooltip for grouped markers - simplified to just show count and time range
 */
YouTubeFactChecker.prototype.showGroupTooltip = function(marker, group) {
    // Remove existing tooltip
    this.hideTimelineTooltip();
    this.createGlassFilter();

    console.log('📍 showGroupTooltip called for group:', group);

    const tooltip = document.createElement('div');
    tooltip.className = 'fact-check-timeline-tooltip liquidGlass-wrapper';

    const markerRect = marker.getBoundingClientRect();
    const progressContainer = marker.closest('.ytp-progress-bar-container') || marker.closest('.ytp-progress-bar') || marker.parentElement;
    const containerRect = progressContainer.getBoundingClientRect();
    const markerCenterX = markerRect.left + (markerRect.width / 2) - containerRect.left;

    const tooltipWidth = 200; // Smaller width for simplified tooltip
    const containerWidth = containerRect.width;
    let leftPosition = markerCenterX;
    let transform = 'translateX(-50%)';

    if (markerCenterX - tooltipWidth / 2 < 0) {
        leftPosition = 10;
        transform = 'translateX(0)';
    } else if (markerCenterX + tooltipWidth / 2 > containerWidth) {
        leftPosition = containerWidth - 10;
        transform = 'translateX(-100%)';
    }

    // Calculate time range for the group
    const timestamps = group.claims.map(c => c.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps.map((t, i) => group.claims[i].endTimestamp || (t + 10)));
    const timeRange = `${this.formatTime(minTime)} - ${this.formatTime(maxTime)}`;

    tooltip.style.cssText = `
        position: absolute;
        top: -68px;
        left: ${leftPosition}px;
        transform: ${transform};
        padding: 8px 16px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 10000;
        white-space: nowrap;
        color: white;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.4);
        pointer-events: none;
        overflow: hidden;
        opacity: 0;
        transform: ${transform} scale(0.9);
        transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;

    // Liquid glass structure
    const effect = document.createElement('div');
    effect.className = 'liquidGlass-effect';
    effect.style.cssText = `
        position: absolute; z-index: 0; inset: 0; border-radius: inherit; 
        backdrop-filter: blur(8px) saturate(1.2); filter: url(#glass-distortion); 
        overflow: hidden; isolation: isolate; pointer-events: none;
    `;

    const tint = document.createElement('div');
    tint.className = 'liquidGlass-tint';
    tint.style.cssText = `
        z-index: 1; position: absolute; inset: 0; border-radius: inherit;
        background: rgba(0, 0, 0, 0.2); backdrop-filter: blur(8px) saturate(1.2);
        pointer-events: none;
    `;

    const shine = document.createElement('div');
    shine.className = 'liquidGlass-shine';
    shine.style.cssText = `
        position: absolute; inset: 0; z-index: 2; border-radius: inherit; overflow: hidden; 
        box-shadow: inset 1px 1px 2px 0 rgba(255, 255, 255, 0.2), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.1);
        pointer-events: none;
    `;

    const contentContainer = document.createElement('div');
    contentContainer.className = 'liquidGlass-text';
    contentContainer.style.cssText = `
        z-index: 3; position: relative; 
        color: white; pointer-events: none;
        display: flex; align-items: center; gap: 8px;
    `;

    // Simplified content - just count and time range, similar to single marker tooltips
    contentContainer.innerHTML = `
        <span style="font-size: 14px; color: rgba(96, 165, 250, 1);">📊</span>
        <span style="text-transform: uppercase; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; color: rgba(96, 165, 250, 1);">${group.claims.length} CLAIMS</span>
        <span style="color: rgba(255, 255, 255, 0.6); font-size: 11px;">•</span>
        <span style="font-size: 11px; color: rgba(255, 255, 255, 0.9); font-weight: 400;">${timeRange}</span>
    `;

    tooltip.appendChild(effect);
    tooltip.appendChild(tint);
    tooltip.appendChild(shine);
    tooltip.appendChild(contentContainer);
    progressContainer.appendChild(tooltip);
    this.currentTooltip = tooltip;

    requestAnimationFrame(() => {
        tooltip.style.opacity = '1';
        tooltip.style.transform = `${transform} scale(1)`;
    });
};

YouTubeFactChecker.prototype.showTimelineTooltip = function(marker, factCheck) {
    // Remove existing tooltip immediately
    this.hideTimelineTooltip();

    // Ensure glass filter exists
    this.createGlassFilter();

    const tooltip = document.createElement('div');
    tooltip.className = 'fact-check-timeline-tooltip liquidGlass-wrapper';

    // Get the marker's exact position using getBoundingClientRect for pixel-perfect positioning
    const markerRect = marker.getBoundingClientRect();
    const progressContainer = marker.closest('.ytp-progress-bar-container') || marker.closest('.ytp-progress-bar') || marker.parentElement;
    const containerRect = progressContainer.getBoundingClientRect();

    // Calculate tooltip position relative to the container
    const markerCenterX = markerRect.left + (markerRect.width / 2) - containerRect.left;

    // Check for edge detection to prevent cutoff
    const tooltipWidth = 200; // Estimated tooltip width
    const containerWidth = containerRect.width;
    let leftPosition = markerCenterX;
    let transform = 'translateX(-50%)';

    // Adjust position if would be cut off on edges
    if (markerCenterX - tooltipWidth / 2 < 0) {
        leftPosition = 10;
        transform = 'translateX(0)';
    } else if (markerCenterX + tooltipWidth / 2 > containerWidth) {
        leftPosition = containerWidth - 10;
        transform = 'translateX(-100%)';
    }

    // Position tooltip directly above marker center with liquid glass styling
    tooltip.style.cssText = `
        position: absolute;
        top: -68px;
        left: ${leftPosition}px;
        transform: ${transform};
        padding: 8px 16px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 10000;
        white-space: nowrap;
        color: white;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.4);
        pointer-events: none;
        overflow: hidden;
        opacity: 0;
        transform: ${transform} scale(0.9);
        transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    `;

    // Create liquid glass structure
    const effect = document.createElement('div');
    effect.className = 'liquidGlass-effect';
    effect.style.cssText = `
        position: absolute; z-index: 0; inset: 0; border-radius: inherit; 
        backdrop-filter: blur(8px) saturate(1.2); 
        filter: url(#glass-distortion); 
        overflow: hidden; isolation: isolate;
        pointer-events: none;
    `;

    const tint = document.createElement('div');
    tint.className = 'liquidGlass-tint';
    tint.style.cssText = `
        z-index: 1; position: absolute; inset: 0; border-radius: inherit;
        height: 100%;
        background: rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(8px) saturate(1.2);
        pointer-events: none;
    `;

    const shine = document.createElement('div');
    shine.className = 'liquidGlass-shine';
    shine.style.cssText = `
        position: absolute; inset: 0; z-index: 2; border-radius: inherit; overflow: hidden; 
        box-shadow: inset 1px 1px 2px 0 rgba(255, 255, 255, 0.2), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.1);
        pointer-events: none;
    `;

    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'liquidGlass-text';
    contentContainer.style.cssText = `
        z-index: 3; position: relative; 
        color: white; pointer-events: none;
        display: flex; align-items: center; gap: 8px;
    `;

    // Enhanced content with better formatting
    const endTime = factCheck.endTimestamp || (factCheck.timestamp + 10);
    // Map status to simplified category for timeline tooltip
    const timelineCategory = this.mapStatusToTimelineCategory(factCheck.status);
    const categoryIcon = this.getCategoryIcon(timelineCategory);
    const categoryColor = this.getCategoryColor(timelineCategory);

    contentContainer.innerHTML = `
        <span style="font-size: 14px; color: ${categoryColor};">${categoryIcon}</span>
        <span style="text-transform: uppercase; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; color: ${categoryColor};">${timelineCategory}</span>
        <span style="color: rgba(255, 255, 255, 0.6); font-size: 11px;">•</span>
        <span style="font-size: 11px; color: rgba(255, 255, 255, 0.9); font-weight: 400;">${this.formatTime(factCheck.timestamp)}</span>
    `;

    // Assemble tooltip
    tooltip.appendChild(effect);
    tooltip.appendChild(tint);
    tooltip.appendChild(shine);
    tooltip.appendChild(contentContainer);

    // Add to container
    progressContainer.appendChild(tooltip);

    // Store reference
    this.currentTooltip = tooltip;

    // Animate in
    requestAnimationFrame(() => {
        tooltip.style.opacity = '1';
        tooltip.style.transform = `${transform} scale(1)`;
    });
};

YouTubeFactChecker.prototype.hideTimelineTooltip = function() {
    if (this.currentTooltip && this.currentTooltip.parentNode) {
        // Animate out
        this.currentTooltip.style.opacity = '0';

        // Properly handle transform - add scale if it doesn't exist, or replace if it does
        const currentTransform = this.currentTooltip.style.transform;
        if (currentTransform.includes('scale(1)')) {
            this.currentTooltip.style.transform = currentTransform.replace('scale(1)', 'scale(0.9)');
        } else {
            this.currentTooltip.style.transform = currentTransform + ' scale(0.9)';
        }

        // Remove after animation
        const tooltipToRemove = this.currentTooltip;
        setTimeout(() => {
            if (tooltipToRemove && tooltipToRemove.parentNode) {
                tooltipToRemove.remove();
            }
        }, 200);

        this.currentTooltip = null;
    }

    // Backup cleanup for any orphaned tooltips (immediate removal for cleanup)
    const existingTooltips = document.querySelectorAll('.fact-check-timeline-tooltip');
    existingTooltips.forEach(tooltip => {
        if (tooltip !== this.currentTooltip) {
            tooltip.remove();
        }
    });
};

YouTubeFactChecker.prototype.jumpToTimestamp = function(timestamp) {
    const video = document.querySelector('video');
    if (video) {
        video.currentTime = timestamp;
        console.log(`Jumped to timestamp: ${this.formatTime(timestamp)}`);
    }
};

YouTubeFactChecker.prototype.addTooltipStyles = function() {
    // Check if styles already exist
    if (document.getElementById('timeline-tooltip-styles')) return;

    const style = document.createElement('style');
    style.id = 'timeline-tooltip-styles';
    style.textContent = `
        .fact-check-timeline-marker {
            transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
    `;
    document.head.appendChild(style);
};

console.log('✅ Content mock/analysis module loaded');