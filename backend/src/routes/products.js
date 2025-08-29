const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getFirestore } = require('../config/firebase');

const router = express.Router();

// Helper function to get Firestore instance when needed
const getDb = () => {
  try {
    return getFirestore();
  } catch (error) {
    console.error('❌ Firebase not ready yet:', error.message);
    throw new Error('Firebase not initialized');
  }
};

// Validation middleware
const validateProduct = [
  body('name').trim().isLength({ min: 1 }).withMessage('Product name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('image_url').optional().trim().isURL().withMessage('Image URL must be valid'),
  body('is_available').optional().isBoolean().withMessage('is_available must be boolean')
];

// GET /api/products - Get all products
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const productsRef = db.collection('products');
    const snapshot = await productsRef.get();
    
    const products = [];
    snapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch products'
    });
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const productRef = db.collection('products').doc(id);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }
    
    const product = {
      id: productDoc.id,
      ...productDoc.data()
    };
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch product'
    });
  }
});

// POST /api/products - Create new product
router.post('/', authenticateToken, requireRole(['admin']), validateProduct, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid product data',
        details: errors.array()
      });
    }
    
    const db = getDb();
    const productData = {
      ...req.body,
      created_at: new Date(),
      updated_at: new Date(),
      is_available: req.body.is_available !== undefined ? req.body.is_available : true
    };
    
    const productRef = await db.collection('products').add(productData);
    
    const createdProduct = {
      id: productRef.id,
      ...productData
    };
    
    // Emit real-time update via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('product:created', createdProduct);
    }
    
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create product'
    });
  }
});

// PATCH /api/products/:id - Update product
router.patch('/:id', authenticateToken, requireRole(['admin']), validateProduct, async (req, res) => {
  try {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid product data',
        details: errors.array()
      });
    }
    
    const db = getDb();
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };
    
    const productRef = db.collection('products').doc(id);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }
    
    await productRef.update(updateData);
    
    const updatedProduct = {
      id,
      ...productDoc.data(),
      ...updateData
    };
    
    // Emit real-time update via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('product:updated', updatedProduct);
    }
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update product'
    });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const productRef = db.collection('products').doc(id);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }
    
    await productRef.delete();
    
    // Emit real-time update via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('product:deleted', { id });
    }
    
    res.json({
      message: 'Product deleted successfully',
      deletedProductId: id
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete product'
    });
  }
});

// PATCH /api/products/:id/availability - Toggle product availability
router.patch('/:id/availability', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_available } = req.body;
    
    if (typeof is_available !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid data',
        message: 'is_available must be a boolean value'
      });
    }
    
    const db = getDb();
    const productRef = db.collection('products').doc(id);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }
    
    const updateData = {
      is_available,
      updated_at: new Date()
    };
    
    await productRef.update(updateData);
    
    const updatedProduct = {
      id,
      ...productDoc.data(),
      ...updateData
    };
    
    // Emit real-time update via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('product:availability_updated', updatedProduct);
    }
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product availability:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update product availability'
    });
  }
});

module.exports = router;
