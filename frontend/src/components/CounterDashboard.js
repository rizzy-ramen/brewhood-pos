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
  const [orderCounter, setOrderCounter] = useState(15); // Start with a reasonable default
  
  // Loading state for order placement
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderStatus, setOrderStatus] = useState('');

  // Contact number validation state
  const [contactNumberError, setContactNumberError] = useState('');
  const [isContactNumberValid, setIsContactNumberValid] = useState(false);
  const [hasContactNumberBeenTouched, setHasContactNumberBeenTouched] = useState(false);


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
          if (latestOrder.order_number && typeof latestOrder.order_number === 'number') {
            setOrderCounter(latestOrder.order_number + 1); // Set counter to next number
          }
        }
      } catch (error) {
        // Silent fallback
      }
    };

    syncOrderCounter();
  }, []);

  // Function to fetch products from backend
  const fetchProducts = async () => {
    try {
      const products = await apiService.getProducts();
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

  // Contact number validation function
  const validateContactNumber = (phoneNumber, showRequiredError = false) => {
    // Remove all non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Check if empty
    if (!cleanNumber) {
      if (showRequiredError) {
        setContactNumberError('Contact number is required');
      } else {
        setContactNumberError('');
      }
      setIsContactNumberValid(false);
      return false;
    }
    
    // Check if it's exactly 10 digits
    if (cleanNumber.length !== 10) {
      setContactNumberError('Contact number must be exactly 10 digits');
      setIsContactNumberValid(false);
      return false;
    }
    
    // Check if it starts with valid digits (6-9 for Indian mobile numbers)
    if (!/^[6-9]/.test(cleanNumber)) {
      setContactNumberError('Contact number must start with 6, 7, 8, or 9');
      setIsContactNumberValid(false);
      return false;
    }
    
    // Check if all digits are not the same
    if (/^(\d)\1{9}$/.test(cleanNumber)) {
      setContactNumberError('Please enter a valid contact number');
      setIsContactNumberValid(false);
      return false;
    }
    
    // Valid number
    setContactNumberError('');
    setIsContactNumberValid(true);
    return true;
  };

  // Handle contact number input change
  const handleContactNumberChange = (e) => {
    const value = e.target.value;
    
    // Mark field as touched
    setHasContactNumberBeenTouched(true);
    
    // Only allow digits and limit to 10 characters
    const cleanValue = value.replace(/\D/g, '').slice(0, 10);
    
    setCustomerInfo({ ...customerInfo, contact_number: cleanValue });
    
    // Validate the number (show required error only if field has been touched)
    validateContactNumber(cleanValue, hasContactNumberBeenTouched);
  };

  // Handle contact number input blur (when user leaves the field)
  const handleContactNumberBlur = () => {
    setHasContactNumberBeenTouched(true);
    validateContactNumber(customerInfo.contact_number, true);
  };

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
    
    // Auto-remove after 5 seconds for success notifications
    if (type === 'success') {
      setTimeout(() => {
        clearNotification(newNotification.id);
      }, 5000);
    }
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

  // WebSocket connection and event handling
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        const connectionStatus = websocketService.getConnectionStatus();
        console.log('🔌 WebSocket connection status:', connectionStatus);
        
        if (!connectionStatus.isConnected) {
          await websocketService.connect();
        }
        
        const handleStatusChange = (status) => {
          console.log('🔌 WebSocket status changed:', status);
        };
        
        // Set up event listeners
        websocketService.on('orderPlaced', (order) => {
          console.log('🚨 New order placed:', order);
          addNotification('info', 'New Order', `Order #${order.order_number || order.id} placed by ${order.customer_name}`);
        });
        
        websocketService.on('productUpdated', (product) => {
          console.log('🔄 Product updated:', product);
          addNotification('warning', 'Menu Updated', `${product.name} has been updated`);
          // Refresh products
          fetchProducts();
        });
        
        websocketService.on('productCreated', (product) => {
          console.log('🆕 Product created:', product);
          addNotification('info', 'New Item', `${product.name} added to menu`);
          // Refresh products
          fetchProducts();
        });
        
        websocketService.on('productDeleted', (productId) => {
          console.log('🗑️ Product deleted:', productId);
          addNotification('warning', 'Item Removed', 'A product has been removed from menu');
          // Refresh products
          fetchProducts();
        });
        
        // Check connection status after a delay
        const checkConnection = setTimeout(() => {
          const status = websocketService.getConnectionStatus();
          console.log('🔌 WebSocket connection status after delay:', status);
          
          if (status.isConnected) {
            console.log('✅ WebSocket connected successfully');
          } else {
            console.log('❌ WebSocket connection failed');
          }
        }, 2000);
        
        return () => {
          console.log('🔌 Cleaning up WebSocket listeners for CounterDashboard...');
          websocketService.off('orderPlaced');
          websocketService.off('productUpdated');
          websocketService.off('productCreated');
          websocketService.off('productDeleted');
          clearTimeout(checkConnection);
        };
      } catch (error) {
        console.error('❌ WebSocket connection failed:', error);
      }
    };

    connectWebSocket();
  }, []);

  // Function to get proper image URL or fallback
  const getImageUrl = (product) => {
    if (!product.image_url || product.image_url === '') return '🍽️';
    
    // If it's already a full URL, use it
    if (product.image_url.startsWith('http')) {
      return product.image_url;
    }
    
    // If it's a local path, construct the proper URL for Firebase Hosting
    if (product.image_url.startsWith('/images/')) {
      // Use the backend server URL from the tunnel
      const backendUrl = 'https://brave-relate-travelers-fs.trycloudflare.com';
      return `${backendUrl}${product.image_url}`;
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
      const whatsappUrl = `https://wa.me/91${phoneNumber}?text=${encodedMessage}`;
      
      // Open WhatsApp in a new tab
      window.open(whatsappUrl, '_blank');
      
      toast.success('WhatsApp bill sent!');
    } catch (error) {
      console.error('Error sending WhatsApp bill:', error);
      toast.error('Failed to send WhatsApp bill');
    }
  };

  const formatBillMessage = (orderData) => {
    const currentTime = new Date().toLocaleString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
    
    let message = `🍽️ *BrewHood Order Receipt*\n\n`;
    message += `📋 *Order #${orderData.order_number || orderData.id}*\n`;
    message += `👤 *Customer:* ${orderData.customer_name}\n`;
    message += `📞 *Contact:* ${orderData.contact_number}\n`;
    message += `📦 *Type:* ${orderData.order_type}\n`;
    message += `🕐 *Time:* ${currentTime}\n\n`;
    message += `📝 *Items:*\n`;
    
    orderData.items.forEach((item, index) => {
      message += `${index + 1}. ${item.name} x${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}\n`;
    });
    
    message += `\n💰 *Total: ₹${orderData.total_amount.toFixed(2)}*\n\n`;
    message += `Thank you for choosing BrewHood! 🙏\n`;
    message += `Your order will be ready soon.`;
    
    return message;
  };

  const handlePlaceOrder = async () => {
    if (!customerInfo.name.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    
    // Enhanced contact number validation
    if (!customerInfo.contact_number.trim()) {
      toast.error('Please enter contact number');
      return;
    }
    
    if (!isContactNumberValid) {
      toast.error(contactNumberError || 'Please enter a valid contact number');
      return;
    }
    
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setIsPlacingOrder(true);
    setOrderStatus('Creating order...');

    try {
      const orderData = {
        customer_name: customerInfo.name,
        contact_number: customerInfo.contact_number,
        order_type: customerInfo.order_type,
        items: cart.map(item => ({
          product_id: item.product_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        total_amount: getCartTotal(),
        order_number: orderCounter
      };

      setOrderStatus('Sending to kitchen...');
      
      // Send order to backend
      const backendResponse = await apiService.createOrder(orderData);
      
      // Extract the actual order data from the response
      const order = backendResponse.order || backendResponse;
      
      console.log('✅ Order created successfully:', order);
      
      setOrderStatus('Order placed successfully!');
      
      // Add notification
      addNotification('success', 'Order Placed', `Order #${order.order_number || order.id} placed successfully!`);
      
      // Send WhatsApp bill
      await sendWhatsAppBill(order);
      
      // Clear form and cart
      setCustomerInfo({
        name: '',
        contact_number: '',
        order_type: 'takeaway'
      });
      setCart([]);
      setContactNumberError('');
      setIsContactNumberValid(false);
      setHasContactNumberBeenTouched(false);
      
      // Increment order counter
      setOrderCounter(prev => prev + 1);
      
      // Notify other components via BroadcastChannel
      const channel = new BroadcastChannel('orderUpdates');
      channel.postMessage({
        type: 'ORDER_PLACED',
        order: order
      });
      channel.close();
      
      toast.success(`Order #${order.order_number || order.id} placed successfully!`);
      
    } catch (error) {
      console.error('❌ Error placing order:', error);
      toast.error(`Failed to place order: ${error.message}`);
      setOrderStatus('Failed to place order');
    } finally {
      setIsPlacingOrder(false);
      setOrderStatus('');
    }
  };

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
            onTakeOrders={handleTakeOrders}
            onViewAllOrders={handleViewAllOrders}
            onLogout={onLogout}
            user={user}
            notifications={notifications}
            unreadCount={unreadCount}
            showNotificationCenter={showNotificationCenter}
            setShowNotificationCenter={setShowNotificationCenter}
            markNotificationAsRead={markNotificationAsRead}
            markAllNotificationsAsRead={markAllNotificationsAsRead}
            clearNotification={clearNotification}
          />
          <h1 className="header-title" style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#212529' }}>
            Counter Dashboard
          </h1>
        </div>
      </div>

      {currentView === 'take-orders' ? (
        <div className="counter-main-layout">
          <div>
            {/* Customer Information */}
            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Customer Information</h3>
              <div className="customer-info-layout">
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Customer Name *</label>
                  <input
                    type="text"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    className="form-input"
                    placeholder="Enter customer name"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Contact Number *</label>
                  <input
                    type="tel"
                    value={customerInfo.contact_number}
                    onChange={handleContactNumberChange}
                    onBlur={handleContactNumberBlur}
                    className={`form-input ${contactNumberError ? 'error' : isContactNumberValid ? 'success' : ''}`}
                    placeholder="Enter 10-digit contact number"
                    maxLength="10"
                    required
                  />
                  {contactNumberError && hasContactNumberBeenTouched && (
                    <div className="error-message" style={{ 
                      color: '#dc3545', 
                      fontSize: '12px', 
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      ❌ {contactNumberError}
                    </div>
                  )}
                  {isContactNumberValid && !contactNumberError && hasContactNumberBeenTouched && (
                    <div className="success-message" style={{ 
                      color: '#28a745', 
                      fontSize: '12px', 
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      ✅ Valid contact number
                    </div>
                  )}
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
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <div style={{ 
                        display: getImageUrl(product) && getImageUrl(product).startsWith('http') ? 'none' : 'block',
                        fontSize: '48px',
                        textAlign: 'center',
                        padding: '20px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px'
                      }}>
                        {getImageUrl(product)}
                      </div>
                    </div>
                    <div className="product-info">
                      <h4 className="product-name">{product.name}</h4>
                      <p className="product-description">{product.description}</p>
                      <div className="product-price">₹{product.price}</div>
                      <button 
                        className="btn btn-primary add-to-cart-btn"
                        onClick={() => addToCart(product)}
                      >
                        <Plus size={16} />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div className="cart">
                <div className="cart-header">
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShoppingCart size={20} />
                    Cart ({cart.length} items)
                  </h3>
                  <button 
                    className="btn btn-sm btn-outline"
                    onClick={() => setCart([])}
                    style={{ padding: '4px 8px' }}
                  >
                    Clear All
                  </button>
                </div>
                <div className="cart-items">
                  {cart.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '20px', 
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      Your cart is empty. Add items to get started!
                    </div>
                  ) : (
                    cart.map(item => (
                    <div key={item.product_id} className="cart-item">
                      <div className="cart-item-info">
                        <div className="cart-item-name">{item.name}</div>
                        <div className="cart-item-price">₹{item.price}</div>
                      </div>
                      <div className="cart-item-controls">
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => updateQuantity(item.product_id, -1)}
                          style={{ padding: '4px 8px', minWidth: '32px' }}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="cart-item-quantity">{item.quantity}</span>
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => updateQuantity(item.product_id, 1)}
                          style={{ padding: '4px 8px', minWidth: '32px' }}
                        >
                          <Plus size={14} />
                        </button>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => removeFromCart(item.product_id)}
                          style={{ padding: '4px 8px', minWidth: '32px' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    ))
                  )}
                </div>
                <div className="cart-footer">
                  <div className="cart-total">
                    Total: ₹{getCartTotal().toFixed(2)}
                  </div>

                  <button 
                    className="btn btn-success"
                    onClick={handlePlaceOrder}
                    style={{ width: '100%' }}
                    disabled={isPlacingOrder || !customerInfo.name.trim() || contactNumberError || !hasContactNumberBeenTouched}
                  >
                    {isPlacingOrder ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid #ffffff',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                        <span>{orderStatus}</span>
                      </div>
                    ) : (
                      'Place Order'
                    )}
                  </button>
                </div>
              </div>
          </div>
        </div>
      ) : (
        // All Orders View
        <OrdersStatusTable onClose={handleCloseOrdersTable} />
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .form-input.error {
          border-color: #dc3545;
          box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
        }
        
        .form-input.success {
          border-color: #28a745;
          box-shadow: 0 0 0 0.2rem rgba(40, 167, 69, 0.25);
        }
        
        .error-message {
          animation: fadeIn 0.3s ease-in;
        }
        
        .success-message {
          animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CounterDashboard;