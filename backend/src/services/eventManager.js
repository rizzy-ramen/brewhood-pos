// Real-Time Event Manager for WebSocket communications
// This eliminates the need for frontend polling and reduces Firebase quota usage

class EventManager {
  constructor(io) {
    this.io = io;
    this.connectedClients = new Map(); // Track connected clients
    this.roomSubscriptions = new Map(); // Track room subscriptions
    this.cache = new Map(); // Smart caching for frequently accessed data
    this.cacheExpiry = new Map(); // Cache expiration timestamps
    
    console.log('🚀 Event Manager initialized');
  }

  // Register a client connection
  registerClient(socketId, userData) {
    // Check if client already exists
    const existingClient = this.connectedClients.get(socketId);
    
    if (existingClient) {
      // Update existing client data but preserve rooms
      existingClient.user = userData;
      console.log(`🔌 Client updated: ${socketId} (${userData?.role || 'unknown'}) - preserved ${existingClient.rooms.size} rooms`);
    } else {
      // Create new client
      this.connectedClients.set(socketId, {
        id: socketId,
        user: userData,
        rooms: new Set(),
        connectedAt: new Date()
      });
      console.log(`🔌 Client registered: ${socketId} (${userData?.role || 'unknown'})`);
    }
    
    console.log(`📊 Total clients now: ${this.connectedClients.size}`);
  }

  // Unregister a client connection
  unregisterClient(socketId) {
    const client = this.connectedClients.get(socketId);
    if (client) {
      // Leave all rooms
      client.rooms.forEach(room => {
        this.leaveRoom(socketId, room);
      });
      
      this.connectedClients.delete(socketId);
      console.log(`🔌 Client unregistered: ${socketId}`);
    }
  }

  // Join a room (for role-based updates)
  joinRoom(socketId, room) {
    const client = this.connectedClients.get(socketId);
    if (client) {
      client.rooms.add(room);
      
      if (!this.roomSubscriptions.has(room)) {
        this.roomSubscriptions.set(room, new Set());
      }
      this.roomSubscriptions.get(room).add(socketId);
      
      console.log(`👥 Client ${socketId} joined room: ${room}`);
      console.log(`📊 Client ${socketId} now has ${client.rooms.size} rooms: [${Array.from(client.rooms).join(', ')}]`);
    } else {
      console.log(`❌ Warning: Client ${socketId} not found when trying to join room: ${room}`);
    }
  }

  // Leave a room
  leaveRoom(socketId, room) {
    const client = this.connectedClients.get(socketId);
    if (client) {
      client.rooms.delete(room);
      
      const roomSubs = this.roomSubscriptions.get(room);
      if (roomSubs) {
        roomSubs.delete(socketId);
        if (roomSubs.size === 0) {
          this.roomSubscriptions.delete(room);
        }
      }
      
      console.log(`👥 Client ${socketId} left room: ${room}`);
    }
  }

  // Smart caching system
  async getCachedData(key, fetchFunction, ttl = 300000) { // 5 minutes default
    const now = Date.now();
    const cached = this.cache.get(key);
    const expiry = this.cacheExpiry.get(key);

    if (cached && expiry > now) {
      console.log('💾 Serving from cache:', key);
      return cached;
    }

    // Fetch fresh data only when needed
    console.log('🔄 Fetching fresh data:', key);
    const data = await fetchFunction();
    
    this.cache.set(key, data);
    this.cacheExpiry.set(key, now + ttl);
    
    return data;
  }

  // Clear cache for specific key
  clearCache(key) {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
    console.log('🗑️ Cache cleared for:', key);
  }

  // Broadcast to all clients
  broadcast(event, data) {
    console.log(`📡 EventManager: Broadcasting ${event} to ${this.connectedClients.size} clients`);
    this.io.emit(event, data);
    console.log(`📡 EventManager: Broadcasted ${event} to all clients`);
  }

  // Broadcast to specific room
  broadcastToRoom(room, event, data) {
    const roomSubs = this.roomSubscriptions.get(room);
    if (roomSubs && roomSubs.size > 0) {
      this.io.to(room).emit(event, data);
      console.log(`📡 Broadcasted ${event} to room ${room} (${roomSubs.size} clients)`);
    }
  }

  // Broadcast to specific client
  broadcastToClient(socketId, event, data) {
    this.io.to(socketId).emit(event, data);
    console.log(`📡 Broadcasted ${event} to client ${socketId}`);
  }

  // Order-related events
  notifyOrderCreated(order) {
    console.log('📦 EventManager: Notifying order created:', order.id);
    this.broadcast('orderPlaced', order); // Match frontend event name
    this.clearCache('orders'); // Clear orders cache
  }

  notifyOrderUpdated(order) {
    this.broadcast('orderUpdated', order);
    this.clearCache('orders'); // Clear orders cache
  }

  notifyOrderStatusChanged(orderId, status, updatedBy) {
    const eventData = { orderId, status, updatedBy, timestamp: new Date() };
    this.broadcast('orderStatusUpdated', eventData); // Match frontend event name
    this.clearCache('orders'); // Clear orders cache
  }

  notifyItemPreparationUpdated(orderId, itemId, result) {
    const eventData = { orderId, itemId, ...result, timestamp: new Date() };
    this.broadcast('itemPreparationUpdated', eventData);
    this.clearCache('orders'); // Clear orders cache
  }

  notifyOrderDeleted(orderId) {
    this.broadcast('orderDeleted', { orderId, timestamp: new Date() });
    this.clearCache('orders'); // Clear orders cache
  }

  // Product-related events
  notifyProductCreated(product) {
    this.broadcast('productCreated', product);
    this.clearCache('products'); // Clear products cache
    this.clearCache('available_products'); // Clear available products cache
    this.clearCache('all_products'); // Clear all products cache
  }

  notifyProductUpdated(product) {
    this.broadcast('productUpdated', product);
    this.clearCache('products'); // Clear products cache
    this.clearCache('available_products'); // Clear available products cache
    this.clearCache('all_products'); // Clear all products cache
  }

  notifyProductDeleted(productId) {
    this.broadcast('productDeleted', { productId, timestamp: new Date() });
    this.clearCache('products'); // Clear products cache
    this.clearCache('available_products'); // Clear available products cache
    this.clearCache('all_products'); // Clear all products cache
  }

  notifyProductAvailabilityChanged(productId, isAvailable) {
    const eventData = { productId, isAvailable, timestamp: new Date() };
    this.broadcast('productAvailabilityChanged', eventData);
    this.clearCache('products'); // Clear products cache
    this.clearCache('available_products'); // Clear available products cache
    this.clearCache('all_products'); // Clear all products cache
  }

  // System events
  notifySystemMessage(message, type = 'info') {
    const eventData = { message, type, timestamp: new Date() };
    this.broadcast('systemMessage', eventData);
  }

  // Get connection statistics
  getStats() {
    const totalClients = this.connectedClients.size;
    const totalRooms = this.roomSubscriptions.size;
    const roomStats = {};
    
    this.roomSubscriptions.forEach((clients, room) => {
      roomStats[room] = clients.size;
    });

    // Debug: Log all connected clients
    console.log('🔍 EventManager Debug - Connected Clients:');
    this.connectedClients.forEach((client, socketId) => {
      console.log(`  - ${socketId}: ${client.user?.role || 'unknown'} (${client.rooms.size} rooms)`);
    });

    return {
      totalClients,
      totalRooms,
      roomStats,
      timestamp: new Date()
    };
  }

  // Health check
  isHealthy() {
    return this.io && this.connectedClients.size >= 0;
  }
}

module.exports = EventManager;
