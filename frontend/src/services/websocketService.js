import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentRole = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventListeners = new Map();
  }

  // Connect to the backend WebSocket
  connect(role = 'delivery') {
    if (this.socket && this.isConnected) {
      // If already connected but with different role, disconnect and reconnect
      if (this.currentRole !== role) {
        this.disconnect();
      } else {
        return;
      }
    }

    try {
      // Extract base URL from API_BASE_URL (remove /api)
      const baseUrl = API_BASE_URL.replace('/api', '');
      
      this.socket = io(baseUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay
      });

      this.currentRole = role;
      this.setupEventHandlers(role);
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
    }
  }

  // Setup WebSocket event handlers
  setupEventHandlers(role = 'delivery') {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🔌 WebSocket connected successfully with ID:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Join the appropriate room based on role
      const roomName = role === 'counter' ? 'counter' : 'delivery';
      this.socket.emit('joinRoom', roomName);
      console.log(`👥 WebSocket joined ${roomName} room`);
      
      // Authenticate with demo token
      this.socket.emit('authenticate', { 
        role: role, 
        id: 'demo-user' 
      });
      console.log(`🔐 WebSocket authenticated as ${role} user`);
    });

    this.socket.on('disconnect', (reason) => {
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
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_failed', () => {
      this.reconnectAttempts = this.maxReconnectAttempts;
    });

    // Handle real-time order updates
    this.socket.on('orderPlaced', (order) => {
      console.log('📦 WebSocket received orderPlaced event:', order);
      this.emit('orderPlaced', order);
    });

    this.socket.on('orderStatusUpdated', (data) => {
      this.emit('orderStatusUpdated', data);
    });

    this.socket.on('itemPreparationUpdated', (data) => {
      this.emit('itemPreparationUpdated', data);
    });

    this.socket.on('orderDeleted', (orderId) => {
      this.emit('orderDeleted', orderId);
    });

    // Test event listener
    this.socket.on('testEvent', (data) => {
      console.log('🧪 WebSocket test event received:', data);
      this.emit('testEvent', data);
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
