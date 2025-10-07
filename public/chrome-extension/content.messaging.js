// Messaging and realtime update handlers

YouTubeFactChecker.prototype.handleMessage = function(message, sendResponse) {
    console.log('📨 handleMessage called with type:', message.type);

    switch (message.type) {
        case 'PROCESSING_STARTED':
            console.log('⏳ Processing started message received');
            this.isAnalysisInProgress = true;
            this.updateButtonState();
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
        // Processing indicator removed
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
        claimResponsesLength: data.claim_responses ? data.claim_responses.length : 0,
        totalClaims: data.totalClaims
    });

    this.claims = data.claims || [];
    this.factChecks = data.factChecks || [];

    // Handle case where no claims were found
    if (data.totalClaims === 0 || ((!data.claim_responses || data.claim_responses.length === 0) && (!data.claims || data.claims.length === 0))) {
        console.log('ℹ️ No claims found in this video');
        this.mockFactChecks = [];
        this.isAnalysisInProgress = false;
        this.updateButtonState();
        this.updateVisibleClaims();
        return;
    }

    // Transform API data to match expected mockFactChecks format
    if (data.claim_responses && data.claim_responses.length > 0) {
        console.log('🔄 Transforming', data.claim_responses.length, 'claim responses...');

        // Debug: Check if any responses have sourceBias data
        const responsesWithBias = data.claim_responses.filter(cr => cr.sourceBias && cr.sourceBias.length > 0);
        console.log('📊 Claims with bias data:', responsesWithBias.length, '/', data.claim_responses.length);

        // Debug: Check speaker data
        data.claim_responses.forEach((cr, idx) => {
            console.log(`📢 Claim ${idx} speaker data:`, {
                speaker: cr.claim ? speaker || cr.speaker : null,
                claimSpeaker: cr.speaker,
                hasClaimObject: !!cr.claim,
                claimKeys: cr.claim ? Object.keys(cr.claim) : []
            });
        });

        // Transform API response format to match overlay format
        let transformedClaims = data.claim_responses.map(claimResponse => {
            // Extract speaker - try multiple possible locations
            const speaker = claimResponse.claim ? speaker :
                claimResponse.speaker ||
                (typeof claimResponse.claim ? speaker === 'string' ? claimResponse.claim.speaker : null : null)

            // Only default to 'Unknown' if speaker is truly null/undefined (not empty string)
            const finalSpeaker = speaker !== null && speaker !== undefined ? speaker : 'Unknown';

            console.log('📢 Processing speaker:', {
                raw: claimResponse.claim ? speaker : claimResponse.speaker,
                extracted: speaker,
                final: finalSpeaker
            });

            return {
                timestamp: claimResponse.claim.start,
                endTimestamp: claimResponse.claim.start + 10, // Default 10-second duration
                claim: claimResponse.claim.claim,
                speaker: finalSpeaker,
                status: claimResponse.status, // Use actual API status instead of mapping
                sources: claimResponse.evidence ? claimResponse.evidence.map(ev => ev.source_url).filter(Boolean) : [],
                evidence: claimResponse.evidence || [], // Preserve full evidence data for clickable links
                sourceBias: claimResponse.sourceBias || null, // Include source bias information
                judgement: {
                    reasoning: claimResponse.written_summary || 'No detailed explanation provided',
                    summary: claimResponse.written_summary ?
                        claimResponse.written_summary.split('.')[0] + '.' : `Status: ${claimResponse.status}`
                }
            };
        });

        // Filter claims that are too close together (within 30 seconds) for better UX
        transformedClaims = this.filterClaimsByProximity(transformedClaims, 30);
        console.log('🔍 Filtered claims by proximity: kept', transformedClaims.length, 'out of', data.claim_responses.length);

        this.mockFactChecks = transformedClaims;

        console.log('Processed API fact-check data:', this.mockFactChecks.length, 'claims', data.fromCache ? '(from cache)' : '(fresh)');

        // Create timeline markers with transformed data
        this.createTimelineMarkers();

        // Create summary for logging
        const summary = data.summary || this.createSummaryFromClaims();
        console.log('✅ Data loaded. Found', this.mockFactChecks.length, 'claims');
        console.log('📊 Summary:', summary);
    } else if (data.claims && data.claims.length > 0) {
        // Handle flat claims array from analyze-video endpoint
        console.log('📦 Processing claims from API...', data.claims);

        // Transform flat claims array
        let allClaims = data.claims.map(claim => {
            const speaker = claim.speaker !== null && claim.speaker !== undefined ? claim.speaker : 'Unknown';
            console.log('📢 Claim speaker:', { raw: claim.speaker, final: speaker, timestamp: claim.timestamp });

            return {
                id: claim.id,
                timestamp: claim.timestamp,
                claim: claim.claim,
                speaker: speaker,
                status: claim.status || 'pending',
                sources: claim.sources || [],
                evidence: claim.evidence || [],
                sourceBias: claim.sourceBias || null,
                verdict: claim.verdict || '',
                judgement: {
                    reasoning: claim.verdict || 'Analysis in progress...',
                    summary: claim.verdict ? claim.verdict.split('.')[0] + '.' : 'Pending analysis'
                }
            };
        });

        this.mockFactChecks = allClaims;
        console.log('✅ Processed', data.claims.length, 'claims from API');

        // Create timeline markers with real data (extension will handle its own grouping for display)
        this.createTimelineMarkers();

        console.log('✅ Data loaded. Found', allClaims.length, 'claims');
    }

    this.isAnalysisInProgress = false;
    this.updateButtonState();
    this.updateVisibleClaims();
};

