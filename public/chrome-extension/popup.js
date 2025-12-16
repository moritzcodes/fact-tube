// Popup script for FactTube settings

// DOM elements
const openrouterKeyInput = document.getElementById('openrouter-key');
const apiUrlInput = document.getElementById('api-url');
const saveBtn = document.getElementById('save-btn');
const toggleVisibilityBtn = document.getElementById('toggle-visibility');
const messageDiv = document.getElementById('message');

// Load saved settings on popup open
document.addEventListener('DOMContentLoaded', async() => {
    await loadSettings();
});

// Load settings from Chrome storage
async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['openrouterApiKey', 'apiBaseUrl']);

        if (result.openrouterApiKey) {
            openrouterKeyInput.value = result.openrouterApiKey;
        }

        if (result.apiBaseUrl) {
            apiUrlInput.value = result.apiBaseUrl;
        } else {
            // Default to production URL for deployed version
            apiUrlInput.value = 'https://fact-tube.vercel.app';
        }

        console.log('✅ Settings loaded');
    } catch (error) {
        console.error('❌ Error loading settings:', error);
        showMessage('Failed to load settings', 'error');
    }
}

// Save settings to Chrome storage
async function saveSettings() {
    const openrouterKey = openrouterKeyInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();

    if (!openrouterKey) {
        showMessage('Please enter an API key', 'error');
        return;
    }

    if (!apiUrl) {
        showMessage('Please enter a backend URL', 'error');
        return;
    }

    // Validate URL safety
    try {
        const url = new URL(apiUrl);
        
        // Only allow HTTPS for production domains (except localhost for development)
        if (url.protocol !== 'https:' && !url.hostname.includes('localhost') && url.hostname !== '127.0.0.1') {
            showMessage('Production URLs must use HTTPS', 'error');
            return;
        }
        
        // Ensure production URL is correct
        if (url.hostname.includes('vercel.app') && url.hostname !== 'fact-tube.vercel.app') {
            showMessage('Invalid Vercel domain. Use https://fact-tube.vercel.app', 'error');
            return;
        }
    } catch (error) {
        showMessage('Invalid URL format', 'error');
        return;
    }

    // Validate API key format
    if (!openrouterKey.startsWith('sk-or-')) {
        showMessage('Invalid API key format', 'error');
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        await chrome.storage.local.set({
            openrouterApiKey: openrouterKey,
            apiBaseUrl: apiUrl
        });

        showMessage('Settings saved', 'success');

        console.log('✅ Settings saved');
    } catch (error) {
        console.error('❌ Error saving settings:', error);
        showMessage('Failed to save settings', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

// Toggle password visibility
function toggleVisibility() {
    const currentType = openrouterKeyInput.type;
    openrouterKeyInput.type = currentType === 'password' ? 'text' : 'password';
    toggleVisibilityBtn.textContent = currentType === 'password' ? '🙈' : '👁️';
}

// Show message to user
function showMessage(text, type = 'info') {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.classList.add('hidden');
        }, 3000);
    }
}

// Event listeners
saveBtn.addEventListener('click', saveSettings);
toggleVisibilityBtn.addEventListener('click', toggleVisibility);

// Allow Enter key to save
openrouterKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveSettings();
});

apiUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveSettings();
});