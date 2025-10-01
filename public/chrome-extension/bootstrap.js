// Bootstrap the content script and handle SPA navigations

// Global instance management
window.factCheckerInstance = null;

function startYouTubeFactChecker() {
    console.log('🎬 startYouTubeFactChecker called');
    console.log('📍 Current URL:', window.location.href);
    console.log('📍 Pathname:', window.location.pathname);

    // Only initialize on YouTube watch pages
    if (window.location.pathname !== '/watch') {
        console.log('⏭️ Not a watch page, skipping initialization');
        return;
    }

    // Clean up any existing global instance
    if (window.factCheckerInstance) {
        console.log('🧹 Cleaning up existing instance');
        // Clean up existing instance
        if (window.factCheckerInstance.activeIndicator) {
            window.factCheckerInstance.activeIndicator.remove();
        }
        if (window.factCheckerInstance.overlayContainer) {
            window.factCheckerInstance.overlayContainer.remove();
        }
        window.factCheckerInstance = null;
    }

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
        setTimeout(() => {
            startYouTubeFactChecker();
        }, 1000);
    }
}).observe(document, { subtree: true, childList: true });

console.log('🚀 YouTube Fact-Checker content scripts loaded');