// Get color scheme for status pill
YouTubeFactChecker.prototype.getStatusColor = function(status) {
    const statusLower = (status || '').toLowerCase();
    const colorMap = {
        'verified': { bg: 'rgba(52, 211, 153, 0.2)', border: 'rgba(52, 211, 153, 0.5)', text: '#34D399', icon: '✓' },
        'true': { bg: 'rgba(52, 211, 153, 0.2)', border: 'rgba(52, 211, 153, 0.5)', text: '#34D399', icon: '✓' },
        'false': { bg: 'rgba(248, 113, 113, 0.2)', border: 'rgba(248, 113, 113, 0.5)', text: '#F87171', icon: '✕' },
        'disputed': { bg: 'rgba(251, 191, 36, 0.2)', border: 'rgba(251, 191, 36, 0.5)', text: '#FBBF24', icon: '⚠' },
        'inconclusive': { bg: 'rgba(156, 163, 175, 0.2)', border: 'rgba(156, 163, 175, 0.5)', text: '#9CA3AF', icon: '?' },
        'neutral': { bg: 'rgba(156, 163, 175, 0.2)', border: 'rgba(156, 163, 175, 0.5)', text: '#9CA3AF', icon: '−' },
        'pending': { bg: 'rgba(96, 165, 250, 0.2)', border: 'rgba(96, 165, 250, 0.5)', text: '#60A5FA', icon: '⋯' }
    };
    return colorMap[statusLower] || colorMap['neutral'];
};

// Map status to simplified timeline category (true/false/neutral) for timeline markers
YouTubeFactChecker.prototype.mapStatusToTimelineCategory = function(status) {
    const statusLower = (status || '').toLowerCase();
    const categoryMap = {
        'verified': 'true',
        'true': 'true',
        'false': 'false',
        'disputed': 'neutral',
        'inconclusive': 'neutral',
        'neutral': 'neutral',
        'pending': 'neutral'
    };
    return categoryMap[statusLower] || 'neutral';
};

// Create summary statistics from processed claims
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
    return summary;
};


YouTubeFactChecker.prototype.addClaim = function(claimData) {
    this.claims.push(claimData);
    this.updateVisibleClaims();
};

YouTubeFactChecker.prototype.updateFactCheck = function(factCheckData) {
    this.factChecks.push(factCheckData);
    this.updateVisibleClaims();
};



