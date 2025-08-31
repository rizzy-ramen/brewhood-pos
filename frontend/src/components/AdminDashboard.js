import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './AdminDashboard.css';
import { apiService } from '../services/api';
import LoadingScreen from './LoadingScreen';
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
  LogOut,
  User,
  RefreshCw
} from 'lucide-react';

const AdminDashboard = ({ user, onLogout }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minLoadingComplete, setMinLoadingComplete] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState('active'); // 'active', 'hidden', 'total'
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    category: 'Beverage'
  });

  // Function to get proper image URL or fallback
  const getImageUrl = (product) => {
    if (!product.image_url || product.image_url === '') return null;
    
    // If it's already a full URL, use it
    if (product.image_url.startsWith('http')) {
      return product.image_url;
    }
    
    // If it's a local path, construct the proper URL for Firebase Hosting
    if (product.image_url.startsWith('/images/')) {
      // Use the backend server URL (you'll need to update this to your actual backend URL)
      const backendUrl = 'http://localhost:5000'; // Change this to your actual backend URL
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
      // Fetch ALL products (including hidden) from backend API for admin
      const products = await apiService.getAllProducts();
      console.log('Fetched all products (including hidden) from backend:', products);
      setProducts(products);
    } catch (error) {
      console.error('Failed to fetch all products from backend:', error);
      toast.error('Failed to fetch all products from backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    
    // Set up polling for backend API updates (every 10 seconds)
    const pollInterval = setInterval(() => {
      console.log('🔄 Admin Dashboard - Polling backend for product updates');
      fetchProducts();
    }, 10000); // Poll every 10 seconds

    return () => {
      clearInterval(pollInterval);
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
      // Get the current product data to ensure we have all fields
      const currentProduct = products.find(p => p.id === product.id);
      if (!currentProduct) {
        toast.error('Product not found');
        return;
      }
      
      console.log('🔄 Toggling availability for product:', currentProduct.name, 'Current status:', currentProduct.is_available);
      
      const newStatus = !(currentProduct.is_available === 1 || currentProduct.is_available === true);
      console.log('🔄 New status will be:', newStatus);
      
      // Use the dedicated availability toggle endpoint
      await apiService.toggleProductAvailability(product.id, newStatus);
      toast.success(`Product ${currentProduct.is_available ? 'disabled' : 'enabled'} successfully`);
      
      // Refresh products immediately since we're not using real-time listeners
      await fetchProducts();
      console.log('✅ Product availability updated, products refreshed');
    } catch (error) {
      console.error('❌ Error toggling availability:', error);
      toast.error('Failed to update product availability');
    }
  };

  const enableProduct = async (product) => {
    try {
      // Get the current product data to ensure we have all fields
      const currentProduct = products.find(p => p.id === product.id);
      if (!currentProduct) {
        toast.error('Product not found');
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
    }
  };


    

  if (loading || !minLoadingComplete) {
    return <LoadingScreen />;
  }

  return (
    <div className="container">
      <div className="header">
        <h1 className="header-title">Admin Dashboard</h1>
        <div className="user-info">
          <div className="role-badge admin">Admin</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} />
            <span>{user.username}</span>
          </div>
          <button className="btn btn-secondary" onClick={onLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

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
                          >
                            <EyeOff size={16} />
                            Hide
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
                          >
                            <Eye size={16} />
                            Enable
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
                            >
                              <EyeOff size={16} />
                              Hide
                            </button>
                          ) : (
                            <button 
                              className="btn btn-success btn-sm"
                              onClick={() => enableProduct(product)}
                            >
                              <Eye size={16} />
                              Enable
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




    </div>
  );
};

export default AdminDashboard;
