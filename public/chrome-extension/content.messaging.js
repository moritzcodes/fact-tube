// Messaging and realtime update handlers

YouTubeFactChecker.prototype.handleMessage = function(message, sendResponse) {
    console.log('📨 handleMessage called with type:', message.type);

    switch (message.type) {
        case 'ACTIVATE_MOCK_MODE':
            console.log('🎭 Mock mode activated from popup');
            break;
        case 'MOCK_ANALYSIS_COMPLETE':
            console.log('🎭 Mock analysis complete from background');
            break;
        case 'PROCESSING_STARTED':
            console.log('⏳ Processing started message received');
            this.isAnalysisInProgress = true;
            this.updateButtonState();
            this.showProcessingIndicator();
            break;
        case 'DATA_LOADED':
            console.log('📊 DATA_LOADED message received:', message.data);
            this.loadData(message.data);
            break;
        case 'ANALYSIS_COMPLETE':
            console.log('✅ ANALYSIS_COMPLETE message received:', message.data);
            this.handleAnalysisComplete(message.data);
            break;
        case 'ANALYSIS_ERROR':
            console.error('❌ ANALYSIS_ERROR message received:', message.data);
            this.handleAnalysisError(new Error(message.data.error));
            break;
        case 'NEW_CLAIM':
            console.log('🆕 NEW_CLAIM received via SSE:', message.data);
            this.handleNewClaim(message.data);
            break;
        case 'CLAIM_UPDATE':
            console.log('🔄 CLAIM_UPDATE received via SSE:', message.data);
            this.handleClaimUpdate(message.data);
            break;
        case 'REALTIME_UPDATE':
            console.log('⚡ REALTIME_UPDATE received:', message.data);
            this.handleRealtimeUpdate(message.data);
            break;
        case 'PROCESSING_ERROR':
            console.error('❌ PROCESSING_ERROR received:', message.data);
            this.handleProcessingError(message.data);
            break;
        case 'EXTRACT_TRANSCRIPT':
            console.log('📝 EXTRACT_TRANSCRIPT message received:', message.data);
            this.handleExtractTranscript(message.data, sendResponse);
            break;
        default:
            console.warn('⚠️ Unknown message type:', message.type);
    }
};

YouTubeFactChecker.prototype.handleSessionData = function(session) {
    if (session.status === 'processing') {
        this.showProcessingIndicator();
    } else if (session.status === 'completed' && session.result) {
        // Session has completed data (likely from cache) - load it directly
        console.log('Loading session data directly (from cache):', session.result);
        this.loadData(session.result);
    } else if (session.status === 'completed') {
        // Data will be delivered via DATA_LOADED message separately
        console.log('Session completed, waiting for DATA_LOADED message');
    } else if (session.status === 'ready') {
        console.log('Session ready for manual analysis');
    }
};

YouTubeFactChecker.prototype.loadData = function(data) {
    console.log('📥 loadData called with data:', data);
    console.log('📊 Data structure:', {
        hasClaims: !!data.claims,
        hasFactChecks: !!data.factChecks,
        hasClaimResponses: !!data.claim_responses,
        claimResponsesLength: data.claim_responses ? data.claim_responses.length : 0
    });

    this.claims = data.claims || [];
    this.factChecks = data.factChecks || [];

    // Transform API data to match expected mockFactChecks format
    if (data.claim_responses && data.claim_responses.length > 0) {
        console.log('🔄 Transforming', data.claim_responses.length, 'claim responses...');
        // Transform API response format to match overlay format
        this.mockFactChecks = data.claim_responses.map(claimResponse => ({
            timestamp: claimResponse.claim.start,
            endTimestamp: claimResponse.claim.start + 10, // Default 10-second duration
            claim: claimResponse.claim.claim,
            categoryOfLikeness: this.mapApiStatusToCategory(claimResponse.status),
            sources: claimResponse.evidence ? claimResponse.evidence.map(ev => ev.source_url).filter(Boolean) : [],
            evidence: claimResponse.evidence || [], // Preserve full evidence data for clickable links
            judgement: {
                reasoning: claimResponse.written_summary || 'No detailed explanation provided',
                summary: claimResponse.written_summary ?
                    claimResponse.written_summary.split('.')[0] + '.' : `Status: ${claimResponse.status}`
            }
        }));

        console.log('Processed API fact-check data:', this.mockFactChecks.length, 'claims', data.fromCache ? '(from cache)' : '(fresh)');

        // Create timeline markers with transformed data
        this.createTimelineMarkers();

        // Create summary and show completion notification
        const summary = data.summary || this.createSummaryFromClaims();
        this.showCompletionNotification({
            total_claims: data.total_claims || this.mockFactChecks.length,
            summary: summary,
            fromCache: data.fromCache || false
        });
    } else if (data.claims && data.claims.length > 0) {
        // Fallback: if data comes in different format, use as-is
        this.mockFactChecks = data.claims;

        // Create timeline markers with real data
        this.createTimelineMarkers();

        // Show completion notification
        this.showCompletionNotification({
            total_claims: data.claims.length,
            summary: data.summary || this.createSummaryFromClaims()
        });
    }

    this.isAnalysisInProgress = false;
    this.updateButtonState();
    this.hideProcessingIndicator();
    this.updateVisibleClaims();
};

