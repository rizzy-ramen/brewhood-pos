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

// Validation middleware for creating products (requires all fields)
const validateProductCreate = [
  body('name').trim().isLength({ min: 1 }).withMessage('Product name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('image_url').optional().trim().isURL().withMessage('Image URL must be valid'),
  body('is_available').optional().isBoolean().withMessage('is_available must be boolean')
];

// Validation middleware for updating products (all fields optional)
const validateProductUpdate = [
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Product name must not be empty if provided'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number if provided'),
  body('category').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('image_url').optional().trim().isURL().withMessage('Image URL must be valid if provided'),
  body('is_available').optional().isBoolean().withMessage('is_available must be boolean if provided')
];

// GET /api/products - Get only AVAILABLE products (for counter app)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const eventManager = req.app.get('eventManager');
    
    // Use smart caching to minimize Firestore calls
    const products = await eventManager.getCachedData('available_products', async () => {
      try {
        const db = getDb();
        const productsRef = db.collection('products');
        const snapshot = await productsRef.get();
        
        const products = [];
        snapshot.forEach(doc => {
          const productData = doc.data();
          // Only include available products for counter app
          if (productData.is_available !== false) {
            products.push({
              id: doc.id,
              ...productData
            });
          }
        });
        
        console.log(`📦 Fetched ${products.length} AVAILABLE products from Firestore (filtered out hidden products)`);
        return products;
      } catch (firebaseError) {
        // If Firebase fails (e.g., quota exceeded), return mock data
        console.warn('⚠️ Firebase access failed, returning mock products:', firebaseError.message);
        
        const mockProducts = [
          {
            id: 'mock-1',
            name: 'Iced Tea',
            description: 'Refreshing iced tea with a hint of lemon',
            price: 89,
            category: 'Beverage',
            image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',
            is_available: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'mock-2',
            name: 'Hot Chocolate',
            description: 'Rich and creamy hot chocolate',
            price: 100,
            category: 'Beverage',
            image_url: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400',
            is_available: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'mock-3',
            name: 'Lemon Mint Cooler',
            description: 'Fresh lemon mint cooler with ice',
            price: 60,
            category: 'Beverage',
            image_url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400',
            is_available: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'mock-4',
            name: 'Cappuccino',
            description: 'Classic Italian cappuccino with foamed milk',
            price: 120,
            category: 'Coffee',
            image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400',
            is_available: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'mock-5',
            name: 'Espresso',
            description: 'Strong single shot of espresso',
            price: 80,
            category: 'Coffee',
            image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400',
            is_available: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ];
        
        return mockProducts;
      }
    }, 300000); // Cache for 5 minutes
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching available products:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch available products'
    });
  }
});

// GET /api/products/all - Get ALL products (including hidden) for admin
router.get('/all', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const eventManager = req.app.get('eventManager');
    
    // Use smart caching to minimize Firestore calls
    const products = await eventManager.getCachedData('all_products', async () => {
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
        
        console.log(`📦 Fetched ${products.length} ALL products from Firestore (including hidden)`);
        return products;
      } catch (firebaseError) {
        // If Firebase fails (e.g., quota exceeded), return mock data
        console.warn('⚠️ Firebase access failed, returning mock products:', firebaseError.message);
        
        const mockProducts = [
          {
            id: 'mock-1',
            name: 'Iced Tea',
            description: 'Refreshing iced tea with a hint of lemon',
            price: 89,
            category: 'Beverage',
            image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',
            is_available: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'mock-2',
            name: 'Hot Chocolate',
            description: 'Rich and creamy hot chocolate',
            price: 100,
            category: 'Beverage',
            image_url: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400',
            is_available: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'mock-3',
            name: 'Lemon Mint Cooler',
            description: 'Fresh lemon mint cooler with ice',
            price: 60,
            category: 'Beverage',
            image_url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400',
            is_available: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'mock-4',
            name: 'Cappuccino',
            description: 'Classic Italian cappuccino with foamed milk',
            price: 120,
            category: 'Coffee',
            image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400',
            is_available: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'mock-5',
            name: 'Espresso',
            description: 'Strong single shot of espresso',
            price: 80,
            category: 'Coffee',
            image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400',
            is_available: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ];
        
        return mockProducts;
      }
    }, 300000); // Cache for 5 minutes
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching all products:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch all products'
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
router.post('/', authenticateToken, requireRole(['admin']), validateProductCreate, async (req, res) => {
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
    
    // Notify all clients via Event Manager (real-time update)
    const eventManager = req.app.get('eventManager');
    if (eventManager) {
      eventManager.notifyProductCreated(createdProduct);
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
router.patch('/:id', authenticateToken, requireRole(['admin']), validateProductUpdate, async (req, res) => {
  try {
    const { id } = req.params;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ Product update validation failed:', errors.array());
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid product data',
        details: errors.array()
      });
    }
    
    console.log(`🔄 Updating product ${id} with data:`, req.body);
    
    const db = getDb();
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };
    
    const productRef = db.collection('products').doc(id);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      console.error(`❌ Product ${id} not found`);
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }
    
    console.log(`✅ Product ${id} found, updating with:`, updateData);
    await productRef.update(updateData);
    
    const updatedProduct = {
      id,
      ...productDoc.data(),
      ...updateData
    };
    
    console.log(`✅ Product ${id} updated successfully:`, updatedProduct);
    
    // Notify all clients via Event Manager (real-time update)
    const eventManager = req.app.get('eventManager');
    if (eventManager) {
      eventManager.notifyProductUpdated(updatedProduct);
      console.log(`📡 Product update notification sent via Event Manager`);
    }
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('❌ Error updating product:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      productId: req.params.id,
      updateData: req.body
    });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update product',
      details: error.message
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
    
    // Notify all clients via Event Manager (real-time update)
    const eventManager = req.app.get('eventManager');
    if (eventManager) {
      eventManager.notifyProductDeleted(id);
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
    
    console.log(`🔄 Toggling availability for product ${id} to:`, is_available);
    console.log(`🔄 Request body:`, req.body);
    
    if (typeof is_available !== 'boolean') {
      console.error(`❌ Invalid is_available type: ${typeof is_available}, value: ${is_available}`);
      return res.status(400).json({
        error: 'Invalid data',
        message: 'is_available must be a boolean value',
        received: { type: typeof is_available, value: is_available }
      });
    }
    
    const db = getDb();
    const productRef = db.collection('products').doc(id);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      console.error(`❌ Product ${id} not found`);
      return res.status(404).json({
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }
    
    const currentProduct = productDoc.data();
    console.log(`✅ Product ${id} found:`, currentProduct.name, 'Current availability:', currentProduct.is_available);
    
    const updateData = {
      is_available,
      updated_at: new Date()
    };
    
    console.log(`🔄 Updating product ${id} with:`, updateData);
    await productRef.update(updateData);
    
    const updatedProduct = {
      id,
      ...currentProduct,
      ...updateData
    };
    
    console.log(`✅ Product ${id} availability updated successfully:`, updatedProduct);
    
    // Notify all clients via Event Manager (real-time update)
    const eventManager = req.app.get('eventManager');
    if (eventManager) {
      eventManager.notifyProductAvailabilityChanged(id, is_available);
      console.log(`📡 Product availability change notification sent via Event Manager`);
    }
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('❌ Error updating product availability:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      productId: req.params.id,
      requestBody: req.body
    });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update product availability',
      details: error.message
    });
  }
});

module.exports = router;
