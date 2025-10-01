// Configuration for Chrome Extension

// API Configuration
const CONFIG = {
    // Development settings
    development: {
        apiBaseUrl: 'http://localhost:3000',
        enableLogging: true,
        ssePollingInterval: 2000, // 2 seconds
    },

    // Production settings
    production: {
        apiBaseUrl: 'https://your-app.vercel.app', // Update this with your production URL
        enableLogging: false,
        ssePollingInterval: 3000, // 3 seconds
    },

    // Get current environment
    get environment() {
        // Check if we're in development (localhost)
        return window.location.hostname === 'localhost' ? 'development' : 'production';
    },

    // Get current config based on environment
    get current() {
        return this[this.environment];
    },

    // Get API base URL
    get apiBaseUrl() {
        return this.current.apiBaseUrl;
    },

    // Check if logging is enabled
    get enableLogging() {
        return this.current.enableLogging;
    },
};

// Export config
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}