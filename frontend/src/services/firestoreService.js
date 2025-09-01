import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';

// Products Service
export const productsService = {
  // Get all products
  async getAllProducts() {
    try {
      console.log('🔍 Fetching products from Firestore...');
      const productsRef = collection(db, 'products');
      console.log('🔍 Products collection reference:', productsRef);
      
      const snapshot = await getDocs(productsRef);
      console.log('🔍 Firestore snapshot received:', snapshot);
      console.log('🔍 Snapshot size:', snapshot.size);
      
      const products = [];
      snapshot.forEach(doc => {
        const productData = doc.data();
        console.log('🔍 Product data:', doc.id, productData);
        products.push({
          id: doc.id,
          ...productData
        });
      });
      
      console.log('🔍 Total products fetched:', products.length);
      return products;
    } catch (error) {
      console.error('❌ Error fetching products:', error);
      console.error('❌ Error details:', error.message, error.code);
      throw error;
    }
  },

  // Get products by availability
  async getProductsByAvailability(isAvailable) {
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('is_available', '==', isAvailable));
      const snapshot = await getDocs(q);
      const products = [];
      snapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });
      return products;
    } catch (error) {
      console.error('Error fetching products by availability:', error);
      throw error;
    }
  },

  // Create new product
  async createProduct(productData) {
    try {
      const productsRef = collection(db, 'products');
      const docRef = await addDoc(productsRef, {
        ...productData,
        created_at: serverTimestamp()
      });
      return { id: docRef.id, ...productData };
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },

  // Update product
  async updateProduct(productId, updateData) {
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        ...updateData,
        updated_at: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  // Toggle product availability
  async toggleProductAvailability(productId, isAvailable) {
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        is_available: isAvailable,
        updated_at: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error toggling product availability:', error);
      throw error;
    }
  },

  // Delete product permanently
  async deleteProduct(productId) {
    try {
      console.log('🗑️ Deleting product with ID:', productId);
      const productRef = doc(db, 'products', productId);
      await deleteDoc(productRef);
      console.log('✅ Product deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting product:', error);
      throw error;
    }
  }
};

