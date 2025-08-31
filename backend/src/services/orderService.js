const { getFirestore } = require('../config/firebase');
const { validationResult } = require('express-validator');

class OrderService {
  constructor() {
    this.db = null;
    this.ordersRef = null;
    this.initialize();
  }

  initialize() {
    try {
      this.db = getFirestore();
      this.ordersRef = this.db.collection('orders');
    } catch (error) {
      console.warn('⚠️ Firebase not ready yet, will initialize when needed');
    }
  }

  // Generate a memorable order ID that's easy for customers to call out
  generateMemorableOrderId() {
    // Get current date components
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    
    // Generate a random 3-letter code (easy to remember)
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randomCode = '';
    for (let i = 0; i < 3; i++) {
      randomCode += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    
    // Format: DDMM-HHMM-XXX (e.g., 2512-1430-ABC)
    const orderId = `${day}${month}-${hour}${minute}-${randomCode}`;
    
    return orderId;
  }

  // Check if an order ID already exists (to avoid duplicates)
  async isOrderIdUnique(orderId) {
    try {
      this.ensureInitialized();
      const snapshot = await this.ordersRef.where('custom_order_id', '==', orderId).limit(1).get();
      return snapshot.empty;
    } catch (error) {
      console.error('❌ Error checking order ID uniqueness:', error);
      // If we can't check, assume it's unique to avoid blocking order creation
      return true;
    }
  }

  // Generate a unique memorable order ID
  async generateUniqueOrderId() {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const orderId = this.generateMemorableOrderId();
      const isUnique = await this.isOrderIdUnique(orderId);
      
      if (isUnique) {
        return orderId;
      }
      
      attempts++;
      // Wait a bit before trying again to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Fallback: use timestamp-based ID if we can't generate a unique memorable one
    console.warn('⚠️ Could not generate unique memorable order ID, using fallback');
    return `ORDER${Date.now()}`;
  }

  // Helper function to convert various date formats to ISO string
  convertDateToISO(dateValue) {
    try {
      if (!dateValue) return dateValue;
      
      // Handle Firestore Timestamp with toDate method
      if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate().toISOString();
      }
      // Handle Firestore Timestamp with seconds/nanoseconds
      else if (dateValue?.seconds && dateValue?.nanoseconds) {
        return new Date(dateValue.seconds * 1000).toISOString();
      }
      // Handle Date object
      else if (dateValue instanceof Date) {
        return dateValue.toISOString();
      }
      // Handle ISO string (already in correct format)
      else if (typeof dateValue === 'string' && dateValue.includes('T')) {
        return dateValue;
      }
      // Handle other string formats
      else if (typeof dateValue === 'string') {
        return new Date(dateValue).toISOString();
      }
      // Handle timestamp number
      else if (typeof dateValue === 'number') {
        return new Date(dateValue).toISOString();
      }
      // Unknown format
      else {
        console.warn('⚠️ Unknown date format:', dateValue, 'type:', typeof dateValue);
        return dateValue;
      }
    } catch (error) {
      console.error('❌ Error converting date to ISO:', error, 'value:', dateValue);
      return dateValue;
    }
  }

  ensureInitialized() {
    if (!this.db || !this.ordersRef) {
      this.initialize();
    }
    if (!this.db || !this.ordersRef) {
      throw new Error('Firebase not initialized');
    }
  }

