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
        showExtensionReloadNotification();
        return;
    }

    try {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                const error = chrome.runtime.lastError.message;

                if (error.includes('Extension context invalidated') ||
                    error.includes('message port closed')) {
                    console.warn('⚠️ Extension context invalidated:', error);
                    showExtensionReloadNotification();
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
            showExtensionReloadNotification();
        }
    }
}

/**
 * Show a notification to the user that they need to reload the page
 */
function showExtensionReloadNotification() {
    // Only show once per page load
    if (window._extensionReloadNotificationShown) {
        return;
    }
    window._extensionReloadNotificationShown = true;

    const notification = document.createElement('div');
    notification.id = 'fact-checker-reload-notification';
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        max-width: 320px;
        cursor: pointer;
        transition: transform 0.2s;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: start; gap: 12px;">
            <div style="font-size: 24px;">🔄</div>
            <div>
                <div style="font-weight: 600; margin-bottom: 4px;">Extension Updated</div>
                <div style="font-size: 12px; opacity: 0.95; line-height: 1.4;">
                    The Fact-Checker extension was updated. Click here to reload the page and continue.
                </div>
            </div>
        </div>
    `;

    notification.addEventListener('mouseenter', () => {
        notification.style.transform = 'scale(1.02)';
    });

    notification.addEventListener('mouseleave', () => {
        notification.style.transform = 'scale(1)';
    });

    notification.addEventListener('click', () => {
        window.location.reload();
    });

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 10000);
}

/**
 * Setup global error handler for extension context invalidation
 */
function setupExtensionErrorHandler() {
    // Check periodically if extension context is still valid
    const checkInterval = setInterval(() => {
        if (!isExtensionContextValid()) {
            clearInterval(checkInterval);
            showExtensionReloadNotification();
        }
    }, 5000); // Check every 5 seconds

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.message) {
            const message = event.reason.message;
            if (message.includes('Extension context invalidated') ||
                message.includes('message port closed')) {
                event.preventDefault(); // Prevent console error
                showExtensionReloadNotification();
            }
        }
    });

    console.log('✅ Extension error handler initialized');
}

// Initialize error handler when script loads
setupExtensionErrorHandler();