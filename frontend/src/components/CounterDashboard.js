import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Minus, X, Package, Edit, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import websocketService from '../services/websocketService';
import LoadingScreen from './LoadingScreen';

// Import reusable components
import HamburgerMenu from './HamburgerMenu';
import OrdersStatusTable from './OrdersStatusTable';

const CounterDashboard = ({ user, onLogout }) => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    contact_number: '',
    order_type: 'takeaway'
  });
  const [loading, setLoading] = useState(true);
  const [minLoadingComplete, setMinLoadingComplete] = useState(false);
  
  // State for managing views
  const [currentView, setCurrentView] = useState('take-orders'); // 'take-orders' or 'all-orders'

  // Notification system state
  const [notifications, setNotifications] = useState([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Order counter for generating sequential order numbers
  const [orderCounter, setOrderCounter] = useState(0); // Will be set from backend

  // Set minimum loading time for better UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingComplete(true);
    }, 3000); // Show loading screen for at least 3 seconds

    return () => clearTimeout(timer);
  }, []);

  // Sync order counter with backend
  useEffect(() => {
    const syncOrderCounter = async () => {
      try {
        // Fetch recent orders to get the latest order number
        const response = await apiService.getOrders('all', 1); // Get just 1 recent order
        if (response && response.orders && response.orders.length > 0) {
          const latestOrder = response.orders[0];
          if (latestOrder.order_number) {
            setOrderCounter(latestOrder.order_number + 1); // Set counter to next number
            console.log('✅ Synced order counter with backend:', latestOrder.order_number + 1);
          }
        }
      } catch (error) {
        console.log('⚠️ Could not sync order counter, using default:', error);
        setOrderCounter(11); // Fallback to 11
      }
    };

    syncOrderCounter();
  }, []);

  // Function to fetch products from backend
  const fetchProducts = async () => {
    try {
      const products = await apiService.getProducts();
      console.log('Fetched products from backend:', products);
      setProducts(products);
    } catch (error) {
      console.error('Failed to fetch products from backend:', error);
      toast.error('Failed to fetch products from backend');
      // Fallback to mock data if backend fails
      setProducts([
        { id: '1', name: 'Iced Tea', price: 89, description: 'Refreshing iced tea', image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400' },
        { id: '2', name: 'Hot Chocolate', price: 100, description: 'Rich hot chocolate', image_url: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400' },
        { id: '3', name: 'Lemon Mint Cooler', price: 60, description: 'Fresh lemon mint cooler', image_url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400' }
        ]);
    } finally {
      setLoading(false);
    }
  };

  // Initialize with products from backend API
  useEffect(() => {
    fetchProducts();
  }, []);

  // Notification system functions
  const addNotification = (type, title, message, productName = null) => {
    const newNotification = {
      id: Date.now(),
      type, // 'success', 'warning', 'info', 'error'
      title,
      message,
      productName,
      timestamp: new Date(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // No auto-removal - notifications stay until manually attended
    console.log('🔔 Notification added:', { type, title, message });
  };

  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearNotification = (notificationId) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      return prev.filter(n => n.id !== notificationId);
    });
  };

  // WebSocket integration for real-time product updates
  useEffect(() => {
    console.log('🔌 Setting up WebSocket connection for CounterDashboard...');
    
    // Connect to WebSocket
    websocketService.connect();
    
    // Check connection status
    const connectionStatus = websocketService.getConnectionStatus();
    console.log('🔌 WebSocket connection status:', connectionStatus);
    
    // Add connection status listener
    const handleStatusChange = (status) => {
      console.log('🔌 WebSocket status changed:', status);
    };
    
    websocketService.on('statusChange', handleStatusChange);
    
    // Wait a bit for connection to establish, then check status again
    const checkConnection = setTimeout(() => {
      const status = websocketService.getConnectionStatus();
      console.log('🔌 WebSocket connection status after delay:', status);
      
      if (!status.isConnected) {
        console.warn('⚠️ WebSocket not connected after delay, trying to reconnect...');
        websocketService.connect();
      }
    }, 2000);

    // Listen for product availability changes
    websocketService.on('productAvailabilityChanged', (data) => {
      console.log('🔄 CounterDashboard: Product availability changed event received:', data);
      const { productId, isAvailable } = data;
      
      // Add notification first
      if (isAvailable) {
        console.log('✅ Adding success notification for product enabled');
        addNotification(
          'success',
          'Product Enabled',
          `A product is now available for orders`,
          null
        );
      } else {
        console.log('⚠️ Adding warning notification for product disabled');
        addNotification(
          'warning',
          'Product Disabled',
          `A product has been hidden and is no longer available`,
          null
        );
      }
      
      // Update products list based on availability change
      setProducts(prevProducts => {
        if (isAvailable) {
          // Product was enabled - need to refresh to get the product details
          console.log('🔄 Product enabled, refreshing products list');
          fetchProducts();
          return prevProducts;
        } else {
          // Product was disabled - remove it from the list
          console.log('🔄 Product disabled, removing from products list');
          return prevProducts.filter(p => p.id !== productId);
        }
      });
    });

    // Listen for product updates (general changes)
    websocketService.on('productUpdated', (product) => {
      console.log('🔄 CounterDashboard: Product updated event received:', product);
      
      // Add notification
      console.log('ℹ️ Adding info notification for product updated');
      addNotification(
        'info',
        'Product Updated',
        `${product.name} has been modified by admin`,
        product.name
      );
      
      // Refresh products to get the latest state
      console.log('🔄 Refreshing products list after update');
      fetchProducts();
    });

    // Listen for new products
    websocketService.on('productCreated', (product) => {
      console.log('🆕 New product created:', product);
      
      // Add notification
      addNotification(
        'success',
        'New Product Added',
        `${product.name} is now available for orders`,
        product.name
      );
      
      // Only add if it's available
      if (product.is_available !== false) {
        setProducts(prevProducts => [...prevProducts, product]);
      }
    });

    // Listen for product deletions
    websocketService.on('productDeleted', (data) => {
      console.log('🗑️ Product deleted:', data);
      const { productId } = data;
      
      // Add notification
      addNotification(
        'error',
        'Product Removed',
        `A product has been permanently removed`,
        null
      );
      
      // Remove the deleted product
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
    });

    // Cleanup WebSocket listeners
    return () => {
      console.log('🔌 Cleaning up WebSocket listeners for CounterDashboard...');
      websocketService.off('productAvailabilityChanged');
      websocketService.off('productUpdated');
      websocketService.off('productCreated');
      websocketService.off('productDeleted');
      websocketService.off('statusChange', handleStatusChange);
      clearTimeout(checkConnection);
    };
  }, []); // Removed products dependency

  // Function to get proper image URL or fallback
  const getImageUrl = (product) => {
    if (product.image_url) {
      return product.image_url;
    }
    return '🍽️'; // Fallback emoji
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1
      }]);
    }
  };

  const updateQuantity = (productId, change) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQuantity = item.quantity + change;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Handler functions for hamburger menu
  const handleTakeOrders = () => {
    setCurrentView('take-orders');
  };

  const handleViewAllOrders = () => {
    setCurrentView('all-orders');
  };

  const handleCloseOrdersTable = () => {
    setCurrentView('take-orders');
  };

  // Function to send WhatsApp bill
  const sendWhatsAppBill = async (orderData) => {
    try {
      // Format the bill message
      const billMessage = formatBillMessage(orderData);
      
      // Encode the message for WhatsApp
      const encodedMessage = encodeURIComponent(billMessage);
      const phoneNumber = orderData.contact_number || customerInfo.contact_number;
      
      // Create WhatsApp URL
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
      
      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');
      
      toast.success('WhatsApp bill opened! Please send the message manually.');
      
    } catch (error) {
      console.error('Failed to send WhatsApp bill:', error);
      toast.error('Failed to open WhatsApp bill');
    }
  };





  // Function to format bill message
  const formatBillMessage = (orderData) => {
    const currentTime = new Date().toLocaleString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Use order_number for display
    const orderDisplayId = orderData.order_number;

    let message = `*BREWHOOD - ORDER CONFIRMATION*\n\n`;
    message += `*Date:* ${currentTime}\n`;
    message += `*Order Number:* ${orderDisplayId}\n`;
    message += `*Customer:* ${orderData.customer_name}\n`;
    message += `*Contact:* ${orderData.contact_number}\n`;
    message += `*Order Type:* ${orderData.order_type}\n\n`;
    message += `*Order Details:*\n`;
    
    orderData.items.forEach((item, index) => {
      message += `${index + 1}. ${item.product_name} x${item.quantity} = ₹${item.total_price}\n`;
    });
    
    message += `\n*Total Amount:* ₹${orderData.total_amount.toFixed(2)}\n\n`;
    message += `*Status:* Order Confirmed\n`;
    message += `*Estimated Time:* 15-20 minutes\n\n`;
    message += `Thank you for choosing Brewhood!\n`;
    message += `Your order will be ready soon.`;
    
    return message;
  };

  const handlePlaceOrder = async () => {
    if (!customerInfo.name.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    if (!customerInfo.contact_number.trim()) {
      toast.error('Please enter contact number');
      return;
    }
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    try {
      const orderData = {
        customer_name: customerInfo.name,
        contact_number: customerInfo.contact_number,
        order_type: customerInfo.order_type,
        status: 'pending',
        items: cart.map(item => ({
          product_id: item.product_id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity
        })),
        total_amount: getCartTotal(),
        created_at: new Date()
      };

      const createdOrder = await apiService.createOrder(orderData);
      
      // Debug: Log what the backend returned
      console.log('🔍 Backend response:', createdOrder);
      
      // Wait a moment for the order to be created in the database
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch the latest order to get the actual order number from the database
      let actualOrderNumber = null;
      try {
        const latestOrders = await apiService.getOrders('all', 1);
        if (latestOrders && latestOrders.orders && latestOrders.orders.length > 0) {
          const latestOrder = latestOrders.orders[0];
          if (latestOrder.order_number) {
            actualOrderNumber = latestOrder.order_number;
            console.log('✅ Got actual order number from database:', actualOrderNumber);
          }
        }
      } catch (error) {
        console.log('⚠️ Could not fetch latest order:', error);
      }
      
      // Use the actual order number from database, or fallback to counter
      const orderNumber = actualOrderNumber || orderCounter;
      setOrderCounter(prev => prev + 1); // Increment for next order
      
      // Set the order number
      orderData.order_number = orderNumber;
      console.log('✅ Using order number:', orderNumber);
      
      // Reset form
      setCart([]);
      setCustomerInfo({ name: '', contact_number: '', order_type: 'takeaway' });
      
      // Show order number for reference
      toast.success(`Order created! Order Number: ${orderData.order_number}`);
      
      // Send WhatsApp bill if contact number is provided
      if (customerInfo.contact_number.trim()) {
        await sendWhatsAppBill(orderData);
      }
      
      // Send immediate update to delivery dashboard
      try {
        // Method 1: PostMessage to other tabs/windows
        window.postMessage({
          type: 'ORDER_PLACED',
          order: orderData,
          timestamp: Date.now()
        }, '*');
        
        // Method 2: localStorage update (triggers storage event)
        localStorage.setItem('orderUpdate', JSON.stringify({
          type: 'ORDER_PLACED',
          order: orderData,
          timestamp: Date.now()
        }));
        
        // Method 3: BroadcastChannel (modern browsers)
        if (window.BroadcastChannel) {
          const channel = new BroadcastChannel('orderUpdates');
          channel.postMessage({
            type: 'ORDER_PLACED',
            order: orderData,
            timestamp: Date.now()
          });
          channel.close();
        }
        
        console.log('🚨 Immediate order update sent to delivery dashboard');
      } catch (error) {
        console.log('⚠️ Immediate update failed, will rely on polling fallback');
      }
      
    } catch (error) {
      console.error('Failed to place order:', error);
      toast.error('Failed to place order');
    }
  };

  // Show loading screen until minimum time and data is loaded
  if (loading || !minLoadingComplete) {
    return <LoadingScreen />;
  }

  return (
    <div className={`container ${notifications.filter(n => !n.read).length > 0 ? 'notification-overlay-active' : ''}`}>
      <div className="header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '16px 24px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <HamburgerMenu 
            onLogout={onLogout}
            onTakeOrders={handleTakeOrders}
            onViewAllOrders={handleViewAllOrders}
            user={user}
          />
          <h1 className="header-title" style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#212529' }}>
            Counter Dashboard
          </h1>
        </div>
        

      </div>

      {currentView === 'take-orders' ? (
        <div className="counter-main-layout">
          <div>
            {/* Customer Info */}
            <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Customer Information</h3>
            <div className="customer-info-layout">
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Customer Name</label>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  className="form-input"
                  placeholder="Enter customer name"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Contact Number</label>
                <input
                  type="tel"
                  value={customerInfo.contact_number}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, contact_number: e.target.value })}
                  className="form-input"
                  placeholder="Enter contact number"
                  pattern="[0-9]{10}"
                  title="Please enter a 10-digit phone number"
                />
              </div>
              <div style={{ 
                padding: '12px 16px', 
                backgroundColor: '#e7f3ff', 
                color: '#007bff',
                borderRadius: '8px',
                fontWeight: '500',
                fontSize: '14px',
                border: '1px solid #b8daff'
              }}>
                📦 Takeaway Order
              </div>
            </div>
          </div>

          {/* Products */}
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Menu Items</h3>
            <div className="product-grid">
              {products.map(product => (
                <div key={product.id} className="product-card">
                  <div className="product-image">
                    {getImageUrl(product) && getImageUrl(product).startsWith('http') ? (
                      <img 
                        src={getImageUrl(product)} 
                        alt={product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="no-image-placeholder"
                      style={{ 
                        display: getImageUrl(product) && getImageUrl(product).startsWith('http') ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f8f9fa',
                        color: '#6c757d',
                        fontSize: '14px',
                        fontWeight: '500',
                        height: '100%',
                        minHeight: '120px'
                      }}
                    >
                      <div className="text-center">
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                          {getImageUrl(product)}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>
                          {product.name}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="product-info">
                    <div className="product-name">{product.name}</div>
                    <div className="product-description">{product.description}</div>
                    <div className="product-price">₹{product.price}</div>
                    <button 
                      className="btn btn-primary"
                      onClick={() => addToCart(product)}
                      style={{ width: '100%' }}
                    >
                      <Plus size={18} />
                      Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>


        </div>

        {/* Cart */}
        <div className="cart">
          <div className="cart-header">
            <ShoppingCart size={20} />
            Cart ({cart.length} items)
          </div>
          
          <div className="cart-items">
            {cart.map(item => (
              <div key={item.product_id} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">₹{item.price} each</div>
                </div>
                <div className="cart-item-controls">
                  <button
                    className="quantity-btn"
                    onClick={() => updateQuantity(item.product_id, -1)}
                  >
                    <Minus size={16} />
                  </button>
                  <span style={{ margin: '0 8px' }}>{item.quantity}</span>
                  <button
                    className="quantity-btn"
                    onClick={() => updateQuantity(item.product_id, 1)}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    className="quantity-btn"
                    onClick={() => removeFromCart(item.product_id)}
                    style={{ marginLeft: '8px', color: '#dc3545' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {cart.length > 0 && (
            <div className="cart-total">
              <div className="total-amount">
                Total: ₹{getCartTotal().toFixed(2)}
              </div>
              <button 
                className="btn btn-primary"
                onClick={() => sendWhatsAppBill({
                  customer_name: customerInfo.name,
                  contact_number: customerInfo.contact_number,
                  order_number: `PREVIEW-${Date.now().toString().slice(-4)}`,
                  order_type: customerInfo.order_type,
                  items: cart.map(item => ({
                    product_name: item.name,
                    quantity: item.quantity,
                    total_price: item.price * item.quantity
                  })),
                  total_amount: getCartTotal(),
                  created_at: new Date()
                })}
                style={{ width: '100%', marginBottom: '8px' }}
                disabled={!customerInfo.name.trim() || !customerInfo.contact_number.trim()}
              >
                Send Bill via WhatsApp
              </button>

              <button 
                className="btn btn-success"
                onClick={handlePlaceOrder}
                style={{ width: '100%' }}
              >
                Place Order
              </button>
            </div>
          )}
          
          {cart.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
              Cart is empty
            </div>
          )}
        </div>
      </div>
      ) : (
        // All Orders View
        <OrdersStatusTable onClose={handleCloseOrdersTable} />
      )}

      {/* Notification Center Popup */}
      {showNotificationCenter && (
        <div 
          className="notification-overlay"
          onClick={() => setShowNotificationCenter(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '80px'
          }}
        >
          <div 
            className="notification-center"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '70vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Notifications ({notifications.length})
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsAsRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#007bff',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationCenter(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0'
            }}>
              {notifications.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#666'
                }}>
                  <div style={{ fontSize: '48px', opacity: 0.3, marginBottom: '16px' }}>🔔</div>
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid #f1f3f4',
                      backgroundColor: notification.read ? 'transparent' : '#f8f9ff',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                    onClick={() => markNotificationAsRead(notification.id)}
                    onMouseEnter={(e) => e.target.style.backgroundColor = notification.read ? '#f8f9fa' : '#e7f3ff'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = notification.read ? 'transparent' : '#f8f9ff'}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        backgroundColor: notification.type === 'success' ? '#d4edda' : 
                                       notification.type === 'warning' ? '#fff3cd' :
                                       notification.type === 'error' ? '#f8d7da' : '#d1ecf1',
                        color: notification.type === 'success' ? '#155724' :
                               notification.type === 'warning' ? '#856404' :
                               notification.type === 'error' ? '#721c24' : '#0c5460'
                      }}>
                        {notification.type === 'success' && <Package size={16} />}
                        {notification.type === 'warning' && <Package size={16} />}
                        {notification.type === 'error' && <Trash2 size={16} />}
                        {notification.type === 'info' && <Edit size={16} />}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: '600',
                          fontSize: '14px',
                          marginBottom: '4px',
                          color: notification.read ? '#495057' : '#212529'
                        }}>
                          {notification.title}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#6c757d',
                          marginBottom: '6px',
                          lineHeight: '1.4'
                        }}>
                          {notification.message}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#adb5bd',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span>
                            {notification.timestamp.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                          {!notification.read && (
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#007bff'
                            }}></span>
                          )}
                        </div>
                      </div>

                      {/* Clear button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearNotification(notification.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          color: '#adb5bd',
                          transition: 'color 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#dc3545'}
                        onMouseLeave={(e) => e.target.style.color = '#adb5bd'}
                        title="Clear notification"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Background Overlay for Notifications */}
      {notifications.filter(n => !n.read).length > 0 && (
        <div 
          className="fixed inset-0 bg-black/50 z-[9998]" 
          style={{
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            pointerEvents: 'none'
          }}
        />
      )}

                  {/* Centered Simple Notifications */}
      {notifications.filter(n => !n.read).map((notification, index) => (
        <div
          key={`persistent-${notification.id}`}
          className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 min-w-[400px] max-w-[500px] p-6"
          style={{
            zIndex: 9999 + index,
            animation: `slideInFromTop 0.3s ease-out ${index * 0.1}s both`
          }}
        >
          {/* Colored left border */}
          <div 
            className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
              notification.type === 'success' ? 'bg-green-500' :
              notification.type === 'warning' ? 'bg-yellow-500' :
              notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }`}
          />

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                ${notification.type === 'success' ? 'bg-green-100 text-green-700' : 
                  notification.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                  notification.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}
              `}>
                {notification.type === 'success' && <Package size={20} />}
                {notification.type === 'warning' && <Package size={20} />}
                {notification.type === 'error' && <Trash2 size={20} />}
                {notification.type === 'info' && <Edit size={20} />}
              </div>
              
              {/* Title */}
              <div className="font-semibold text-lg text-gray-900">
                {notification.title}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => markNotificationAsRead(notification.id)}
              className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all duration-200"
              title="Mark as read"
            >
              <X size={20} />
            </button>
          </div>

          {/* Message */}
          <div className="text-gray-700 text-base leading-relaxed mb-6">
            {notification.message}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {notification.timestamp.toLocaleString([], { 
                month: 'short',
                day: 'numeric',
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => markNotificationAsRead(notification.id)}
                className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all duration-200"
              >
                Mark as Read
              </button>
              
              <button
                onClick={() => clearNotification(notification.id)}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 focus:ring-4 focus:ring-gray-200 transition-all duration-200"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes slideInFromTop {
          0% {
            opacity: 0;
            transform: translate(-50%, -60%) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        /* Ensure blur works on all elements */
        .notification-overlay-background {
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
        }
        
        /* Force blur on cart and other elements when overlay is active */
        .notification-overlay-active .cart,
        .notification-overlay-active .product-grid,
        .notification-overlay-active .customer-info-layout {
          filter: blur(2px);
          transition: filter 0.3s ease;
        }
      `}</style>
    </div>
  );
};

export default CounterDashboard;