// Map API response status to existing category system
YouTubeFactChecker.prototype.mapApiStatusToCategory = function(status) {
    const statusMapping = {
        'verified': 'true',
        'true': 'true',
        'false': 'false',
        'disputed': 'false',
        'inconclusive': 'neutral',
        'neutral': 'neutral'
    };

    return statusMapping[status.toLowerCase()] || 'neutral';
};

// Create summary statistics from processed claims
YouTubeFactChecker.prototype.createSummaryFromClaims = function() {
    const summary = { verified: 0, false: 0, disputed: 0, inconclusive: 0 };

    this.mockFactChecks.forEach(claim => {
        const category = claim.categoryOfLikeness;
        if (category === 'true') summary.verified++;
        else if (category === 'false') summary.false++;
        else if (category === 'neutral') summary.inconclusive++;
        // Note: 'disputed' would map to 'false' category in our system
    });

    console.log('📊 Created summary from claims:', summary);
    return summary;
};

YouTubeFactChecker.prototype.handleRealtimeUpdate = function(data) {
    switch (data.type) {
        case 'claim_found':
            this.addClaim(data.data);
            break;
        case 'fact_check_complete':
            this.updateFactCheck(data.data);
            break;
        case 'processing_complete':
            this.hideProcessingIndicator();
            this.showCompletionNotification(data.data);
            break;
        case 'job_progress':
            this.updateProgress(data.data);
            break;
    }
};

