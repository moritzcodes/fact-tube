// Messaging and realtime update handlers

YouTubeFactChecker.prototype.handleMessage = function(message) {
    switch (message.type) {
        case 'ACTIVATE_MOCK_MODE':
            console.log('Mock mode activated from popup');
            break;
        case 'MOCK_ANALYSIS_COMPLETE':
            console.log('Mock analysis complete from background');
            break;
        case 'PROCESSING_STARTED':
            this.isAnalysisInProgress = true;
            this.updateButtonState();
            this.showProcessingIndicator();
            break;
        case 'DATA_LOADED':
            this.loadData(message.data);
            break;
        case 'ANALYSIS_COMPLETE':
            console.log('Analysis complete from background:', message.data);
            this.handleAnalysisComplete(message.data);
            break;
        case 'ANALYSIS_ERROR':
            console.error('Analysis error from background:', message.data);
            this.handleAnalysisError(new Error(message.data.error));
            break;
        case 'REALTIME_UPDATE':
            this.handleRealtimeUpdate(message.data);
            break;
        case 'PROCESSING_ERROR':
            this.handleProcessingError(message.data);
            break;
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
    this.claims = data.claims || [];
    this.factChecks = data.factChecks || [];

    // Transform API data to match expected mockFactChecks format
    if (data.claim_responses && data.claim_responses.length > 0) {
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

YouTubeFactChecker.prototype.showProcessingIndicator = function() {
    const indicator = document.createElement('div');
    indicator.id = 'fact-checker-processing';
    indicator.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.8); color: white; padding: 12px 16px; border-radius: 8px;
    font-family: Arial, sans-serif; font-size: 14px; z-index: 10000; display: flex; align-items: center; gap: 8px;
  `;
    indicator.innerHTML = `
    <div style="width:16px;height:16px;border:2px solid #fff;border-top:2px solid transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
    <span>Analyzing video for claims...</span>
    <style>@keyframes spin {0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}</style>
  `;
    document.body.appendChild(indicator);
};

YouTubeFactChecker.prototype.hideProcessingIndicator = function() {
    const indicator = document.getElementById('fact-checker-processing');
    if (indicator) indicator.remove();
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