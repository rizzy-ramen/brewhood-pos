import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Minus, X, User, LogOut, Bell, Package, Edit, Trash2 } from 'lucide-react';
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
    order_type: 'takeaway'
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minLoadingComplete, setMinLoadingComplete] = useState(false);
  
  // State for managing views
  const [currentView, setCurrentView] = useState('take-orders'); // 'take-orders' or 'all-orders'

  // Notification system state
  const [notifications, setNotifications] = useState([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Set minimum loading time for better UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingComplete(true);
    }, 3000); // Show loading screen for at least 3 seconds

    return () => clearTimeout(timer);
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
    
    // Auto-remove notification after 8 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }, 8000);
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

  const handlePlaceOrder = async () => {
    if (!customerInfo.name.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    try {
      const orderData = {
        customer_name: customerInfo.name,
        customer_id: `CUST${Date.now()}`,
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
      
      // Reset form
      setCart([]);
      setCustomerInfo({ name: '', order_type: 'takeaway' });
      
      // Show customer ID for reference
      toast.success(`Order created! Customer ID: ${orderData.customer_id}`);
      
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
    <div className="container">
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
        
        {/* Notification Bell */}
        <div className="notification-section" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Test notification button */}
          <button
            onClick={() => addNotification('success', 'Test Notification', 'This is a test notification to verify the system is working!', 'Test Product')}
            style={{
              background: '#007bff',
              border: 'none',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#0056b3'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#007bff'}
          >
            Test Notif
          </button>
          
          <button 
            className="notification-bell"
            onClick={() => setShowNotificationCenter(!showNotificationCenter)}
            title="Notifications"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              padding: '8px',
              borderRadius: '50%',
              transition: 'background-color 0.2s ease',
              color: '#6c757d'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e9ecef';
              e.target.style.color = '#495057';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#6c757d';
            }}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span 
                className="notification-badge"
                style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {currentView === 'take-orders' ? (
        <div className="counter-main-layout">
          <div>
            {/* Customer Info */}
            <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Customer Information</h3>
            <div className="customer-info-layout">
              <div className="form-group" style={{ marginBottom: '0' }}>
                <label className="form-label">Customer Name</label>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  className="form-input"
                  placeholder="Enter customer name"
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
                  <Bell size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
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
    </div>
  );
};

export default CounterDashboard;
