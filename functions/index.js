/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// Helper function to verify Firebase Auth token
const verifyAuth = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No valid authorization header');
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Authentication endpoint
exports.login = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { username, password } = req.body;
      
      // Query Firestore for user
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('username', '==', username).limit(1).get();
      
      if (snapshot.empty) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      
      // For now, we'll use a simple password check
      // In production, you should use proper password hashing
      if (userData.password_hash === password) {
        // Create a custom token for Firebase Auth
        const customToken = await auth.createCustomToken(userDoc.id, {
          role: userData.role,
          username: userData.username
        });
        
        res.json({
          token: customToken,
          user: {
            id: userDoc.id,
            username: userData.username,
            role: userData.role
          }
        });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Get products endpoint
exports.getProducts = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const productsRef = db.collection('products');
      const snapshot = await productsRef.get();
      
      const products = [];
      snapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      res.json({ products });
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });
});

// Create order endpoint
exports.createOrder = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { customer_name, customer_id, order_type, items, total_amount } = req.body;
      
      // Create order in Firestore
      const orderRef = await db.collection('orders').add({
        customer_name,
        customer_id,
        order_type,
        status: 'pending',
        total_amount,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        items: []
      });
      
      // Add order items
      for (const item of items) {
        await orderRef.collection('items').add({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          prepared_quantity: 0,
          is_prepared: false
        });
      }
      
      // Get the complete order with items
      const orderDoc = await orderRef.get();
      const orderData = orderDoc.data();
      
      res.json({
        message: 'Order created successfully',
        order: {
          id: orderRef.id,
          ...orderData
        }
      });
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });
});

// Get orders endpoint
exports.getOrders = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { status } = req.query;
      
      let ordersRef = db.collection('orders');
      if (status && status !== 'all') {
        ordersRef = ordersRef.where('status', '==', status);
      }
      
      const snapshot = await ordersRef.orderBy('created_at', 'desc').get();
      
      const orders = [];
      for (const doc of snapshot.docs) {
        const orderData = doc.data();
        
        // Get order items
        const itemsSnapshot = await doc.ref.collection('items').get();
        const items = [];
        itemsSnapshot.forEach(itemDoc => {
          items.push({
            id: itemDoc.id,
            ...itemDoc.data()
          });
        });
        
        orders.push({
          id: doc.id,
          ...orderData,
          items
        });
      }
      
      res.json({ orders });
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });
});

// Update order status endpoint
exports.updateOrderStatus = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { orderId } = req.params;
      const { status } = req.body;
      
      await db.collection('orders').doc(orderId).update({
        status,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.json({ message: 'Order status updated successfully' });
    } catch (error) {
      console.error('Update order status error:', error);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });
});

// Update item preparation endpoint
exports.updateItemPreparation = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { orderId, itemId } = req.params;
      const { prepared_quantity } = req.body;
      
      await db.collection('orders').doc(orderId)
        .collection('items').doc(itemId).update({
          prepared_quantity,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      
      res.json({ message: 'Item preparation updated successfully' });
    } catch (error) {
      console.error('Update item preparation error:', error);
      res.status(500).json({ error: 'Failed to update item preparation' });
    }
  });
});

// Admin: Create/Update product endpoint
exports.adminProduct = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      // Verify admin role (you can add this later)
      
      if (req.method === 'POST') {
        // Create new product
        const { name, description, price, image_url, category } = req.body;
        
        const productRef = await db.collection('products').add({
          name,
          description,
          price: parseFloat(price),
          image_url,
          category,
          is_available: true,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({
          message: 'Product created successfully',
          product: { id: productRef.id, name, description, price, image_url, category }
        });
      } else if (req.method === 'PUT') {
        // Update existing product
        const { productId } = req.params;
        const updateData = req.body;
        
        if (updateData.price) {
          updateData.price = parseFloat(updateData.price);
        }
        
        updateData.updated_at = admin.firestore.FieldValue.serverTimestamp();
        
        await db.collection('products').doc(productId).update(updateData);
        
        res.json({ message: 'Product updated successfully' });
      }
    } catch (error) {
      console.error('Admin product error:', error);
      res.status(500).json({ error: 'Failed to process product' });
    }
  });
});

// Health check endpoint
exports.health = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    res.json({ status: 'OK', message: 'POS API is running' });
  });
});
