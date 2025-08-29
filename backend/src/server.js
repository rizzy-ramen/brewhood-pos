const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

// Import configurations and services
const { initializeFirebase } = require('./config/firebase');
const { createRateLimiter } = require('./middleware/auth');

// Import routes
const orderRoutes = require('./routes/orders');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'https://brewhood-pos.web.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Make io available to routes
app.set('io', io);

// Initialize Firebase Admin SDK
initializeFirebase();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// CORS middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'https://brewhood-pos.web.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting
const globalRateLimit = createRateLimiter(
  process.env.RATE_LIMIT_WINDOW_MS || 900000, // 15 minutes
  process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  'Too many requests from this IP. Please try again later.'
);
app.use(globalRateLimit);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/orders', orderRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
    availableRoutes: [
      'GET /health',
      'POST /api/orders',
      'GET /api/orders',
      'GET /api/orders/status/:status',
      'GET /api/orders/:orderId',
      'PATCH /api/orders/:orderId/status',
      'PATCH /api/orders/:orderId/items/:itemId/preparation',
      'GET /api/orders/stats/overview',
      'DELETE /api/orders/:orderId'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global error handler:', error);
  
  // Don't leak error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.status(error.status || 500).json({
    error: 'Internal server error',
    message: isProduction ? 'Something went wrong' : error.message,
    ...(isProduction ? {} : { stack: error.stack })
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  
  // Join room based on user role
  socket.on('joinRoom', (room) => {
    socket.join(room);
    console.log(`👥 Client ${socket.id} joined room: ${room}`);
  });
  
  // Handle order placement
  socket.on('orderPlaced', (order) => {
    console.log('📦 Order placed via socket:', order.id);
    // Broadcast to all clients
    socket.broadcast.emit('orderPlaced', order);
  });
  
  // Handle order status updates
  socket.on('orderStatusUpdated', (data) => {
    console.log('🔄 Order status updated via socket:', data.orderId, data.status);
    // Broadcast to all clients
    socket.broadcast.emit('orderStatusUpdated', data);
  });
  
  // Handle item preparation updates
  socket.on('itemPreparationUpdated', (data) => {
    console.log('🍽️ Item preparation updated via socket:', data.orderId, data.itemId);
    // Broadcast to all clients
    socket.broadcast.emit('itemPreparationUpdated', data);
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('🔌 Client disconnected:', socket.id, 'Reason:', reason);
  });
  
  // Handle errors
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 POS Backend Server started successfully!');
  console.log('📡 Server running on port:', PORT);
  console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
  console.log('🔥 Firebase Project:', process.env.FIREBASE_PROJECT_ID);
  console.log('🔌 Socket.io enabled for real-time updates');
  console.log('📊 API endpoints available at: http://localhost:' + PORT + '/api');
  console.log('❤️  Health check: http://localhost:' + PORT + '/health');
});

module.exports = { app, server, io };
