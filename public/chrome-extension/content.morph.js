YouTubeFactChecker.prototype.createActiveIndicator = function() {
    console.log('🎨 createActiveIndicator called');

    // Remove ALL existing indicators from DOM (from any previous instances)
    const existingIndicators = document.querySelectorAll('#fact-checker-indicator, .fact-checker-fab');
    console.log('🧹 Found', existingIndicators.length, 'existing indicators to remove');
    existingIndicators.forEach(indicator => indicator.remove());

    // Remove existing indicator from this instance
    if (this.activeIndicator) {
        console.log('🧹 Removing existing indicator from instance');
        this.activeIndicator.remove();
        this.activeIndicator = null;
    }

    // Ensure global glass filter exists
    console.log('🎨 Creating glass filter...');
    this.createGlassFilter();

    // Create active state indicator with liquid glass wrapper
    this.activeIndicator = document.createElement('div');
    this.activeIndicator.id = 'fact-checker-indicator';
    this.activeIndicator.className = 'fact-checker-fab liquidGlass-wrapper button';

    // Motion tokens and variables
    this.motionTokens = {
        duration: 280, // ms - faster, more responsive
        springStiffness: 420,
        springDamping: 38,
        dampingRatio: 0.86,
        fab: { width: 56, height: 56, borderRadius: 28, shadow: '0 4px 12px rgba(10, 132, 255, 0.25)', iconScale: 1, iconOpacity: 1 },
        card: { width: 380, height: 300, borderRadius: 16, shadow: '0 12px 40px rgba(10, 132, 255, 0.15)', iconScale: 0.8, iconOpacity: 0.9 },
        morphStart: 0,
        backgroundBlurStart: 50,
        contentFadeStart: 120,
    };

    // Edge detection for FAB positioning
    const playerElement = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    const containerRect = playerElement ? playerElement.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };

    // Calculate position with edge detection
    const fabSize = this.motionTokens.fab.width;
    const cardWidth = this.motionTokens.card.width;
    const margin = 20;

    // Check if card would be cut off on the right when morphed
    const wouldBeCutOffRight = (containerRect.width - margin) < cardWidth;
    const horizontalPosition = wouldBeCutOffRight ? `left: ${margin}px` : `right: ${margin}px`;

    // Check if would be cut off at the top (for smaller screens)
    const topPosition = Math.max(margin, Math.min(margin, containerRect.height - this.motionTokens.card.height - margin));

    this.activeIndicator.style.cssText = `
    position: absolute; top: ${topPosition}px; ${horizontalPosition}; z-index: 1001; display: flex;
    width: ${this.motionTokens.fab.width}px; height: ${this.motionTokens.fab.height}px; border-radius: ${this.motionTokens.fab.borderRadius}px;
    transition: all ${this.motionTokens.duration}ms cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: width, height, border-radius, box-shadow;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.4), 0 8px 24px rgba(10,132,255,0.3);
    align-items: center; justify-content: center;
    opacity: 0; transform: scale(0.8);
    backdrop-filter: blur(8px) saturate(1.2);
  `;

    // Liquid glass structure
    const effect = document.createElement('div');
    effect.className = 'liquidGlass-effect';
    const tint = document.createElement('div');
    tint.className = 'liquidGlass-tint';
    const shine = document.createElement('div');
    shine.className = 'liquidGlass-shine';


    this.activeIndicator.appendChild(effect);
    this.activeIndicator.appendChild(tint);
    this.activeIndicator.appendChild(shine);

    // Add analyze button icon and text
    this.createAnalyzeButton();

    // Styles and interactions
    this.addMorphStyles();
    this.setupMorphInteractions();

    // Find YouTube player container and add indicator
    const playerContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    console.log('🔍 Player container found:', !!playerContainer);

    if (playerContainer) {
        playerContainer.style.position = 'relative';
        playerContainer.appendChild(this.activeIndicator);
        console.log('✅ Active indicator added to player container');

        // Entry delay animation for FAB
        setTimeout(() => {
            requestAnimationFrame(() => {
                this.activeIndicator.style.opacity = '1';
                this.activeIndicator.style.transform = 'scale(1)';
                console.log('✨ FAB animation complete - button visible!');
            });
        }, 200); // 200ms delay for FAB entrance
    } else {
        console.error('❌ Could not find player container to attach indicator!');
    }

    this.indicatorIcon = null;
    this.isMorphed = false;
    this.isMorphing = false;
    console.log('✅ createActiveIndicator complete');
};