  // Create new order with validation
  async createOrder(orderData) {
    try {
      this.ensureInitialized();
      
      // Validate order data
      if (!orderData.customer_name || !orderData.items || orderData.items.length === 0) {
        throw new Error('Invalid order data: customer name and items are required');
      }

      // Generate a memorable order ID
      const customOrderId = await this.generateUniqueOrderId();
      console.log('🎯 Generated memorable order ID:', customOrderId);

      // Calculate total amount
      const totalAmount = orderData.items.reduce((sum, item) => {
        return sum + (item.unit_price * item.quantity);
      }, 0);

      // Create order document
      const orderDoc = {
        custom_order_id: customOrderId, // Add the memorable order ID
        customer_name: orderData.customer_name,
        customer_id: orderData.customer_id || `CUST${Date.now()}`,
        order_type: orderData.order_type || 'takeaway',
        status: 'pending',
        total_amount: totalAmount,
        created_at: new Date(),
        updated_at: new Date(),
        items_count: orderData.items.length
      };

      // Add order to Firestore
      const orderRef = await this.ordersRef.add(orderDoc);
      const firestoreId = orderRef.id; // Keep Firestore's internal ID for database operations

      // Add order items
      const itemsRef = this.ordersRef.doc(orderId).collection('items');
      const itemPromises = orderData.items.map(async (item) => {
        const itemDoc = {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
          prepared_quantity: 0,
          is_prepared: false,
          created_at: new Date()
        };
        return itemsRef.add(itemDoc);
      });

      await Promise.all(itemPromises);

      console.log('✅ Order created successfully:', orderId);
      
      // Return complete order data with properly serialized dates
      const processedOrderDoc = {
        ...orderDoc,
        created_at: this.convertDateToISO(orderDoc.created_at),
        updated_at: this.convertDateToISO(orderDoc.updated_at)
      };

      return {
        id: firestoreId, // Firestore's internal ID for database operations
        custom_order_id: customOrderId, // Memorable order ID for customers
        ...processedOrderDoc,
        items: orderData.items
      };
    } catch (error) {
      console.error('❌ Error creating order:', error);
      throw error;
    }
  }

  // Get all orders with efficient pagination and sorting
  async getAllOrders(limit = 50, offset = 0, status = null) {
    try {
      this.ensureInitialized();
      
      let query = this.ordersRef;

      // Filter by status if provided
      if (status && status !== 'all') {
        query = query.where('status', '==', status);
      }

      // Temporarily disabled orderBy to avoid index requirement while troubleshooting
      // TODO: Re-enable once the composite index is confirmed working:
      // query = query.orderBy('created_at', 'desc');

      // Apply pagination
      if (limit) {
        query = query.limit(limit);
      }
      if (offset) {
        query = query.offset(offset);
      }

      const snapshot = await query.get();
      const orders = [];

      // Process orders with items
      for (const doc of snapshot.docs) {
        try {
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

          // Ensure dates are properly serialized
          const processedOrderData = {
            ...orderData,
            created_at: this.convertDateToISO(orderData.created_at),
            updated_at: this.convertDateToISO(orderData.updated_at)
          };

          orders.push({
            id: doc.id,
            ...processedOrderData,
            items
          });
        } catch (orderError) {
          console.error('❌ Error processing order:', doc.id, orderError);
          // Continue with other orders
        }
      }

      console.log(`✅ Retrieved ${orders.length} orders`);
      return orders;
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      throw error;
    }
  }

