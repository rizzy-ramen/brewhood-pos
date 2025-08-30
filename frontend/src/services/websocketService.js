import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventListeners = new Map();
  }

  // Connect to the backend WebSocket
  connect() {
    if (this.socket && this.isConnected) {
      console.log('🔌 WebSocket already connected');
      return;
    }

    try {
      // Extract base URL from API_BASE_URL (remove /api)
      const baseUrl = API_BASE_URL.replace('/api', '');
      console.log('🔌 Connecting to WebSocket:', baseUrl);
      
      this.socket = io(baseUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
    }
  }

  // Setup WebSocket event handlers
  setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Join the delivery room for real-time updates
      this.socket.emit('joinRoom', 'delivery');
      
      // Authenticate with demo token
      this.socket.emit('authenticate', { 
        role: 'delivery', 
        id: 'demo-user' 
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.isConnected = false;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ WebSocket reconnection failed after', this.maxReconnectAttempts, 'attempts');
      this.reconnectAttempts = this.maxReconnectAttempts;
    });

    // Handle real-time order updates
    this.socket.on('orderPlaced', (order) => {
      console.log('📦 Real-time order placed:', order);
      this.emit('orderPlaced', order);
    });

    this.socket.on('orderStatusUpdated', (data) => {
      console.log('🔄 Real-time order status updated:', data);
      this.emit('orderStatusUpdated', data);
    });

    this.socket.on('itemPreparationUpdated', (data) => {
      console.log('🍳 Real-time item preparation updated:', data);
      this.emit('itemPreparationUpdated', data);
    });

    this.socket.on('orderDeleted', (orderId) => {
      console.log('🗑️ Real-time order deleted:', orderId);
      this.emit('orderDeleted', orderId);
    });
  }

  // Emit custom events to registered listeners
  emit(event, data) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('❌ Error in event listener:', error);
      }
    });
  }

  // Register event listeners
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  // Remove event listeners
  off(event, callback) {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id || null,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
