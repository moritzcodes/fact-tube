// Utility methods used across modules

YouTubeFactChecker.prototype.clearTimeouts = function() {
    this.popupTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.popupTimeouts = [];
};

YouTubeFactChecker.prototype.getCategoryColor = function(categoryOfLikeness) {
    switch (categoryOfLikeness) {
        case 'true':
            return '#4caf50';
        case 'false':
            return '#f44336';
        case 'neutral':
            return '#ff9800';
        default:
            return '#2196f3';
    }
};

YouTubeFactChecker.prototype.getCategoryIcon = function(categoryOfLikeness) {
    switch (categoryOfLikeness) {
        case 'true':
            return '✅';
        case 'false':
            return '❌';
        case 'neutral':
            return '⚠️';
        default:
            return '🔍';
    }
};

YouTubeFactChecker.prototype.getStatusColor = function(status) {
    switch (status) {
        case 'verified':
            return '#4caf50';
        case 'disputed':
            return '#ff9800';
        case 'false':
            return '#f44336';
        case 'inconclusive':
            return '#9e9e9e';
        default:
            return '#2196f3';
    }
};

YouTubeFactChecker.prototype.getStatusIcon = function(status) {
    switch (status) {
        case 'verified':
            return '✅';
        case 'disputed':
            return '⚠️';
        case 'false':
            return '❌';
        case 'inconclusive':
            return '❓';
        default:
            return '🔍';
    }
};

YouTubeFactChecker.prototype.formatTime = function(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Note: safeSendMessage is defined in content.error-handler.js
// This ensures it's available globally with proper error handling
console.log('✅ Content utilities loaded');