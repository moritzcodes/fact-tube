// Bootstrap the content script and handle SPA navigations

// Global instance management
window.factCheckerInstance = null;

function cleanupExistingInstance() {
    if (window.factCheckerInstance) {
        console.log('🧹 Cleaning up existing instance');

        // Remove DOM elements
        if (window.factCheckerInstance.activeIndicator) {
            window.factCheckerInstance.activeIndicator.remove();
        }
        if (window.factCheckerInstance.overlayContainer) {
            window.factCheckerInstance.overlayContainer.remove();
        }

        // Clear timeline markers (using correct class name)
        const existingMarkers = document.querySelectorAll('.fact-check-timeline-marker');
        existingMarkers.forEach(marker => marker.remove());
        console.log('🧹 Removed', existingMarkers.length, 'timeline markers');

        // Clear any remaining overlays
        const existingOverlays = document.querySelectorAll('.fact-check-claim');
        existingOverlays.forEach(overlay => overlay.remove());
        console.log('🧹 Removed', existingOverlays.length, 'claim overlays');

        // Clear timers
        if (window.factCheckerInstance.videoPlaybackTimer) {
            clearInterval(window.factCheckerInstance.videoPlaybackTimer);
        }
        if (window.factCheckerInstance.autoCloseTimer) {
            clearTimeout(window.factCheckerInstance.autoCloseTimer);
        }
        if (window.factCheckerInstance.playerResizeObserver) {
            window.factCheckerInstance.playerResizeObserver.disconnect();
        }

        // Clear glass filter SVG
        const glassFilter = document.getElementById('glass-distortion');
        if (glassFilter && glassFilter.parentElement) {
            glassFilter.parentElement.remove();
        }

        // Clear morph styles
        const morphStyles = document.getElementById('fact-checker-morph-styles');
        if (morphStyles) {
            morphStyles.remove();
        }

        window.factCheckerInstance = null;
        console.log('✅ Cleanup complete');
    }
}

function startYouTubeFactChecker() {
    console.log('🎬 startYouTubeFactChecker called');
    console.log('📍 Current URL:', window.location.href);
    console.log('📍 Pathname:', window.location.pathname);

    // Only initialize on YouTube watch pages
    if (window.location.pathname !== '/watch') {
        console.log('⏭️ Not a watch page, skipping initialization');
        cleanupExistingInstance(); // Clean up if leaving watch page
        return;
    }

    // Extract video ID from current URL
    const urlParams = new URLSearchParams(window.location.search);
    const newVideoId = urlParams.get('v');

    // Check if this is the same video
    const isNewVideo = !window.factCheckerInstance || window.factCheckerInstance.videoId !== newVideoId;

    if (!isNewVideo) {
        console.log('ℹ️ Same video, skipping re-initialization');
        return;
    }

    console.log('🆕 New video detected:', newVideoId);

    // Clean up existing instance
    cleanupExistingInstance();

    // Notify background script about video change
    safeSendMessage({
        type: 'VIDEO_CHANGED',
        videoId: newVideoId
    }, (response) => {
        if (response && response.success) {
            console.log('✅ Background script notified of video change');
        }
    });

    // Create new instance
    console.log('✨ Creating new YouTubeFactChecker instance');
    const instance = new YouTubeFactChecker();
    window.factCheckerInstance = instance;
    instance.init();
    console.log('✅ YouTubeFactChecker instance created and initialized');
}

if (document.readyState === 'loading') {
    console.log('📄 Document still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', startYouTubeFactChecker);
} else {
    console.log('📄 Document already loaded, starting immediately');
    startYouTubeFactChecker();
}

let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        console.log('🔄 URL changed from', lastUrl, 'to', url);
        lastUrl = url;

        // Immediately clear old markers and UI elements (don't wait)
        console.log('🧹 Immediately clearing old UI elements...');
        const markers = document.querySelectorAll('.fact-check-timeline-marker');
        markers.forEach(m => m.remove());
        console.log(`🧹 Cleared ${markers.length} timeline markers immediately`);

        const overlays = document.querySelectorAll('.fact-check-claim');
        overlays.forEach(o => o.remove());
        console.log(`🧹 Cleared ${overlays.length} overlays immediately`);

        const indicators = document.querySelectorAll('#fact-checker-indicator, .fact-checker-fab');
        indicators.forEach(i => i.remove());
        console.log(`🧹 Cleared ${indicators.length} indicators immediately`);

        // Then wait for YouTube's player to be ready before initializing
        setTimeout(() => {
            startYouTubeFactChecker();
        }, 500);
    }
}).observe(document, { subtree: true, childList: true });

console.log('🚀 YouTube Fact-Checker content scripts loaded');