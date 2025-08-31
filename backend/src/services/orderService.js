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

      // Calculate total amount
      const totalAmount = orderData.items.reduce((sum, item) => {
        return sum + (item.unit_price * item.quantity);
      }, 0);

      // Create order document
      const orderDoc = {
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
      const orderId = orderRef.id;

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
      
      // Return complete order data
      return {
        id: orderId,
        ...orderDoc,
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

          orders.push({
            id: doc.id,
            ...orderData,
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

  // Get orders by status with chronological sorting and pagination
  async getOrdersByStatus(status, limit = 100, page = 1) {
    try {
      this.ensureInitialized();
      
      if (!status || status === 'all') {
        return this.getAllOrders(limit);
      }

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // First, get total count for pagination info
      const countQuery = this.ordersRef.where('status', '==', status);
      const countSnapshot = await countQuery.get();
      const total = countSnapshot.size;

      // Temporarily disabled orderBy to avoid index requirement while troubleshooting
      // TODO: Re-enable once the composite index is confirmed working:
      // const query = this.ordersRef
      //   .where('status', '==', status)
      //   .orderBy('created_at', 'asc') // Oldest first for FIFO
      //   .limit(limit)
      //   .offset(offset);
      
      const query = this.ordersRef
        .where('status', '==', status)
        .limit(limit);

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

          orders.push({
            id: doc.id,
            ...orderData,
            items
          });
        } catch (orderError) {
          console.error('❌ Error processing order:', doc.id, orderError);
          // Continue with other orders
        }
      }

      console.log(`✅ Retrieved ${orders.length} orders with status: ${status} (page ${page}, limit ${limit})`);
      return {
        orders,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
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

  // Helper method to enable sorting once index is confirmed working
  enableSorting() {
    console.log('🔄 Re-enabling order sorting...');
    // This method can be called to re-enable sorting features
    // after confirming the Firestore index is working properly
  }
}

module.exports = new OrderService();