YouTubeFactChecker.prototype.addMorphStyles = function() {
    // Remove existing morph styles
    const existingStyle = document.getElementById('fact-checker-morph-styles');
    if (existingStyle) existingStyle.remove();

    const style = document.createElement('style');
    style.id = 'fact-checker-morph-styles';
    style.textContent = `
    .fact-checker-fab { 
      --spring-easing: cubic-bezier(0.34, 1.56, 0.64, 1); 
      --reduced-motion-easing: cubic-bezier(0.25, 0.46, 0.45, 0.94); 
      width: 56px; height: 56px; border-radius: 28px; 
      align-items: center; justify-content: center; padding: 0; overflow: hidden; 
      transition: all 280ms var(--spring-easing);
    }
    .fact-checker-fab.morphed { 
      width: 380px !important; height: auto !important; max-height: 300px !important; overflow-y: auto; border-radius: 16px !important; 
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5), 0 12px 40px rgba(10, 132, 255, 0.15) !important; 
      align-items: flex-start !important; justify-content: flex-start !important; padding: 16px !important; 
    }
    /* Liquid glass layers per provided spec */
    .liquidGlass-wrapper { position: relative; border-radius: inherit; }
    .liquidGlass-effect { position: absolute; z-index: 0; inset: 0; border-radius: inherit; backdrop-filter: blur(2px) saturate(1.1); filter: url(#glass-distortion); overflow: hidden; isolation: isolate; }
    .liquidGlass-tint { z-index: 1; position: absolute; inset: 0; border-radius: inherit; background: rgba(255, 255, 255, 0.15); }
    .liquidGlass-shine { position: absolute; inset: 0; z-index: 2; border-radius: inherit; overflow: hidden; box-shadow: inset 2px 2px 1px 0 rgba(255, 255, 255, 0.1), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.1); }
    .liquidGlass-text { z-index: 3; position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 2rem; color: black; }
    .fact-checker-content { 
      opacity: 0; transform: translateY(8px); 
      transition: opacity 160ms cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 160ms cubic-bezier(0.25, 0.46, 0.45, 0.94); 
      color: white; width: 100%; will-change: opacity, transform; position: relative; z-index: 2; 
      pointer-events: auto; box-sizing: border-box; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; 
    }
    .fact-checker-fab.morphed .fact-checker-content { opacity: 1; transform: translateY(0); }
    .video-background-blur { transition: all 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94); transition-delay: 50ms; }
    .video-background-blur.blurred { filter: blur(6px) brightness(0.98); }
    
    /* Enhanced entry animations for overlays */
    .fact-check-claim {
      transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      will-change: transform, opacity;
    }
    .fact-check-claim.entering {
      animation: slideInWithBounce 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }
    
    @keyframes slideInWithBounce {
      0% { transform: translateX(120%) scale(0.9); opacity: 0; }
      60% { transform: translateX(-10%) scale(1.02); opacity: 0.9; }
      100% { transform: translateX(0) scale(1); opacity: 1; }
    }
    
    @keyframes slideInWithBounceLeft {
      0% { transform: translateX(-120%) scale(0.9); opacity: 0; }
      60% { transform: translateX(10%) scale(1.02); opacity: 0.9; }
      100% { transform: translateX(0) scale(1); opacity: 1; }
    }
    
    @keyframes fadeInScale {
      0% { opacity: 0; transform: scale(0.8) translateY(10px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    
    .fact-checker-fab {
      animation: fadeInScale 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }
    
    /* Auto-opened animation with subtle pulse */
    .fact-checker-fab.auto-opened {
      animation: autoOpenPulse 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }
    
    @keyframes autoOpenPulse {
      0% { transform: scale(1); box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5), 0 12px 40px rgba(10, 132, 255, 0.15); }
      30% { transform: scale(1.02); box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.7), 0 12px 40px rgba(10, 132, 255, 0.25); }
      60% { transform: scale(1.01); box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6), 0 12px 40px rgba(10, 132, 255, 0.2); }
      100% { transform: scale(1); box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5), 0 12px 40px rgba(10, 132, 255, 0.15); }
    }
    
    @media (prefers-reduced-motion: reduce) { 
      .fact-checker-fab, .fact-checker-icon, .fact-checker-content, .video-background-blur, .fact-check-claim { 
        transition-duration: 120ms !important; 
        transition-timing-function: var(--reduced-motion-easing) !important; 
        animation: none !important;
      } 
    }
    /* Keep pointer-events off for layers */
    .liquidGlass-effect, .liquidGlass-tint, .liquidGlass-shine { pointer-events: none; }
    
    /* Button hover effects */
    .fact-checker-content button:hover {
      background: rgba(255,255,255,0.2) !important;
      border-color: rgba(255,255,255,0.3) !important;
      transform: translateY(-1px);
    }
  `;
    document.head.appendChild(style);
};
YouTubeFactChecker.prototype.createAnalyzeButton = function() {
    console.log('🎨 createAnalyzeButton called');
    if (!this.activeIndicator) {
        console.error('❌ No active indicator found, cannot create button');
        return;
    }

    const buttonContent = document.createElement('div');
    buttonContent.className = 'analyze-button-content';
    buttonContent.style.cssText = `
        position: relative; z-index: 4; display: flex; align-items: center; justify-content: center;
         height: 100%; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 24px; font-weight: 600; transition: all 0.2s ease;
    `;

    console.log('🔄 Updating button state...');
    this.updateButtonState();
    this.activeIndicator.appendChild(buttonContent);
    console.log('✅ Button content added to indicator');
};