  // Get orders by status with true cursor-based pagination for performance
  async getOrdersByStatus(status, limit = 100, page = 1, lastDocId = null) {
    try {
      this.ensureInitialized();
      
      if (!status || status === 'all') {
        return this.getAllOrders(limit);
      }

      // First, get total count for pagination info (this is fast - just metadata)
      const countQuery = this.ordersRef.where('status', '==', status);
      const countSnapshot = await countQuery.get();
      const total = countSnapshot.size;

      // Build the base query
      let query = this.ordersRef
        .where('status', '==', status)
        .limit(limit);

      // Try to use cursor-based pagination if possible
      try {
        // Enable sorting for cursor pagination - DESCENDING for recent orders first
        query = query.orderBy('created_at', 'desc');
        
        // If we have a last document ID from previous page, use it as cursor
        if (lastDocId && page > 1) {
          try {
            const lastDocRef = this.ordersRef.doc(lastDocId);
            const lastDoc = await lastDocRef.get();
            
            if (lastDoc.exists) {
              query = query.startAfter(lastDoc);
              console.log(`🔄 Using cursor pagination: starting after document ${lastDocId}`);
            } else {
              console.log(`⚠️ Last document ${lastDocId} not found, falling back to first page`);
            }
          } catch (cursorError) {
            console.error('❌ Error with cursor pagination, falling back to first page:', cursorError);
          }
        }
      } catch (orderByError) {
        // If orderBy fails (index not ready), fall back to simple pagination
        console.log('⚠️ orderBy failed, falling back to simple pagination:', orderByError.message);
        query = this.ordersRef
          .where('status', '==', status)
          .limit(1000); // Fetch more than needed for fallback pagination
      }

      // Execute the query
      const snapshot = await query.get();
      const orders = [];

      // Process orders with items (only the ones we fetched)
      for (const doc of snapshot.docs) {
        try {
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

          // Ensure dates are properly serialized
          const processedOrderData = {
            ...orderData,
            created_at: this.convertDateToISO(orderData.created_at),
            updated_at: this.convertDateToISO(orderData.updated_at)
          };

          orders.push({
            id: doc.id,
            ...processedOrderData,
            items
          });
        } catch (orderError) {
          console.error('❌ Error processing order:', doc.id, orderError);
          // Continue with other orders
        }
      }

      // If we're using fallback pagination, sort by recent orders first and apply pagination
      if (orders.length > limit) {
        // Sort by creation time (newest first for recent orders)
        orders.sort((a, b) => {
          const timeA = a.created_at?.toDate?.() || new Date(a.created_at || 0);
          const timeB = b.created_at?.toDate?.() || new Date(b.created_at || 0);
          return timeB - timeA; // Descending: newest first
        });

        // Apply pagination by slicing the sorted array
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedOrders = orders.slice(startIndex, endIndex);
        
        console.log(`📄 Fallback pagination: showing orders ${startIndex + 1}-${endIndex} from ${orders.length} total`);
        orders.splice(0, orders.length, ...paginatedOrders);
      }





      // Get the last document ID for next page cursor
      const lastDocumentId = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null;

      console.log(`✅ Retrieved ${orders.length} orders with status: ${status} (page ${page}, limit ${limit}) from total ${total}`);
      console.log(`📄 Last document ID for next page: ${lastDocumentId}`);
      
      return {
        orders,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        lastDocumentId, // Pass this to frontend for next page
        hasNextPage: snapshot.docs.length === limit // Check if there are more pages
      };
    } catch (error) {
      console.error('❌ Error fetching orders by status:', error);
      throw error;
    }
  }

  // Update order status
  async updateOrderStatus(orderId, status, userId = null) {
    try {
      this.ensureInitialized();
      
      const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
      
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
      }

      const orderRef = this.ordersRef.doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        throw new Error(`Order not found: ${orderId}`);
      }

      const updateData = {
        status,
        updated_at: new Date()
      };

      if (userId) {
        updateData.updated_by = userId;
      }

      await orderRef.update(updateData);

      console.log(`✅ Order ${orderId} status updated to: ${status}`);
      
