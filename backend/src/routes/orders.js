const express = require('express');
const { body, param, query } = require('express-validator');
const orderService = require('../services/orderService');
const { authenticateToken, requireRole, createRateLimiter } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for order endpoints
const orderRateLimit = createRateLimiter(
  process.env.RATE_LIMIT_WINDOW_MS || 900000, // 15 minutes
  process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  'Too many order requests. Please try again later.'
);

// Validation middleware
const validateOrderData = [
  body('customer_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Customer name is required and must be less than 100 characters'),
  
  body('order_type')
    .optional()
    .isIn(['takeaway', 'dine-in', 'delivery'])
    .withMessage('Order type must be takeaway, dine-in, or delivery'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  
  body('items.*.product_id')
    .notEmpty()
    .withMessage('Product ID is required for each item'),
  
  body('items.*.product_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Product name is required for each item'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  
  body('items.*.unit_price')
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number')
];

const validateOrderId = [
  param('orderId')
    .isString()
    .notEmpty()
    .withMessage('Valid order ID is required')
];

const validateStatus = [
  body('status')
    .isIn(['pending', 'preparing', 'ready', 'delivered', 'cancelled'])
    .withMessage('Status must be one of: pending, preparing, ready, delivered, cancelled')
];

// Create new order
router.post('/',
  orderRateLimit,
  authenticateToken,
  requireRole(['counter', 'admin']),
  validateOrderData,
  async (req, res) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const orderData = {
        ...req.body,
        created_by: req.user.id
      };

      const order = await orderService.createOrder(orderData);

      // Emit real-time update via Socket.io
      req.app.get('io').emit('orderPlaced', order);

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        order
      });
    } catch (error) {
      console.error('❌ Error creating order:', error);
      res.status(500).json({
        error: 'Failed to create order',
        message: error.message
      });
    }
  }
);

// Get all orders (with pagination and filtering)
router.get('/',
  orderRateLimit,
  authenticateToken,
  requireRole(['admin', 'counter', 'delivery']),
  [
    query('status')
      .optional()
      .isIn(['all', 'pending', 'preparing', 'ready', 'delivered', 'cancelled'])
      .withMessage('Invalid status filter'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],
  async (req, res) => {
    try {
      const { status, limit, offset } = req.query;
      
      let orders;
      if (status && status !== 'all') {
        orders = await orderService.getOrdersByStatus(status, parseInt(limit) || 100);
      } else {
        orders = await orderService.getAllOrders(
          parseInt(limit) || 50,
          parseInt(offset) || 0,
          status
        );
      }

      res.json({
        success: true,
        count: orders.length,
        orders
      });
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      res.status(500).json({
        error: 'Failed to fetch orders',
        message: error.message
      });
    }
  }
);

// Get orders by status
router.get('/status/:status',
  orderRateLimit,
  authenticateToken,
  requireRole(['admin', 'counter', 'delivery']),
  [
    param('status')
      .isIn(['pending', 'preparing', 'ready', 'delivered', 'cancelled'])
      .withMessage('Invalid status')
  ],
  async (req, res) => {
    try {
      const { status } = req.params;
      const { limit } = req.query;
      
      const orders = await orderService.getOrdersByStatus(status, parseInt(limit) || 100);

      res.json({
        success: true,
        status,
        count: orders.length,
        orders
      });
    } catch (error) {
      console.error('❌ Error fetching orders by status:', error);
      res.status(500).json({
        error: 'Failed to fetch orders by status',
        message: error.message
      });
    }
  }
);

// Get specific order by ID
router.get('/:orderId',
  orderRateLimit,
  authenticateToken,
  requireRole(['admin', 'counter', 'delivery']),
  validateOrderId,
  async (req, res) => {
    try {
      const { orderId } = req.params;
      
      // Get order with items
      const orders = await orderService.getOrdersByStatus('all', 1000);
      const order = orders.find(o => o.id === orderId);
      
      if (!order) {
        return res.status(404).json({
          error: 'Order not found',
          message: `Order with ID ${orderId} does not exist`
        });
      }

      res.json({
        success: true,
        order
      });
    } catch (error) {
      console.error('❌ Error fetching order:', error);
      res.status(500).json({
        error: 'Failed to fetch order',
        message: error.message
      });
    }
  }
);

// Update order status
router.patch('/:orderId/status',
  orderRateLimit,
  authenticateToken,
  requireRole(['admin', 'delivery']),
  [...validateOrderId, ...validateStatus],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { orderId } = req.params;
      const { status } = req.body;
      
      const updatedOrder = await orderService.updateOrderStatus(orderId, status, req.user.id);

      // Emit real-time update via Socket.io
      req.app.get('io').emit('orderStatusUpdated', {
        orderId,
        status,
        updatedOrder
      });

      res.json({
        success: true,
        message: `Order status updated to ${status}`,
        order: updatedOrder
      });
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      res.status(500).json({
        error: 'Failed to update order status',
        message: error.message
      });
    }
  }
);

// Update item preparation
router.patch('/:orderId/items/:itemId/preparation',
  orderRateLimit,
  authenticateToken,
  requireRole(['admin', 'delivery']),
  [
    ...validateOrderId,
    param('itemId')
      .isString()
      .notEmpty()
      .withMessage('Valid item ID is required'),
    
    body('prepared_quantity')
      .isInt({ min: 0 })
      .withMessage('Prepared quantity must be a non-negative integer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { orderId, itemId } = req.params;
      const { prepared_quantity } = req.body;
      
      const result = await orderService.updateItemPreparation(orderId, itemId, prepared_quantity);

      // Emit real-time update via Socket.io
      req.app.get('io').emit('itemPreparationUpdated', {
        orderId,
        itemId,
        ...result
      });

      res.json({
        success: true,
        message: 'Item preparation updated successfully',
        ...result
      });
    } catch (error) {
      console.error('❌ Error updating item preparation:', error);
      res.status(500).json({
        error: 'Failed to update item preparation',
        message: error.message
      });
    }
  }
);

// Get order statistics
router.get('/stats/overview',
  orderRateLimit,
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const stats = await orderService.getOrderStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('❌ Error fetching order statistics:', error);
      res.status(500).json({
        error: 'Failed to fetch order statistics',
        message: error.message
      });
    }
  }
);

// Delete order (admin only)
router.delete('/:orderId',
  orderRateLimit,
  authenticateToken,
  requireRole(['admin']),
  validateOrderId,
  async (req, res) => {
    try {
      const { orderId } = req.params;
      
      const result = await orderService.deleteOrder(orderId);

      // Emit real-time update via Socket.io
      req.app.get('io').emit('orderDeleted', { orderId });

      res.json({
        success: true,
        message: 'Order deleted successfully',
        ...result
      });
    } catch (error) {
      console.error('❌ Error deleting order:', error);
      res.status(500).json({
        error: 'Failed to delete order',
        message: error.message
      });
    }
  }
);

module.exports = router;