YouTubeFactChecker.prototype.updateButtonState = function() {
    const buttonContent = this.activeIndicator ? this.activeIndicator.querySelector('.analyze-button-content') : null;
    if (!buttonContent) {
        console.warn('⚠️ No button content found in updateButtonState');
        return;
    }

    // Hide button content when morphed/expanded
    if (this.isMorphed) {
        buttonContent.style.display = 'none';
        console.log('🔽 Button hidden (morphed state)');
        return;
    }

    buttonContent.style.display = 'flex';

    if (this.isAnalysisInProgress) {
        console.log('⏳ Button state: Analysis in progress');
        buttonContent.innerHTML = `
            <div style="width:20px;height:20px;border:2px solid #fff;border-top:2px solid transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        buttonContent.style.cursor = 'not-allowed';
    } else if (this.mockFactChecks && this.mockFactChecks.length > 0) {
        console.log('📊 Button state: Data loaded, showing checkmark');
        buttonContent.style.cursor = 'pointer';
    } else {
        console.log('🎯 Button state: Ready for analysis');
        buttonContent.innerHTML = '▶';
        buttonContent.style.cursor = 'pointer';
    }
};

YouTubeFactChecker.prototype.setupMorphInteractions = function() {
    if (!this.activeIndicator) return;

    // Click handler - starts analysis or allows content interaction
    this.activeIndicator.addEventListener('click', (event) => {
        console.log('🖱️ FAB/Button clicked');

        // If already morphed (expanded), only allow content interaction, don't close
        if (this.isMorphed) {
            console.log('📋 Expanded card clicked - allowing content interaction');
            // Don't close the card, let users interact with content (buttons, links, etc.)
            return;
        }

        // If analysis already in progress, do nothing
        if (this.isAnalysisInProgress) {
            console.log('⚠️ Analysis already in progress, ignoring click');
            return;
        }

        // If we already have data, clicking the circle does nothing (auto-open handles showing claims)
        if (this.mockFactChecks && this.mockFactChecks.length > 0) {
            console.log('📊 Data already loaded - circle click disabled to prevent showing claims');
            return;
        }

        // Otherwise, start analysis
        console.log('🚀 Starting analysis from button click...');
        this.startAnalysis();
    });
};

YouTubeFactChecker.prototype.morphToCard = function(factCheckData = null, isAutoOpen = false) {
    if (!this.activeIndicator || this.isMorphed || this.isMorphing) return;

    // Prevent multiple morphs in rapid succession
    this.isMorphing = true;
    this.isMorphed = true;

    // Use real API data or find current claim based on video timestamp
    let contentData = factCheckData;

    if (!contentData && this.mockFactChecks && this.mockFactChecks.length > 0) {
        // Get current video time to find relevant claim
        const video = document.querySelector('video');
        const currentTime = video ? video.currentTime : 0;

        // Find the most recent claim before or at current time
        const relevantClaim = this.mockFactChecks
            .filter(claim => claim.timestamp <= currentTime + 10) // Allow 10s buffer
            .sort((a, b) => Math.abs((currentTime) - a.timestamp) - Math.abs((currentTime) - b.timestamp))[0];

        // Use the found claim or default to the first one
        contentData = relevantClaim || this.mockFactChecks[0];

        console.log('Using fact-check data for morph card:', {
            currentTime,
            selectedClaim: contentData,
            availableClaims: this.mockFactChecks.length
        });
    }

    // Fallback to sample data only if no real data is available
    if (!contentData) {
        console.warn('No fact-check data available, using fallback');
        contentData = {
            claim: 'No claims found in this video',
            categoryOfLikeness: 'neutral',
            judgement: { summary: 'This video has been analyzed but no fact-checkable claims were detected.' },
            timestamp: 0,
            sources: []
        };
    }

    // Inject content immediately with proper initial state
    this.injectCardContent(contentData, true);

    requestAnimationFrame(() => {
        this.activeIndicator.classList.add('morphed');

        if (isAutoOpen) {
            console.log('Auto-opening fact-check overlay for claim at', contentData.timestamp + 's');
        }

        setTimeout(() => {
            if (this.isMorphed) {
                this.showCardContent();
            }

            // Reset morphing flag after animation completes
            setTimeout(() => {
                this.isMorphing = false;
            }, this.motionTokens.duration);
        }, 120);
        // No background blur; keep only liquid glass effect
    });

    console.log('Morphed to card state');
};

YouTubeFactChecker.prototype.morphToFab = function() {
    if (!this.activeIndicator || !this.isMorphed || this.isMorphing) return;

    // Prevent multiple morphs in rapid succession
    this.isMorphing = true;
    this.isMorphed = false;

    // Clear auto-close timer when manually closing
    this.clearAutoCloseTimer();

    requestAnimationFrame(() => {
        this.hideCardContent();
        setTimeout(() => { this.activeIndicator.classList.remove('morphed'); }, 50);
        setTimeout(() => {
            this.clearCardContent();
            // Reset user interaction flag after a delay to allow future auto-opens
            setTimeout(() => {
                this.userInteracted = false;
            }, 1000); // Reset after 1 second

            // Reset morphing flag after animation completes
            this.isMorphing = false;
        }, this.motionTokens.duration + 50);
    });

    console.log('Morphed to FAB state');
};

YouTubeFactChecker.prototype.applyBackgroundBlur = function() {
    // Intentionally no-op: we only want the liquid glass effect, not full-background blur
};

YouTubeFactChecker.prototype.createGlassFilter = function() {
    if (document.getElementById('glass-distortion')) return;
    const svg = document.createElement('svg');
    svg.style.cssText = 'display: none; position: absolute; width: 0; height: 0;';
    svg.innerHTML = `
    <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
      <feTurbulence type="fractalNoise" baseFrequency="0.03 0.03" numOctaves="2" seed="7" result="noise"/>
      <feGaussianBlur in="noise" stdDeviation="1.5" result="smoothNoise"/>
      <feColorMatrix in="smoothNoise" type="matrix" 
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 1 0" result="colorNoise"/>
      <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="8" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
      <feGaussianBlur in="displaced" stdDeviation="0.5" result="finalBlur"/>
    </filter>
  `;
    document.body.appendChild(svg);
};

YouTubeFactChecker.prototype.injectCardContent = function(factCheckData, keepHidden = false) {
    this.clearCardContent();
    this.ensureCardGlassLayers();

    // Store current claim data for reference
    this.currentCardClaim = factCheckData;

    const content = document.createElement('div');
    content.className = 'fact-checker-content';
    content.style.cssText = `
        opacity: ${keepHidden ? '0' : '1'};
        transform: translateY(${keepHidden ? '8px' : '0'});
        transition: opacity 160ms cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 160ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
        color: white; width: 100%; position: relative; z-index: 4; pointer-events: auto; box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    `;

    // Debug logging
    console.log('Creating morph card for fact check:', factCheckData);
    console.log('Sources data in morph:', factCheckData.sources);


    // Create sources preview with clickable links
    const sourcesPreview = this._createSourcesSection(factCheckData);

    content.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9; white-space: nowrap; overflow: hidden;">
            <span style="font-size: 14px; flex-shrink: 0;">${this.getCategoryIcon(factCheckData.categoryOfLikeness)}</span>
            <span style="flex-shrink: 0; color: ${this.getCategoryColor(factCheckData.categoryOfLikeness)};">${factCheckData.categoryOfLikeness}</span>
        </div>
        <div style="font-size: 14px; line-height: 1.4; font-weight: 500; margin-bottom: 8px; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto;">"${factCheckData.claim.substring(0, 180)}${factCheckData.claim.length > 180 ? '...' : ''}"</div>
        <div style="font-size: 12px; opacity: 0.85; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word; margin-bottom: 8px;">
            <div id="analysis-text-${factCheckData.timestamp || Date.now()}" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; transition: all 0.3s ease;">
                ${factCheckData.judgement.reasoning || factCheckData.judgement.summary || 'No detailed explanation available'}
            </div>
            <button id="expand-btn-${factCheckData.timestamp || Date.now()}" onclick="window.factChecker.toggleAnalysis('${factCheckData.timestamp || Date.now()}')"
                    style="background: none; border: none; color: rgba(255,255,255,0.7); font-size: 10px; cursor: pointer;
                           margin-top: 4px; padding: 0; text-decoration: underline; transition: color 0.2s ease;"
                    onmouseover="this.style.color='white'" onmouseout="this.style.color='rgba(255,255,255,0.7)'">
                Show more
            </button>
        </div>
        ${sourcesPreview}

        <!-- Minimize button in bottom right corner -->
        <button id="minimize-btn-${factCheckData.timestamp || Date.now()}" onclick="window.factChecker.minimizeCard()"
                style="
                    position: absolute;
                    bottom: 0px;
                    right: 0px;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    font-size: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    z-index: 10;
                "
                onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1.1)'"
                onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)'"
                title="Minimize">
            ×
        </button>
    `;

    this.activeIndicator.appendChild(content);

    // Make the fact checker available globally for navigation and minimize functionality
    window.factChecker = this;
};

YouTubeFactChecker.prototype.showCardContent = function() {
    const content = this.activeIndicator.querySelector('.fact-checker-content');
    if (content) {
        content.offsetHeight; // reflow
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
    }
};

YouTubeFactChecker.prototype.hideCardContent = function() {
    const content = this.activeIndicator.querySelector('.fact-checker-content');
    if (content) {
        content.style.transition = 'opacity 100ms ease-out, transform 100ms ease-out';
        content.style.opacity = '0';
        content.style.transform = 'translateY(8px)';
    }
    const effect = this.activeIndicator.querySelector('.liquidGlass-effect');
    if (effect) effect.style.opacity = '0.9';


};

YouTubeFactChecker.prototype.clearCardContent = function() {
    const existingContent = this.activeIndicator ? this.activeIndicator.querySelector('.fact-checker-content') : null;
    if (existingContent) existingContent.remove();
};

YouTubeFactChecker.prototype.ensureCardGlassLayers = function() {
    if (!this.activeIndicator) return;
    // Ensure the liquid glass layers exist. If the activeIndicator was recreated without them, add them.
    if (!this.activeIndicator.querySelector('.liquidGlass-effect')) {
        const effect = document.createElement('div');
        effect.className = 'liquidGlass-effect';
        const tint = document.createElement('div');
        tint.className = 'liquidGlass-tint';
        const shine = document.createElement('div');
        shine.className = 'liquidGlass-shine';
        this.activeIndicator.appendChild(effect);
        this.activeIndicator.appendChild(tint);
        this.activeIndicator.appendChild(shine);
    }
};

YouTubeFactChecker.prototype.navigateToClaim = function(claimIndex) {
    if (!this.mockFactChecks || claimIndex < 0 || claimIndex >= this.mockFactChecks.length) {
        console.warn('Invalid claim index for navigation:', claimIndex);
        return;
    }

    const targetClaim = this.mockFactChecks[claimIndex];
    console.log('Navigating to claim:', claimIndex, targetClaim);

    // Update the card content with the new claim
    this.injectCardContent(targetClaim, false);

    // Optionally jump to the timestamp
    this.jumpToTimestamp(targetClaim.timestamp);
};

YouTubeFactChecker.prototype.toggleAnalysis = function(identifier) {
    const analysisText = document.getElementById(`analysis-text-${identifier}`);
    const expandBtn = document.getElementById(`expand-btn-${identifier}`);

    if (!analysisText || !expandBtn) {
        console.warn('Analysis elements not found for identifier:', identifier);
        return;
    }

    const isExpanded = analysisText.style.webkitLineClamp === 'none' || analysisText.style.display === 'block';

    if (isExpanded) {
        // Collapse: show only 3 lines
        analysisText.style.display = '-webkit-box';
        analysisText.style.webkitLineClamp = '3';
        analysisText.style.webkitBoxOrient = 'vertical';
        analysisText.style.overflow = 'hidden';
        expandBtn.textContent = 'Show more';
    } else {
        // Expand: show full text
        analysisText.style.display = 'block';
        analysisText.style.webkitLineClamp = 'none';
        analysisText.style.webkitBoxOrient = 'unset';
        analysisText.style.overflow = 'visible';
        expandBtn.textContent = 'Show less';
    }
};

YouTubeFactChecker.prototype._createSourcesSection = function(factCheckData) {
        // Handle both 'sources' (URL strings) and 'evidence' (objects with source_url) formats
        let sourcesData = [];

        if (factCheckData.evidence && factCheckData.evidence.length > 0) {
            // New format: evidence array with objects containing source_url, source_title, snippet
            sourcesData = factCheckData.evidence.map(evidence => ({
                url: evidence.source_url,
                title: evidence.source_title || 'Source',
                snippet: evidence.snippet
            }));
        } else if (factCheckData.sources && factCheckData.sources.length > 0) {
            // Legacy format: sources array with URL strings
            sourcesData = factCheckData.sources.map(source => {
                try {
                    const domain = new URL(source).hostname.replace('www.', '');
                    return {
                        url: source,
                        title: domain,
                        snippet: null
                    };
                } catch {
                    const fallbackDomain = source.includes('//') ? source.split('//')[1].split('/')[0] : source.substring(0, 20);
                    return {
                        url: source,
                        title: fallbackDomain,
                        snippet: null
                    };
                }
            });
        }

        if (sourcesData.length === 0) {
            return '';
        }

        const displaySources = sourcesData.slice(0, 3); // Show up to 3 sources
        const remainingCount = sourcesData.length - displaySources.length;

        return `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.15);">
            <div style="font-size: 10px; opacity: 0.7; margin-bottom: 4px;">Sources (${sourcesData.length}):</div>
            <div style="font-size: 10px; opacity: 0.8; line-height: 1.2; display: flex; flex-wrap: wrap; gap: 4px;">
                ${displaySources.map((source, index) => `
                    <a href="${source.url}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       onclick="event.stopPropagation(); window.factChecker.markUserInteracted();"
                       style="
                           background: rgba(255,255,255,0.15); 
                           padding: 2px 6px; 
                           border-radius: 3px; 
                           text-decoration: none; 
                           color: white; 
                           font-size: 10px;
                           flex-shrink: 0;
                           transition: background 0.2s ease;
                           cursor: pointer;
                       "
                       onmouseover="this.style.background='rgba(255,255,255,0.25)';"
                       onmouseout="this.style.background='rgba(255,255,255,0.15)';"
                       title="${source.snippet ? source.snippet : 'Click to open source'}">${source.title}</a>
                `).join('')}
                ${remainingCount > 0 ? `<span style="opacity: 0.6; font-size: 9px;">+${remainingCount} more</span>` : ''}
            </div>
        </div>
    `;
};

YouTubeFactChecker.prototype.markUserInteracted = function() {
    // Mark that user has interacted to prevent auto-closing
    this.userInteracted = true;
    console.log('🔗 User clicked source link - preventing auto-close');
};

YouTubeFactChecker.prototype.minimizeCard = function() {
    console.log('🔽 Minimizing card via minimize button');
    this.userInteracted = true;
    this.clearAutoCloseTimer();
    this.morphToFab();
};

console.log('✅ Content morph module loaded');