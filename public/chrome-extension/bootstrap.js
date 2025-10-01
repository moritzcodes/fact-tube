// Bootstrap the content script and handle SPA navigations

// Global instance management
window.factCheckerInstance = null;

function startYouTubeFactChecker() {
    // Clean up any existing global instance
    if (window.factCheckerInstance) {
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
    const instance = new YouTubeFactChecker();
    window.factCheckerInstance = instance;
    instance.init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startYouTubeFactChecker);
} else {
    startYouTubeFactChecker();
}

let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => {
            startYouTubeFactChecker();
        }, 1000);
    }
}).observe(document, { subtree: true, childList: true });

console.log('YouTube Fact-Checker content scripts loaded');