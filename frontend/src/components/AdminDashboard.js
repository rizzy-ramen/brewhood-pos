import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './AdminDashboard.css';
import { apiService } from '../services/api';
import { websocketService } from '../services/websocketService';
import LoadingScreen from './LoadingScreen';
import AdminHamburgerMenu from './AdminHamburgerMenu';
import AdminOrdersTable from './AdminOrdersTable';
import SalesReport from './SalesReport';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Save, 
  X, 
  Package,
  DollarSign,
  FileText,
  Image as ImageIcon,
  User
} from 'lucide-react';

const AdminDashboard = ({ user, onLogout }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minLoadingComplete, setMinLoadingComplete] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [updatingProducts, setUpdatingProducts] = useState(new Set()); // Track which products are being updated
  const [activeSection, setActiveSection] = useState('active'); // 'active', 'hidden', 'total'
  const [currentView, setCurrentView] = useState('products'); // 'products', 'orders', 'sales'
  const [showSalesReport, setShowSalesReport] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    category: 'Beverage'
  });

  // Menu handlers
  const handleModifyProducts = () => {
    setCurrentView('products');
  };

  const handleSales = () => {
    setCurrentView('sales');
  };

  const handleBackToProducts = () => {
    setCurrentView('products');
  };

  const handleCloseOrdersTable = () => {
    setCurrentView('products');
  };

  const handleSalesReport = () => {
    setShowSalesReport(true);
  };

  const handleCloseSalesReport = () => {
    setShowSalesReport(false);
  };

  // Function to get proper image URL or fallback
  const getImageUrl = (product) => {
    if (!product.image_url || product.image_url === '') return null;
    
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
    
    return null;
  };

  // Function to get placeholder image based on product name
  const getPlaceholderImage = (productName) => {
    const name = productName.toLowerCase();
    if (name.includes('tea') || name.includes('iced')) {
      return '🍵'; // Tea emoji
    } else if (name.includes('chocolate') || name.includes('hot')) {
      return '☕'; // Hot drink emoji
    } else if (name.includes('lemon') || name.includes('mint') || name.includes('cooler')) {
      return '🍋'; // Lemon emoji
    } else {
      return '🍽️'; // Food emoji
    }
  };

  // Function to get external placeholder image URL
  const getExternalImageUrl = (productName) => {
    const name = productName.toLowerCase();
    if (name.includes('tea') || name.includes('iced')) {
      return 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop';
    } else if (name.includes('chocolate') || name.includes('hot')) {
      return 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=300&fit=crop';
    } else if (name.includes('lemon') || name.includes('mint') || name.includes('cooler')) {
      return 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&h=300&fit=crop';
    } else {
      return null;
    }
  };



  const fetchProducts = async () => {
    try {
      // Try to fetch ALL products (including hidden) first, fallback to regular products
      let products;
      try {
        products = await apiService.getAllProducts();
        console.log('Fetched all products (including hidden) from backend:', products);
      } catch (adminError) {
        console.log('Admin access not available, fetching regular products:', adminError.message);
        products = await apiService.getProducts();
        console.log('Fetched regular products from backend:', products);
      }
      setProducts(products);
    } catch (error) {
      console.error('Failed to fetch products from backend:', error);
      toast.error('Failed to fetch products from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    
    // Register as admin dashboard (connect if needed)
    const registerDashboard = async () => {
      try {
        await websocketService.registerDashboard('admin');
        console.log('✅ AdminDashboard: Registered successfully');
      } catch (error) {
        console.error('❌ AdminDashboard: Registration failed:', error);
      }
    };
    
    registerDashboard();
    
    // WebSocket integration for real-time product updates
    const handleProductUpdated = (product) => {
      console.log('🔄 Admin Dashboard received productUpdated event:', product);
      setProducts(prevProducts => 
        prevProducts.map(p => p.id === product.id ? product : p)
      );
    };

    const handleProductCreated = (product) => {
      console.log('🔄 Admin Dashboard received productCreated event:', product);
      setProducts(prevProducts => [...prevProducts, product]);
    };

    const handleProductDeleted = (productId) => {
      console.log('🔄 Admin Dashboard received productDeleted event:', productId);
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
    };

    // Set up WebSocket listeners
    websocketService.on('productUpdated', handleProductUpdated);
    websocketService.on('productCreated', handleProductCreated);
    websocketService.on('productDeleted', handleProductDeleted);

    // Cleanup WebSocket listeners on unmount
    return () => {
      websocketService.off('productUpdated', handleProductUpdated);
      websocketService.off('productCreated', handleProductCreated);
      websocketService.off('productDeleted', handleProductDeleted);
    };
  }, []);

  // Set minimum loading time for better UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingComplete(true);
    }, 3000); // Show loading screen for at least 3 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      image_url: '',
      category: 'Beverage'
    });
    setEditingProduct(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.price || formData.price <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProduct) {
        // Update existing product - preserve is_available status
        const updateData = { 
          ...formData, 
          price: parseFloat(formData.price),
          is_available: editingProduct.is_available === 1 || editingProduct.is_available === true // Convert to boolean
        };
        console.log('Updating product with data:', updateData);
        console.log('Original product is_available:', editingProduct.is_available);
        console.log('Original product is_available type:', typeof editingProduct.is_available);
        console.log('Original product is_available === 1:', editingProduct.is_available === 1);
        console.log('Original product is_available === true:', editingProduct.is_available === true);
        
        await apiService.updateProduct(editingProduct.id, updateData);
        toast.success('Product updated successfully');
      } else {
        // Create new product
        await apiService.createProduct({ ...formData, price: parseFloat(formData.price) });
        toast.success('Product created successfully');
      }
      
      resetForm();
      // Refresh products and maintain current view
      await fetchProducts();
      console.log('Products refreshed after update');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product) => {
    console.log('Editing product:', product);
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      image_url: product.image_url || '',
      category: product.category || 'Beverage'
    });
    setShowAddForm(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to permanently delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('🗑️ Deleting product with ID:', productId);
                      await apiService.deleteProduct(productId);
        toast.success('Product deleted permanently');
        // Refresh products immediately since we're not using real-time listeners
        await fetchProducts();
      console.log('✅ Product deleted, waiting for real-time update...');
    } catch (error) {
      console.error('❌ Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const toggleAvailability = async (product) => {
    try {
      // Set loading state for this product
      setUpdatingProducts(prev => new Set([...prev, product.id]));
      
      // Get the current product data to ensure we have all fields
      const currentProduct = products.find(p => p.id === product.id);
      if (!currentProduct) {
        toast.error('Product not found');
        setUpdatingProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(product.id);
          return newSet;
        });
        return;
      }
      
      console.log('🔄 Toggling availability for product:', currentProduct.name, 'Current status:', currentProduct.is_available);
      
      const newStatus = !(currentProduct.is_available === 1 || currentProduct.is_available === true);
      console.log('🔄 New status will be:', newStatus);
      
      // Debug: Check current user and token
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const token = localStorage.getItem('token');
      console.log('🔍 Current user:', currentUser);
      console.log('🔍 Token exists:', !!token);
      console.log('🔍 Token preview:', token ? token.substring(0, 20) + '...' : 'No token');
      
      // Use the dedicated availability toggle endpoint
      await apiService.toggleProductAvailability(product.id, newStatus);
      toast.success(`Product ${currentProduct.is_available ? 'disabled' : 'enabled'} successfully`);
      
      // Refresh products immediately since we're not using real-time listeners
      await fetchProducts();
      console.log('✅ Product availability updated, products refreshed');
    } catch (error) {
      console.error('❌ Error toggling availability:', error);
      toast.error('Failed to update product availability');
    } finally {
      // Clear loading state for this product
      setUpdatingProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }
  };

  const enableProduct = async (product) => {
    try {
      // Set loading state for this product
      setUpdatingProducts(prev => new Set([...prev, product.id]));
      
      // Get the current product data to ensure we have all fields
      const currentProduct = products.find(p => p.id === product.id);
      if (!currentProduct) {
        toast.error('Product not found');
        setUpdatingProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(product.id);
          return newSet;
        });
        return;
      }
      
      console.log('🔄 Enabling product:', currentProduct.name);
      
      // Use the dedicated availability toggle endpoint
      await apiService.toggleProductAvailability(product.id, true);
      toast.success('Product enabled successfully');
      
      // Refresh products immediately since we're not using real-time listeners
      await fetchProducts();
      console.log('✅ Product enabled, products refreshed');
    } catch (error) {
      console.error('❌ Error enabling product:', error);
      toast.error('Failed to enable product');
    } finally {
      // Clear loading state for this product
      setUpdatingProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }
  };


    

  if (loading || !minLoadingComplete) {
    return <LoadingScreen />;
  }

  return (
    <div className="container" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #7abbca 0%, #5a9bb8 25%, #4a8ba8 50%, #3a7b98 75%, #2a6b88 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0
      }}>
        <div style={{
          position: 'absolute',
          top: '-10%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: 'rgba(122, 187, 202, 0.1)',
          borderRadius: '50%',
          animation: 'float 8s ease-in-out infinite',
          filter: 'blur(40px)'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-10%',
          width: '400px',
          height: '400px',
          background: 'rgba(90, 155, 184, 0.1)',
          borderRadius: '50%',
          animation: 'float 10s ease-in-out infinite 2s',
          filter: 'blur(50px)'
        }}></div>
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '20%',
          width: '200px',
          height: '200px',
          background: 'rgba(74, 139, 168, 0.1)',
          borderRadius: '50%',
          animation: 'float 12s ease-in-out infinite 4s',
          filter: 'blur(30px)'
        }}></div>
        <div style={{
          position: 'absolute',
          top: '60%',
          right: '20%',
          width: '250px',
          height: '250px',
          background: 'rgba(58, 123, 152, 0.1)',
          borderRadius: '50%',
          animation: 'float 14s ease-in-out infinite 6s',
          filter: 'blur(35px)'
        }}></div>
      </div>

      <div className="header" style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <AdminHamburgerMenu 
            onLogout={onLogout}
            onModifyProducts={handleModifyProducts}
            onSales={handleSales}
            user={user}
          />
          <h1 className="header-title">Admin Dashboard</h1>
        </div>
        <div className="user-info">
          <div className="role-badge admin">Admin</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} />
            <span>{user.username}</span>
          </div>
        </div>
      </div>

      {/* Conditional rendering based on current view */}
      {currentView === 'products' && (
        <>
          <div className="admin-header">
            <div className="admin-controls">
              <button 
                className="btn btn-primary add-product-btn"
                onClick={() => setShowAddForm(true)}
              >
                <Plus size={18} />
                Add New Product
              </button>
            </div>
          </div>

          {/* Unified Admin Dashboard Card */}
          <div className="admin-dashboard-card">
        {/* Stats Section */}
        <div className="stats-section">
          <div className="admin-stats">
            <div 
              className={`stat-circle active-products ${activeSection === 'active' ? 'active' : ''}`}
              onClick={() => setActiveSection('active')}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-circle-content">
                <div className="stat-number">{products.filter(p => p.is_available).length}</div>
              </div>
              <div className="stat-label">Active Products</div>
            </div>
            
            <div 
              className={`stat-circle hidden-products ${activeSection === 'hidden' ? 'active' : ''}`}
              onClick={() => setActiveSection('hidden')}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-circle-content">
                <div className="stat-number">{products.filter(p => !p.is_available).length}</div>
              </div>
              <div className="stat-label">Hidden Products</div>
            </div>
            
            <div 
              className={`stat-circle total-products ${activeSection === 'total' ? 'active' : ''}`}
              onClick={() => setActiveSection('total')}
              style={{ cursor: 'pointer' }}
            >
              <div className="stat-circle-content">
                <div className="stat-number">{products.length}</div>
              </div>
              <div className="stat-label">Total Products</div>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="products-section">
          {/* Active Products Section */}
          {activeSection === 'active' && (
            <div className="active-products-section">
              <div className="product-grid">
                {products.filter(p => p.is_available).length > 0 ? (
                  products.filter(p => p.is_available).map(product => (
                    <div key={product.id} className="product-card">
                      <div className="product-image">
                        {getImageUrl(product) ? (
                          <img 
                            src={getImageUrl(product)} 
                            alt={product.name}
                            onError={(e) => {
                              console.log('❌ Local image failed, trying external placeholder...');
                              // Try external placeholder image
                              const externalUrl = getExternalImageUrl(product.name);
                              if (externalUrl) {
                                e.target.src = externalUrl;
                                e.target.onerror = null; // Prevent infinite loop
                              } else {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : (
                          // Try external placeholder image directly
                          <img 
                            src={getExternalImageUrl(product.name) || ''} 
                            alt={product.name}
                            onError={(e) => {
                              console.log('❌ External image also failed, showing emoji placeholder');
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        )}
                        <div 
                          className="no-image-placeholder"
                          style={{ 
                            display: 'none', // Will be shown by onError handlers
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
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                              {getPlaceholderImage(product.name)}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '600' }}>
                              {product.name}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="product-info">
                        <div className="product-name">{product.name}</div>
                        <div className="product-description">{product.description}</div>
                        <div className="product-price">₹{product.price}</div>
                        <div className="product-category">{product.category}</div>
                        <div className="product-actions">
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                          <button 
                            className="btn btn-warning btn-sm"
                            onClick={() => toggleAvailability(product)}
                            disabled={updatingProducts.has(product.id)}
                          >
                            {updatingProducts.has(product.id) ? (
                              <>
                                <div className="spinner" style={{
                                  width: '16px',
                                  height: '16px',
                                  border: '2px solid #ffffff',
                                  borderTop: '2px solid transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite',
                                  marginRight: '8px'
                                }}></div>
                                Updating...
                              </>
                            ) : (
                              <>
                                <EyeOff size={16} />
                                Hide
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📦</div>
                    <h4>No Active Products</h4>
                    <p>Add your first product to get started</p>
                    <button 
                      className="btn btn-primary"
                      onClick={() => setShowAddForm(true)}
                    >
                      <Plus size={18} />
                      Add First Product
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hidden Products Section */}
          {activeSection === 'hidden' && (
            <div className="hidden-products-section">
              <div className="product-grid">
                {console.log('🔍 Debug - All products:', products)}
                {console.log('🔍 Debug - Hidden products:', products.filter(p => !p.is_available))}
                {products.filter(p => !p.is_available).length > 0 ? (
                  products.filter(p => !p.is_available).map(product => (
                    <div key={product.id} className="product-card">
                      <div className="product-image">
                        {getImageUrl(product) ? (
                          <img 
                            src={getImageUrl(product)} 
                            alt={product.name}
                            onError={(e) => {
                              console.log('❌ Local image failed, trying external placeholder...');
                              // Try external placeholder image
                              const externalUrl = getExternalImageUrl(product.name);
                              if (externalUrl) {
                                e.target.src = externalUrl;
                                e.target.onerror = null; // Prevent infinite loop
                              } else {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : (
                          // Try external placeholder image directly
                          <img 
                            src={getExternalImageUrl(product.name) || ''} 
                            alt={product.name}
                            onError={(e) => {
                              console.log('❌ External image also failed, showing emoji placeholder');
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        )}
                        <div 
                          className="no-image-placeholder"
                          style={{ 
                            display: 'none', // Will be shown by onError handlers
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
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                              {getPlaceholderImage(product.name)}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '600' }}>
                              {product.name}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="product-info">
                        <div className="product-name">{product.name}</div>
                        <div className="product-description">{product.description}</div>
                        <div className="product-price">₹{product.price}</div>
                        <div className="product-category">{product.category}</div>
                        <div className="product-actions">
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => enableProduct(product)}
                            disabled={updatingProducts.has(product.id)}
                          >
                            {updatingProducts.has(product.id) ? (
                              <>
                                <div className="spinner" style={{
                                  width: '16px',
                                  height: '16px',
                                  border: '2px solid #ffffff',
                                  borderTop: '2px solid transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite',
                                  marginRight: '8px'
                                }}></div>
                                Updating...
                              </>
                            ) : (
                              <>
                                <Eye size={16} />
                                Enable
                              </>
                            )}
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">👻</div>
                    <h4>No Hidden Products</h4>
                    <p>All products are currently active</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Total Products Section - Shows all products with hidden ones greyed out */}
          {activeSection === 'total' && (
            <div className="total-products-section">
              <div className="product-grid">
                {products.length > 0 ? (
                  products.map(product => (
                    <div 
                      key={product.id} 
                      className={`product-card ${!product.is_available ? 'disabled-product' : ''}`}
                    >
                      <div className="product-image">
                        {getImageUrl(product) ? (
                          <img 
                            src={getImageUrl(product)} 
                            alt={product.name}
                            onError={(e) => {
                              console.log('❌ Local image failed, trying external placeholder...');
                              // Try external placeholder image
                              const externalUrl = getExternalImageUrl(product.name);
                              if (externalUrl) {
                                e.target.src = externalUrl;
                                e.target.onerror = null; // Prevent infinite loop
                              } else {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : (
                          // Try external placeholder image directly
                          <img 
                            src={getExternalImageUrl(product.name) || ''} 
                            alt={product.name}
                            onError={(e) => {
                              console.log('❌ External image also failed, showing emoji placeholder');
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        )}
                        <div 
                          className="no-image-placeholder"
                          style={{ 
                            display: 'none', // Will be shown by onError handlers
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
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                              {getPlaceholderImage(product.name)}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '600' }}>
                              {product.name}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="product-info">
                        <div className="product-name">{product.name}</div>
                        <div className="product-description">{product.description}</div>
                        <div className="product-price">₹{product.price}</div>
                        <div className="product-category">{product.category}</div>
                        <div className="product-actions">
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit size={16} />
                            Edit
                          </button>
                          {product.is_available ? (
                            <button 
                              className="btn btn-warning btn-sm"
                              onClick={() => toggleAvailability(product)}
                              disabled={updatingProducts.has(product.id)}
                            >
                              {updatingProducts.has(product.id) ? (
                                <>
                                  <div className="spinner" style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid #ffffff',
                                    borderTop: '2px solid transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    marginRight: '8px'
                                  }}></div>
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <EyeOff size={16} />
                                  Hide
                                </>
                              )}
                            </button>
                          ) : (
                            <button 
                              className="btn btn-success btn-sm"
                              onClick={() => enableProduct(product)}
                              disabled={updatingProducts.has(product.id)}
                            >
                              {updatingProducts.has(product.id) ? (
                                <>
                                  <div className="spinner" style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid #ffffff',
                                    borderTop: '2px solid transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    marginRight: '8px'
                                  }}></div>
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <Eye size={16} />
                                  Enable
                                </>
                                )}
                            </button>
                          )}
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📦</div>
                    <h4>No Products</h4>
                    <p>Add your first product to get started</p>
                    <button 
                      className="btn btn-primary"
                      onClick={() => setShowAddForm(true)}
                    >
                      <Plus size={18} />
                      Add First Product
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
        </>
      )}



      {/* Sales View */}
      {currentView === 'sales' && (
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <button 
              className="btn btn-secondary"
              onClick={handleBackToProducts}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Package size={16} />
              Back to Products
            </button>
            <h2>Sales Report</h2>
          </div>
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '20px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleSalesReport}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#218838';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#28a745';
              }}
            >
              <FileText size={16} />
              Generate Sales Report
            </button>
          </div>
          <AdminOrdersTable onClose={handleCloseOrdersTable} />
        </div>
      )}

      {/* Add/Edit Product Form */}
      {showAddForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content form-card" onClick={(e) => e.stopPropagation()}>
            <div className="form-header">
              <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button className="close-btn" onClick={resetForm}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="admin-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <Package size={16} />
                    Product Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="e.g., Iced Tea"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    <DollarSign size={16} />
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="89.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FileText size={16} />
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="form-textarea"
                  placeholder="Describe the product..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <Package size={16} />
                    Category
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="Beverage">Beverage</option>
                    <option value="Food">Food</option>
                    <option value="Snack">Snack</option>
                    <option value="Dessert">Dessert</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    <ImageIcon size={16} />
                    Image URL
                  </label>
                  <input
                    type="text"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="/images/product-name.jpg"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Save size={18} />
                  {submitting ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sales Report Modal */}
      {showSalesReport && (
        <SalesReport onClose={handleCloseSalesReport} />
      )}

      {/* CSS for loading states and animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
            opacity: 0.1;
          }
          25% {
            transform: translateY(-30px) translateX(20px);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-15px) translateX(-25px);
            opacity: 0.15;
          }
          75% {
            transform: translateY(-40px) translateX(10px);
            opacity: 0.1;
          }
        }
        
        /* Disabled button styles */
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Main content area styling */
        .main-content {
          position: relative;
          z-index: 1;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          margin: 20px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .btn:disabled:hover {
          transform: none;
          box-shadow: none;
        }
        
        /* Spinner styles */
        .spinner {
          display: inline-block;
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
