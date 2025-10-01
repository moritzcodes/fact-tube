// Overlay container for timeline markers and morphing FAB
// Note: The old claim overlay system was replaced by the morphing FAB UI (content.morph.js)

YouTubeFactChecker.prototype.createOverlayContainer = function() {
    // Remove existing overlay container
    if (this.overlayContainer) this.overlayContainer.remove();

    // Create overlay container
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'fact-checker-overlay';
    this.overlayContainer.style.cssText = `
        position: absolute; 
        top: 0; 
        left: 0; 
        width: 100%; 
        height: 100%; 
        pointer-events: none; 
        z-index: 1000;
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

console.log('✅ Content overlay module loaded');