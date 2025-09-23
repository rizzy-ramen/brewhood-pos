// Centralized API Configuration
// Update this URL when the backend changes and all services will automatically use the new URL

export const API_CONFIG = {
  // Current Cloudflare tunnel URL
  BASE_URL: 'https://governor-museums-each-additions.trycloudflare.com',
  
  // API endpoints
  get API_URL() {
    return `${this.BASE_URL}/api`;
  },
  
  // WebSocket URL (same as base URL for Socket.io)
  get WEBSOCKET_URL() {
    return this.BASE_URL;
  }
};

// Export individual URLs for convenience
export const API_BASE_URL = API_CONFIG.API_URL;
export const WEBSOCKET_BASE_URL = API_CONFIG.WEBSOCKET_URL;
export const BACKEND_BASE_URL = API_CONFIG.BASE_URL;

// Default export for easy importing
export default API_CONFIG;