YouTubeFactChecker.prototype.showProcessingIndicator = function(message = 'Analyzing video for claims...') {
    console.log('🔄 Showing processing indicator:', message);

    // Remove existing indicator if present
    const existing = document.getElementById('fact-checker-processing');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'fact-checker-processing';
    indicator.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.8); color: white; padding: 12px 16px; border-radius: 8px;
    font-family: Arial, sans-serif; font-size: 14px; z-index: 10000; display: flex; align-items: center; gap: 8px;
  `;
    indicator.innerHTML = `
    <div style="width:16px;height:16px;border:2px solid #fff;border-top:2px solid transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
    <span>${message}</span>
    <style>@keyframes spin {0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}</style>
  `;
    document.body.appendChild(indicator);
    console.log('✅ Processing indicator shown');
};

YouTubeFactChecker.prototype.hideProcessingIndicator = function() {
    console.log('🔽 Hiding processing indicator');
    const indicator = document.getElementById('fact-checker-processing');
    if (indicator) {
        indicator.remove();
        console.log('✅ Processing indicator removed');
    } else {
        console.log('ℹ️ No processing indicator to remove');
    }
};

YouTubeFactChecker.prototype.addClaim = function(claimData) {
    this.claims.push(claimData);
    this.updateVisibleClaims();
};

YouTubeFactChecker.prototype.updateFactCheck = function(factCheckData) {
    this.factChecks.push(factCheckData);
    this.updateVisibleClaims();
};

YouTubeFactChecker.prototype.updateProgress = function(progressData) {
    const indicator = document.getElementById('fact-checker-processing');
    if (indicator) {
        const text = indicator.querySelector('span');
        if (text) text.textContent = `${progressData.job_type}: ${progressData.progress}%`;
    }
};

YouTubeFactChecker.prototype.showCompletionNotification = function(data) {
    const notification = document.createElement('div');
    const bgColor = data.fromCache ? '#2196f3' : '#4caf50'; // Blue for cache, green for fresh
    const icon = data.fromCache ? '🗄️' : '✅';
    const title = data.fromCache ? 'Cached Analysis Loaded!' : 'Analysis Complete!';

    notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: ${bgColor}; color: white; padding: 16px; border-radius: 8px; font-family: Arial, sans-serif; font-size: 14px; z-index: 10000; max-width: 300px;
  `;
    notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">${icon} ${title}</div>
    <div>Found ${data.total_claims} claims</div>
    <div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">${data.summary.verified} verified, ${data.summary.disputed || 0} disputed, ${data.summary.false} false, ${data.summary.inconclusive} inconclusive</div>
    ${data.fromCache ? '<div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">Loaded from cache</div>' : ''}
  `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
};

// Handle new claim from SSE stream
YouTubeFactChecker.prototype.handleNewClaim = function(claimData) {
    console.log('Adding new claim to timeline:', claimData);

    // Transform SSE claim format to overlay format
    const transformedClaim = {
        timestamp: claimData.claim.start,
        endTimestamp: claimData.claim.start + 10,
        claim: claimData.claim.claim,
        categoryOfLikeness: this.mapApiStatusToCategory(claimData.status),
        sources: claimData.evidence ? claimData.evidence.map(ev => ev.source_url).filter(Boolean) : [],
        evidence: claimData.evidence || [],
        judgement: {
            reasoning: claimData.written_summary || 'Fact-checking in progress...',
            summary: claimData.written_summary || 'Status: Pending'
        },
        id: claimData.id // Store claim ID for updates
    };

    // Add to mockFactChecks array
    this.mockFactChecks.push(transformedClaim);

    // Sort by timestamp
    this.mockFactChecks.sort((a, b) => a.timestamp - b.timestamp);

    // Update timeline markers
    this.createTimelineMarkers();

    // Update visible claims if this timestamp is in view
    this.updateVisibleClaims();
};

// Handle claim update from SSE stream (e.g., fact-check completed)
YouTubeFactChecker.prototype.handleClaimUpdate = function(updateData) {
    console.log('Updating claim:', updateData);

    // Find the claim by ID
    const claimIndex = this.mockFactChecks.findIndex(c => c.id === updateData.id);
    if (claimIndex !== -1) {
        // Update the claim
        this.mockFactChecks[claimIndex].categoryOfLikeness = this.mapApiStatusToCategory(updateData.status);
        this.mockFactChecks[claimIndex].judgement = {
            reasoning: updateData.written_summary || 'Fact-check completed',
            summary: updateData.written_summary || `Status: ${updateData.status}`
        };
        if (updateData.evidence) {
            this.mockFactChecks[claimIndex].evidence = updateData.evidence;
            this.mockFactChecks[claimIndex].sources = updateData.evidence.map(ev => ev.source_url).filter(Boolean);
        }

        // Update timeline markers
        this.createTimelineMarkers();

        // Update visible claims
        this.updateVisibleClaims();

        console.log('✅ Claim updated successfully');
    }
};

YouTubeFactChecker.prototype.handleProcessingError = function(data) {
    this.isAnalysisInProgress = false;
    this.updateButtonState();
    this.hideProcessingIndicator();

    const notification = document.createElement('div');
    notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: #f44336; color: white; padding: 16px; border-radius: 8px; font-family: Arial, sans-serif; font-size: 14px; z-index: 10000; max-width: 300px;
  `;
    notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">❌ Processing Failed</div>
    <div style="font-size: 12px;">${data.error}</div>
    <div style="font-size: 11px; margin-top: 8px; opacity: 0.8;">Check if the backend server is running</div>
  `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 8000);
};

// Handle transcript extraction request from background script
YouTubeFactChecker.prototype.handleExtractTranscript = async function(data, sendResponse) {
    console.log('📝 Starting video analysis for:', data.videoId);
    this.showProcessingIndicator('Analyzing video...');
    const API_BASE_URL = 'http://localhost:3000';
    try {
        // Send video ID to backend - it handles everything server-side
        console.log('📤 Sending video ID to backend for analysis...');

        const response = await fetch(`${API_BASE_URL}/api/extension/analyze-video`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videoId: data.videoId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || `Failed to analyze video: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Video analysis complete:', result);

        if (result.cached) {
            this.showProcessingIndicator(`Found ${result.totalClaims} cached claims. Checking for updates...`);
        } else {
            this.showProcessingIndicator(`Extracted ${result.totalClaims} claims. Fact-checking in progress...`);
        }

        // Send success response back to background script
        if (sendResponse) {
            sendResponse({
                success: true,
                videoId: data.videoId,
                totalClaims: result.totalClaims,
                cached: result.cached,
            });
        }

    } catch (error) {
        console.error('❌ Error analyzing video:', error);
        this.hideProcessingIndicator();
        this.isAnalysisInProgress = false;
        this.updateButtonState();

        // Show error notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #f44336; color: white; padding: 16px; border-radius: 8px;
            font-family: Arial, sans-serif; font-size: 14px; z-index: 10000; max-width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">❌ Analysis Error</div>
            <div style="font-size: 12px;">${error.message}</div>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 8000);

        // Send error response back to background script
        if (sendResponse) {
            sendResponse({ success: false, error: error.message, videoId: data.videoId });
        }
    }
};

// OLD: submitTranscriptToBackend - NO LONGER NEEDED
// Backend now handles transcript extraction server-side