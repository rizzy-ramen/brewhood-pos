import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus, Minus, X, User, LogOut } from 'lucide-react';
import { apiService } from '../services/api';
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

  // Set minimum loading time for better UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingComplete(true);
    }, 3000); // Show loading screen for at least 3 seconds

    return () => clearTimeout(timer);
  }, []);

  // Initialize with products from backend API
  useEffect(() => {
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

    fetchProducts();
  }, []);

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
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <HamburgerMenu 
            onLogout={onLogout}
            onTakeOrders={handleTakeOrders}
            onViewAllOrders={handleViewAllOrders}
            user={user}
          />
          <h1 className="header-title">Counter Dashboard</h1>
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
    </div>
  );
};

export default CounterDashboard;
