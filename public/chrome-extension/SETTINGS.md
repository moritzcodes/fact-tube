# Extension Settings Guide

## Overview

The FactTube Chrome extension now supports custom OpenRouter API keys, allowing users to use their own API credentials instead of relying on a shared key. This is essential for production use and gives users full control over their API usage and costs.

## How to Configure

### 1. Get Your OpenRouter API Key

1. Visit [openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up or log in to your account
3. Create a new API key
4. Copy the key (it should start with `sk-or-v1-...`)

### 2. Open Extension Settings

1. Click on the FactTube extension icon in your Chrome toolbar
2. A popup will appear with the settings interface

### 3. Configure Your Settings

**OpenRouter API Key:**
- Paste your API key in the "OpenRouter API Key" field
- Click the eye icon to toggle visibility if needed
- The key is stored securely in your browser's local storage

**Backend URL:**
- For development: `http://localhost:3000` (default)
- For production: Update this to your deployed backend URL (e.g., `https://your-app.vercel.app`)

### 4. Save and Test

1. Click "Save Settings" to store your configuration
2. Click "Test Connection" to verify your backend is reachable
3. The status badge will update to "Configured" when an API key is set

## How It Works

### Security

- ✅ **Secure Local Storage**: Your API key is stored locally in Chrome's storage API
- ✅ **No Server Storage**: Your key is never stored on our servers
- ✅ **Direct API Calls**: The key is sent directly from your browser to OpenRouter
- ✅ **Full Control**: You control your own API usage and costs

### API Key Usage

When you use the extension:

1. The extension retrieves your API key from local storage
2. It includes the key in API requests to your backend as an `X-OpenRouter-API-Key` header
3. Your backend uses this key to make requests to OpenRouter
4. If no custom key is provided, the backend falls back to its environment variable (if configured)

### Cost Management

- You pay directly to OpenRouter based on your usage
- Monitor your usage at [openrouter.ai/activity](https://openrouter.ai/activity)
- Set up billing limits in your OpenRouter account
- Typical cost: ~$0.001-0.005 per video (using GPT-4o-mini)

## Troubleshooting

### "API key is required" Error

- Make sure you've saved your API key in the settings
- Verify the key starts with `sk-or-`
- Check that your OpenRouter account has credits

### "Connection Failed" Error

- Ensure your backend is running (for development: `pnpm dev`)
- Verify the Backend URL is correct
- Check your network connection
- Look at the browser console for detailed error messages

### Settings Not Saving

- Check Chrome's storage permissions for the extension
- Try reloading the extension
- Clear browser cache and try again

## For Developers

### Backend Integration

The backend automatically detects and uses custom API keys:

```typescript
// In your API route
const customApiKey = request.headers.get('X-OpenRouter-API-Key');
const apiKey = customApiKey || env.OPENROUTER_API_KEY;

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: apiKey,
  // ... other config
});
```

### Storage Schema

```javascript
{
  openrouterApiKey: "sk-or-v1-...", // User's custom API key
  apiBaseUrl: "http://localhost:3000" // Backend URL
}
```

### Accessing Settings in Extension Code

```javascript
// Get settings
const settings = await chrome.storage.local.get(['openrouterApiKey', 'apiBaseUrl']);

// Use in API calls
const headers = {
  'Content-Type': 'application/json',
};

if (settings.openrouterApiKey) {
  headers['X-OpenRouter-API-Key'] = settings.openrouterApiKey;
}

fetch(`${settings.apiBaseUrl}/api/endpoint`, {
  headers: headers,
  // ...
});
```

## Privacy Policy

### Data We Store Locally

- OpenRouter API key (encrypted by Chrome)
- Backend URL preference

### Data We DO NOT Collect

- Your API key is never sent to our servers
- We don't track your API usage
- We don't store your personal information
- We don't share your data with third parties

## Support

For issues or questions:
- Check the [main README](../../README.md)
- Review the [Chrome Extension Setup Guide](./README.md)
- Open an issue on GitHub

