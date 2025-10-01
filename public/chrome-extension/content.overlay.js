// Overlay container and claim overlays

YouTubeFactChecker.prototype.createOverlayContainer = function() {
    // Remove existing overlay container
    if (this.overlayContainer) this.overlayContainer.remove();

    // Create overlay container
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'fact-checker-overlay';
    this.overlayContainer.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000;
  `;

    // Find YouTube player container
    const playerContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (playerContainer) {
        playerContainer.style.position = 'relative';
        playerContainer.appendChild(this.overlayContainer);
    }
};

YouTubeFactChecker.prototype.clearOverlays = function() {
    if (this.isMorphed) this.morphToFab();
    this.clearTimeouts();

    // Clear timeline markers
    const existingMarkers = document.querySelectorAll('.fact-check-timeline-marker');
    existingMarkers.forEach((marker) => marker.remove());

    // Clear tooltips
    this.hideTimelineTooltip();

    // Clear SVG filter
    const svgFilter = document.getElementById('fact-checker-svg-filter');
    if (svgFilter) svgFilter.remove();

    this.currentDisplayedClaim = null;
};

YouTubeFactChecker.prototype.createClaimOverlay = function(factCheck, index) {
        // Ensure glass filter exists
        this.createGlassFilter();

        const overlay = document.createElement('div');
        overlay.className = 'fact-check-claim liquidGlass-wrapper';

        // Calculate initial position with edge detection
        const playerContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
        const containerRect = playerContainer ? playerContainer.getBoundingClientRect() : { width: window.innerWidth };

        const overlayWidth = 320;
        const rightMargin = 20;
        const topPosition = 20 + index * 70;

        // Edge detection: check if overlay would be cut off on the right
        const wouldBeCutOff = (containerRect.width - rightMargin) < overlayWidth;
        const horizontalPosition = wouldBeCutOff ? 'left: 20px' : 'right: 20px';
        const initialTransform = wouldBeCutOff ? 'translateX(-100%)' : 'translateX(100%)';

        // Edge detection: check if overlay would be cut off at the bottom
        const maxTop = Math.max(20, containerRect.height - 200); // Ensure at least 200px from bottom
        const adjustedTop = Math.min(topPosition, maxTop);

        overlay.style.cssText = `
    position: absolute; top: ${adjustedTop}px; ${horizontalPosition}; max-width: ${overlayWidth}px; 
    width: ${Math.min(overlayWidth, containerRect.width - 80)}px;
    color: white; padding: 14px; border-radius: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px; pointer-events: auto; cursor: pointer; border-left: 4px solid ${this.getCategoryColor(
      factCheck.categoryOfLikeness
    )}; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4), 0 4px 20px rgba(0, 0, 0, 0.4); 
    transform: ${initialTransform}; opacity: 0; 
    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    z-index: 1002;
    overflow: hidden;
  `;

        // Create liquid glass structure (same as FAB)
        const effect = document.createElement('div');
        effect.className = 'liquidGlass-effect';
        effect.style.cssText = `
    position: absolute; z-index: 0; inset: 0; border-radius: inherit; 
    backdrop-filter: blur(2px) saturate(1.1); 
    filter: url(#glass-distortion); 
    overflow: hidden; isolation: isolate;
    pointer-events: none;
  `;

        const tint = document.createElement('div');
        tint.className = 'liquidGlass-tint';
        tint.style.cssText = `
    z-index: 1; position: absolute; inset: 0; border-radius: inherit; 
    height: 100%;
    background: rgba(0, 0, 0, 0.75);
    pointer-events: none;
  `;

        const shine = document.createElement('div');
        shine.className = 'liquidGlass-shine';
        shine.style.cssText = `
    position: absolute; inset: 0; z-index: 2; border-radius: inherit; overflow: hidden; 
    box-shadow: inset 4px 4px 2px 0 rgba(255, 255, 255, 0.16), inset -2px -2px 2px 2px rgba(255, 255, 255, 0.16);
    pointer-events: none;
  `;

        overlay.appendChild(effect);
        overlay.appendChild(tint);
        overlay.appendChild(shine);

        // Create content container above glass layers
        const contentContainer = document.createElement('div');
        contentContainer.className = 'liquidGlass-text';
        contentContainer.style.cssText = `
    z-index: 3; position: relative; width: 100%; height: 100%;
    color: white; pointer-events: auto;
  `;

        const statusIcon = this.getCategoryIcon(factCheck.categoryOfLikeness);

        // Debug logging to check sources data
        console.log('Creating overlay for fact check:', factCheck);
        console.log('Sources data:', factCheck.sources);
        const sourcesPreview = factCheck.sources && factCheck.sources.length > 0 ?
            `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
           <div style="font-size: 10px; opacity: 0.7; margin-bottom: 4px;">Sources (${factCheck.sources.length}):</div>
           <div style="font-size: 10px; opacity: 0.8; line-height: 1.2;">
             ${factCheck.sources.slice(0, 2).map(source => {
               try {
                 const domain = new URL(source).hostname.replace('www.', '');
                 return `<span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px; margin-right: 4px; margin-bottom: 2px; display: inline-block;">${domain}</span>`;
               } catch {
                 // Fallback for invalid URLs
                 const fallbackDomain = source.includes('//') ? source.split('//')[1].split('/')[0] : source.substring(0, 20);
                 return `<span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 3px; margin-right: 4px; margin-bottom: 2px; display: inline-block;">${fallbackDomain}</span>`;
               }
             }).join('')}
             ${factCheck.sources.length > 2 ? `<span style="opacity: 0.6;">+${factCheck.sources.length - 2} more</span>` : ''}
           </div>
         </div>` 
      : '';
    
    console.log('Sources preview HTML:', sourcesPreview);
    
    contentContainer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
      <span style="font-size: 16px;">${statusIcon}</span>
      <span style="font-weight: 600; text-transform: capitalize; font-size: 12px; letter-spacing: 0.5px;">${
        factCheck.categoryOfLikeness
      }</span>
      <div style="margin-left: auto; width: 4px; height: 4px; background: rgba(255,255,255,0.5); border-radius: 50%"></div>
    </div>
    <div style="margin-bottom: 10px; line-height: 1.4; font-weight: 400;">"${factCheck.claim.substring(0, 120)}${
    factCheck.claim.length > 120 ? '...' : ''
  }"</div>
    <div style="font-size: 11px; opacity: 0.85; line-height: 1.3;">${factCheck.judgement.summary}</div>
    ${sourcesPreview}
    <div style="position: absolute; top: 8px; right: 8px; font-size: 10px; opacity: 0.6;">${this.formatTime(
      factCheck.timestamp
    )}</div>
  `;

    overlay.appendChild(contentContainer);

    // Click handler removed - no dialog popup needed

    this.overlayContainer.appendChild(overlay);

    // Entry delay animation - stagger based on index for cascade effect
    const entryDelay = 150 + (index * 100); // 150ms base delay + 100ms per overlay

    setTimeout(() => {
        requestAnimationFrame(() => {
            // Use CSS animation for more sophisticated entry effect based on position
            if (wouldBeCutOff) {
                overlay.style.animation = 'slideInWithBounceLeft 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
            } else {
                overlay.classList.add('entering');
            }
            overlay.style.transform = 'translateX(0)';
            overlay.style.opacity = '1';
        });
    }, entryDelay);

    // Store positioning info for hiding animation
    overlay.dataset.wouldBeCutOff = wouldBeCutOff;

    return overlay;
};

YouTubeFactChecker.prototype.hideClaimOverlay = function(overlay) {
    if (overlay && overlay.parentNode) {
        // Use the correct exit transform based on original positioning
        const wouldBeCutOff = overlay.dataset.wouldBeCutOff === 'true';
        const exitTransform = wouldBeCutOff ? 'translateX(-100%)' : 'translateX(100%)';

        overlay.style.transform = exitTransform;
        overlay.style.opacity = '0';
        setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 400);
    }
};

console.log('✅ Content overlay module loaded');