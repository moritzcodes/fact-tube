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



YouTubeFactChecker.prototype.createTimelineMarkers = function() {
    // Remove existing markers and tooltips completely
    const existingMarkers = document.querySelectorAll('.fact-check-timeline-marker');
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

    // Create markers for each claim
    this.mockFactChecks.forEach((factCheck, index) => {
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
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4), 0 4px 12px rgba(10, 132, 255, 0.25);
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

        // Add hover effects with immediate response
        marker.addEventListener('mouseenter', () => {
            console.log('Marker hover enter - showing tooltip');

            // Map status to simplified category for timeline colors
            const timelineCategory = this.mapStatusToTimelineCategory(factCheck.status);

            // Immediate visual feedback
            marker.style.opacity = '1';
            marker.style.width = '20px';
            marker.style.height = '20px';
            marker.style.top = '-24px';
            marker.style.transform = 'translateX(-50%) scale(1.15)';
            marker.style.boxShadow = `0 0 0 2px rgba(255, 255, 255, 0.6), 
                                     0 8px 24px rgba(10, 132, 255, 0.4),
                                     0 0 20px ${this.getCategoryColor(timelineCategory)}60`;
            marker.style.zIndex = '1001';

            // Show tooltip immediately
            this.showTimelineTooltip(marker, factCheck);
        });

        marker.addEventListener('mouseleave', () => {
            // Reset marker styles
            marker.style.opacity = '0.95';
            marker.style.width = '14px';
            marker.style.height = '14px';
            marker.style.top = '-16px';
            marker.style.transform = 'translateX(-50%) scale(1)';
            marker.style.boxShadow = `0 0 0 1px rgba(255, 255, 255, 0.4), 0 4px 12px rgba(10, 132, 255, 0.25)`;
            marker.style.zIndex = '1000';

            // Hide tooltip immediately
            this.hideTimelineTooltip();
        });

        // Add click handler to jump to timestamp
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            this.jumpToTimestamp(factCheck.timestamp);
        });

        progressContainer.appendChild(marker);
    });

    console.log(`Created ${this.mockFactChecks.length} timeline markers`);
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
        this.currentTooltip.style.transform = this.currentTooltip.style.transform.replace('scale(1)', 'scale(0.9)');

        // Remove after animation
        setTimeout(() => {
            if (this.currentTooltip && this.currentTooltip.parentNode) {
                this.currentTooltip.remove();
            }
            this.currentTooltip = null;
        }, 200);
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