      // Return updated order
      const updatedOrder = await orderRef.get();
      return {
        id: updatedOrder.id,
        ...updatedOrder.data()
      };
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      throw error;
    }
  }

  // Update item preparation
  async updateItemPreparation(orderId, itemId, preparedQuantity) {
    try {
      this.ensureInitialized();
      
      if (preparedQuantity < 0) {
        throw new Error('Prepared quantity cannot be negative');
      }

      const itemRef = this.ordersRef.doc(orderId).collection('items').doc(itemId);
      const itemDoc = await itemRef.get();

      if (!itemDoc.exists) {
        throw new Error(`Order item not found: ${itemId}`);
      }

      const itemData = itemDoc.data();
      const totalQuantity = itemData.quantity;
      
      if (preparedQuantity > totalQuantity) {
        throw new Error(`Prepared quantity (${preparedQuantity}) cannot exceed total quantity (${totalQuantity})`);
      }

      const isPrepared = preparedQuantity === totalQuantity;

      await itemRef.update({
        prepared_quantity: preparedQuantity,
        is_prepared: isPrepared,
        updated_at: new Date()
      });

      console.log(`✅ Item ${itemId} preparation updated: ${preparedQuantity}/${totalQuantity}`);
      
      return {
        id: itemId,
        prepared_quantity: preparedQuantity,
        is_prepared: isPrepared,
        total_quantity: totalQuantity
      };
    } catch (error) {
      console.error('❌ Error updating item preparation:', error);
      throw error;
    }
  }

  // Get order statistics
  async getOrderStats() {
    try {
      this.ensureInitialized();
      
      const stats = {
        total: 0,
        pending: 0,
        preparing: 0,
        ready: 0,
        delivered: 0,
        cancelled: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0
      };

      // Get counts by status
      const statuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
      
      for (const status of statuses) {
        const snapshot = await this.ordersRef.where('status', '==', status).get();
        stats[status] = snapshot.size;
        stats.total += snapshot.size;
      }

      // Get today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySnapshot = await this.ordersRef
        .where('created_at', '>=', today)
        .get();
      stats.today = todaySnapshot.size;

      console.log('✅ Order statistics retrieved');
      return stats;
    } catch (error) {
      console.error('❌ Error fetching order statistics:', error);
      throw error;
    }
  }

  // Delete order (admin only)
  async deleteOrder(orderId) {
    try {
      this.ensureInitialized();
      
      const orderRef = this.ordersRef.doc(orderId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Delete order items first
      const itemsSnapshot = await orderRef.collection('items').get();
      const deletePromises = itemsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);

      // Delete order
      await orderRef.delete();

      console.log(`✅ Order ${orderId} deleted successfully`);
      return { success: true, orderId };
    } catch (error) {
      console.error('❌ Error deleting order:', error);
      throw error;
    }
  }

  // Search orders by status and search term across all pages
  async searchOrders(status, searchTerm) {
    try {
      this.ensureInitialized();
      
      console.log(`🔍 Searching orders with status: ${status}, term: "${searchTerm}"`);
      
      // Build the base query for the specific status
      let query = this.ordersRef.where('status', '==', status);
      
      // Execute the query to get all orders with this status
      const snapshot = await query.get();
      const allOrders = [];
      
      // Process all orders with items
      for (const doc of snapshot.docs) {
        try {
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

          // Ensure dates are properly serialized
          const processedOrderData = {
            ...orderData,
            created_at: this.convertDateToISO(orderData.created_at),
            updated_at: this.convertDateToISO(orderData.updated_at)
          };

          allOrders.push({
            id: doc.id,
            ...processedOrderData,
            items
          });
        } catch (orderError) {
          console.error('❌ Error processing order:', doc.id, orderError);
          // Continue with other orders
        }
      }
      
      // Filter orders by search term (case-insensitive)
      const searchLower = searchTerm.toLowerCase();
      console.log(`🔍 Filtering ${allOrders.length} orders with search term: "${searchLower}"`);
      
      const filteredOrders = allOrders.filter(order => {
        // Check if order has required fields
        if (!order.customer_name || !order.id || !order.customer_id || !order.items) {
          console.log(`⚠️ Order ${order.id} missing required fields, skipping`);
          return false;
        }
        
        // Check customer name
        const customerNameMatch = order.customer_name.toLowerCase().includes(searchLower);
        
        // Check order ID
        const orderIdMatch = order.id.toLowerCase().includes(searchLower);
        
        // Check custom order ID (memorable ID)
        const customOrderIdMatch = order.custom_order_id && order.custom_order_id.toLowerCase().includes(searchLower);
        
        // Check customer ID
        const customerIdMatch = order.customer_id.toLowerCase().includes(searchLower);
        
        // Check product names in items
        const productMatch = order.items.some(item => 
          item.product_name && item.product_name.toLowerCase().includes(searchLower)
        );
        
        const isMatch = customerNameMatch || orderIdMatch || customOrderIdMatch || customerIdMatch || productMatch;
        
        if (isMatch) {
          console.log(`✅ Order ${order.id} matches search:`, {
            customerName: order.customer_name,
            orderId: order.id,
            customOrderId: order.custom_order_id,
            customerId: order.customer_id,
            productNames: order.items.map(item => item.product_name)
          });
        }
        
        return isMatch;
      });
      
      // Sort by creation time (newest first)
      filteredOrders.sort((a, b) => {
        const timeA = a.created_at?.toDate?.() || new Date(a.created_at || 0);
        const timeB = b.created_at?.toDate?.() || new Date(b.created_at || 0);
        return timeB - timeA; // Descending: newest first
      });
      
      console.log(`🔍 Search completed: ${filteredOrders.length} orders found out of ${allOrders.length} total`);
      console.log(`🔍 Search term: "${searchTerm}"`);
      
      return {
        orders: filteredOrders,
        total: filteredOrders.length,
        searchTerm
      };
    } catch (error) {
      console.error('❌ Error searching orders:', error);
      throw error;
    }
  }

  // Helper method to enable sorting once index is confirmed working
  enableSorting() {
    console.log('🔄 Re-enabling order sorting...');
    // This method can be called to re-enable sorting features
    // after confirming the Firestore index is working properly
  }
}

module.exports = new OrderService();
