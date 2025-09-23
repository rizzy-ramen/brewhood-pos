# API Configuration

This directory contains centralized configuration for the POS system.

## Files

### `api.js`
Contains the main API configuration including:
- **BASE_URL**: The main backend server URL (Cloudflare tunnel)
- **API_URL**: Full API endpoint URL (BASE_URL + '/api')
- **WEBSOCKET_URL**: WebSocket connection URL (same as BASE_URL)

## Usage

Import the configuration in your components/services:

```javascript
// For API calls
import { API_BASE_URL } from '../config/api';

// For WebSocket connections
import { WEBSOCKET_BASE_URL } from '../config/api';

// For image URLs
import { BACKEND_BASE_URL } from '../config/api';
```

## Updating the Backend URL

When the Cloudflare tunnel URL changes, update **only** the `BASE_URL` in `api.js`:

```javascript
export const API_CONFIG = {
  BASE_URL: 'https://your-new-tunnel-url.trycloudflare.com',
  // ... rest of the config is automatically updated
};
```

All services will automatically use the new URL without any additional changes needed.
