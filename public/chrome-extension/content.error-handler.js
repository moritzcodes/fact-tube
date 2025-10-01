// Error handling utilities for Chrome extension context

/**
 * Check if the extension context is still valid
 */
function isExtensionContextValid() {
    try {
        return chrome.runtime && chrome.runtime.id !== undefined;
    } catch (e) {
        return false;
    }
}

/**
 * Safely send a message to the background script with error handling
 */
function safeSendMessage(message, callback) {
    if (!isExtensionContextValid()) {
        console.warn('⚠️ Extension context invalidated. Please reload the page.');
        return;
    }

    try {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                const error = chrome.runtime.lastError.message;

                if (error.includes('Extension context invalidated') ||
                    error.includes('message port closed')) {
                    console.warn('⚠️ Extension context invalidated:', error);
                    return;
                }

                console.error('❌ Chrome runtime error:', error);
            }

            if (callback) {
                callback(response);
            }
        });
    } catch (error) {
        console.error('❌ Error sending message:', error);
        if (error.message.includes('Extension context invalidated')) {
            console.warn('⚠️ Extension context invalidated. Please reload the page.');
        }
    }
}


/**
 * Setup global error handler for extension context invalidation
 */
function setupExtensionErrorHandler() {
    // Check periodically if extension context is still valid
    const checkInterval = setInterval(() => {
        if (!isExtensionContextValid()) {
            clearInterval(checkInterval);
            console.warn('⚠️ Extension context invalidated. Please reload the page.');
        }
    }, 5000); // Check every 5 seconds

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.message) {
            const message = event.reason.message;
            if (message.includes('Extension context invalidated') ||
                message.includes('message port closed')) {
                event.preventDefault(); // Prevent console error
                console.warn('⚠️ Extension context invalidated. Please reload the page.');
            }
        }
    });

    console.log('✅ Extension error handler initialized');
}

// Initialize error handler when script loads
setupExtensionErrorHandler();
setupExtensionErrorHandler();