// Handle new claim from SSE stream
YouTubeFactChecker.prototype.handleNewClaim = function(claimData) {
    console.log('Adding new claim to timeline:', claimData);

    // Extract speaker - try multiple possible locations
    const speaker = claimData.claim ? speaker :
        claimData.speaker ||
        (typeof claimData.claim ? speaker === 'string' ? claimData.claim.speaker : null : null)
    const finalSpeaker = speaker !== null && speaker !== undefined ? speaker : 'Unknown';

    console.log('📢 SSE new claim speaker:', {
        raw: claimData.claim ? speaker : claimData.speaker,
        extracted: speaker,
        final: finalSpeaker
    });

    // Transform SSE claim format to overlay format
    const transformedClaim = {
        timestamp: claimData.claim.start,
        endTimestamp: claimData.claim.start + 10,
        claim: claimData.claim.claim,
        speaker: finalSpeaker,
        status: claimData.status, // Use actual API status
        sources: claimData.evidence ? claimData.evidence.map(ev => ev.source_url).filter(Boolean) : [],
        evidence: claimData.evidence || [],
        sourceBias: claimData.sourceBias || null, // Include source bias information
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

    // IMPORTANT: Regenerate grouping data to include the new claim
    this.loadOrCreateGrouping();

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
        this.mockFactChecks[claimIndex].status = updateData.status; // Use actual API status
        this.mockFactChecks[claimIndex].judgement = {
            reasoning: updateData.written_summary || 'Fact-check completed',
            summary: updateData.written_summary || `Status: ${updateData.status}`
        };
        if (updateData.evidence) {
            this.mockFactChecks[claimIndex].evidence = updateData.evidence;
            this.mockFactChecks[claimIndex].sources = updateData.evidence.map(ev => ev.source_url).filter(Boolean);
        }
        // Update source bias information if available
        if (updateData.sourceBias) {
            this.mockFactChecks[claimIndex].sourceBias = updateData.sourceBias;
        }

        // IMPORTANT: Regenerate grouping data to reflect updated status colors
        this.loadOrCreateGrouping();

        // Update timeline markers
        this.createTimelineMarkers();

        // Update visible claims
        this.updateVisibleClaims();

        console.log('✅ Claim updated successfully');
    }
};

// Handle transcript extraction request from background script
YouTubeFactChecker.prototype.handleExtractTranscript = async function(data, sendResponse) {
    console.log('📝 Starting video analysis for:', data.videoId);

    try {
        // Get settings from Chrome storage
        const settings = await new Promise((resolve) => {
            chrome.storage.local.get(['openrouterApiKey', 'apiBaseUrl'], (result) => {
                resolve({
                    apiKey: result.openrouterApiKey || '',
                    apiBaseUrl: result.apiBaseUrl || 'http://localhost:3000'
                });
            });
        });

        // Send video ID to backend - it handles everything server-side
        console.log('📤 Sending video ID to backend for analysis...');

        const headers = {
            'Content-Type': 'application/json',
        };

        // Add API key if available
        if (settings.apiKey) {
            headers['X-OpenRouter-API-Key'] = settings.apiKey;
        }

        const response = await fetch(`${settings.apiBaseUrl.replace(/\/$/, '')}/api/extension/analyze-video`, {
            method: 'POST',
            headers: headers,
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
            console.log(`Found ${result.totalClaims} cached claims. Checking for updates...`);
        } else {
            console.log(`Extracted ${result.totalClaims} claims. Fact-checking in progress...`);
        }

        // Process and display the data (this stops the spinner and shows claims)
        console.log('📊 Processing data and stopping spinner...');
        this.loadData(result);

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
        this.isAnalysisInProgress = false;
        this.updateButtonState();

        // Log error for debugging
        console.error('❌ Analysis error:', error.message);

        // Send error response back to background script
        if (sendResponse) {
            sendResponse({ success: false, error: error.message, videoId: data.videoId });
        }
    }
};

/**
 * Filter claims to ensure minimum time spacing between them
 * This prevents timeline markers from being too crowded
 */
YouTubeFactChecker.prototype.filterClaimsByProximity = function(claims, minSpacing = 30) {
    if (claims.length <= 1) return claims;

    // Sort by timestamp
    const sorted = [...claims].sort((a, b) => a.timestamp - b.timestamp);
    const filtered = [sorted[0]]; // Always keep first claim

    for (let i = 1; i < sorted.length; i++) {
        const currentClaim = sorted[i];
        const lastKeptClaim = filtered[filtered.length - 1];

        // Keep claim if it's at least minSpacing seconds after the last kept claim
        if (currentClaim.timestamp - lastKeptClaim.timestamp >= minSpacing) {
            filtered.push(currentClaim);
        } else {
            console.log(`⏭️  Skipping claim at ${currentClaim.timestamp}s (too close to claim at ${lastKeptClaim.timestamp}s)`);
        }
    }

    return filtered;
};

// OLD: submitTranscriptToBackend - NO LONGER NEEDED
// Backend now handles transcript extraction server-side