// Orders Service
export const ordersService = {
  // Get all orders
  async getAllOrders() {
    try {
      console.log('🔍 Fetching all orders from Firestore...');
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      console.log('🔍 Orders snapshot received:', snapshot.size, 'orders');
      
      const orders = [];
      
      for (const doc of snapshot.docs) {
        try {
          const orderData = doc.data();
          console.log('🔍 Processing order:', doc.id, orderData);
          
          // Get order items
          const itemsSnapshot = await getDocs(collection(doc.ref, 'items'));
          const items = [];
          itemsSnapshot.forEach(itemDoc => {
            items.push({
              id: itemDoc.id,
              ...itemDoc.data()
            });
          });
          
          console.log('🔍 Order items fetched:', items.length, 'items');
          
          orders.push({
            id: doc.id,
            ...orderData,
            items
          });
        } catch (orderError) {
          console.error('❌ Error processing order:', doc.id, orderError);
          // Continue with other orders even if one fails
          orders.push({
            id: doc.id,
            ...doc.data(),
            items: []
          });
        }
      }
      
      console.log('✅ Total orders processed:', orders.length);
      return orders;
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      console.error('❌ Error details:', error.message, error.code);
      throw error;
    }
  },

  // Get orders by status
  async getOrdersByStatus(status) {
    try {
      console.log('🔍 Fetching orders by status:', status);
      const ordersRef = collection(db, 'orders');
      
      // Temporarily remove orderBy to avoid index requirement while index is building
      let q;
      if (status === 'all') {
        q = query(ordersRef, orderBy('created_at', 'desc'));
      } else {
        q = query(ordersRef, where('status', '==', status));
        // Note: Removed orderBy temporarily to avoid index requirement
        // Will re-enable once the composite index is built
      }
      
      const snapshot = await getDocs(q);
      console.log('🔍 Orders snapshot received for status', status, ':', snapshot.size, 'orders');
      
      const orders = [];
      
      for (const doc of snapshot.docs) {
        try {
          const orderData = doc.data();
          console.log('🔍 Processing order:', doc.id, orderData);
          
          // Get order items
          const itemsSnapshot = await getDocs(collection(doc.ref, 'items'));
          const items = [];
          itemsSnapshot.forEach(itemDoc => {
            items.push({
              id: itemDoc.id,
              ...itemDoc.data()
            });
          });
          
          console.log('🔍 Order items fetched:', items.length, 'items');
          
          orders.push({
            id: doc.id,
            ...orderData,
            items
          });
        } catch (orderError) {
          console.error('❌ Error processing order:', doc.id, orderError);
          // Continue with other orders even if one fails
          orders.push({
            id: doc.id,
            ...doc.data(),
            items: []
          });
        }
      }
      
      console.log('✅ Total orders processed for status', status, ':', orders.length);
      return orders;
    } catch (error) {
      console.error('❌ Error fetching orders by status:', status, error);
      console.error('❌ Error details:', error.message, error.code);
      throw error;
    }
  },

  // Create new order
  async createOrder(orderData) {
    try {
      const ordersRef = collection(db, 'orders');
      const orderRef = await addDoc(ordersRef, {
        customer_name: orderData.customer_name,

        order_type: orderData.order_type,
        status: 'pending',
        total_amount: orderData.total_amount,
        created_at: serverTimestamp()
      });
      
      // Add order items
      for (const item of orderData.items) {
        await addDoc(collection(orderRef, 'items'), {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          prepared_quantity: 0,
          is_prepared: false,
          created_at: serverTimestamp()
        });
      }
      
      return { id: orderRef.id, ...orderData };
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  },

  // Update order status
  async updateOrderStatus(orderId, status) {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status,
        updated_at: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  },

  // Update item preparation
  async updateItemPreparation(orderId, itemId, preparedQuantity) {
    try {
      const itemRef = doc(db, 'orders', orderId, 'items', itemId);
      await updateDoc(itemRef, {
        prepared_quantity: preparedQuantity,
        updated_at: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating item preparation:', error);
      throw error;
    }
  }
};

// Real-time listeners
export const realtimeService = {
  // Listen to products changes
  onProductsChange(callback) {
    const productsRef = collection(db, 'products');
    return onSnapshot(productsRef, (snapshot) => {
      const products = [];
      snapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(products);
    });
  },

  // Listen to orders changes
  onOrdersChange(callback) {
    const ordersRef = collection(db, 'orders');
    
    // Temporarily remove orderBy to avoid index requirement while index is building
    // TODO: Re-enable once the composite index is built:
    // const q = query(ordersRef, orderBy('created_at', 'desc'));
    const q = query(ordersRef);
    
    return onSnapshot(q, async (snapshot) => {
      const orders = [];
      
      // Process all orders with their items in one go
      for (const doc of snapshot.docs) {
        try {
          const orderData = doc.data();
          
          // Fetch items for this order
          const itemsSnapshot = await getDocs(collection(doc.ref, 'items'));
          const items = [];
          itemsSnapshot.forEach(itemDoc => {
            items.push({
              id: itemDoc.id,
              ...itemDoc.data()
            });
          });
          
          // Add order with items
          orders.push({
            id: doc.id,
            ...orderData,
            items: items
          });
        } catch (error) {
          console.error('Error fetching items for order:', doc.id, error);
          // Add order without items if there's an error
          orders.push({
            id: doc.id,
            ...doc.data(),
            items: []
          });
        }
      }
      
      // Call callback only once with complete orders data
      callback(orders);
    });
  },

  // Listen to specific order items changes for real-time updates
  onOrderItemsChange(orderId, callback) {
    const itemsRef = collection(db, 'orders', orderId, 'items');
    return onSnapshot(itemsRef, (snapshot) => {
      const items = [];
      snapshot.forEach(doc => {
        items.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(items);
    });
  }
};
