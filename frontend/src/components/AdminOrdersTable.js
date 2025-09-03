import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, X, Package } from 'lucide-react';
import { apiService } from '../services/api';

// Debounce utility function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

const AdminOrdersTable = ({ 
  onClose,
  className = '',
  style = {}
}) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(20);
  const [paginationInfo, setPaginationInfo] = useState({
    total: 0,
    totalPages: 1,
    currentPage: 1
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [previousOrderCount, setPreviousOrderCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch all orders
  const fetchAllOrders = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await apiService.getOrders('all', 50); // Get up to 50 orders to avoid quota issues
      
      let allOrders = [];
      if (response && response.orders) {
        allOrders = response.orders;
      } else if (Array.isArray(response)) {
        allOrders = response;
      }
      
      // Sort orders by creation date (newest first)
      allOrders.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB - dateA;
      });
      

      setOrders(allOrders);
      setLastUpdated(new Date());
      
      // Check for new orders
      if (previousOrderCount > 0 && allOrders.length > previousOrderCount) {
        const newOrderCount = allOrders.length - previousOrderCount;
        console.log(`🆕 ${newOrderCount} new order(s) detected!`);
      }
      setPreviousOrderCount(allOrders.length);
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      // Show user-friendly error message
      if (typeof window !== 'undefined' && window.toast) {
        window.toast.error('Failed to fetch orders. Please check your connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Apply filters (search only - no status filter)
  const applyFilters = () => {

    let filtered = orders;
    
    // Apply search filter
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(order => 
        order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id && order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_number && order.order_number.toString().includes(searchTerm) ||
        order.status && order.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items && order.items.some(item => 
          item.product_name && item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    

    setFilteredOrders(filtered);
    
    // Update pagination info
    const totalPages = Math.ceil(filtered.length / ordersPerPage);
    setPaginationInfo({
      total: filtered.length,
      totalPages: totalPages,
      currentPage: currentPage > totalPages ? 1 : currentPage
    });
  };

  // Handle search input change (immediate state update for UI)
  const handleSearchInputChange = (searchValue) => {
    setSearchTerm(searchValue);
    setCurrentPage(1);
    setIsSearching(true);
  };

  // Debounced search filter application
  const debouncedApplySearch = debounce(() => {
    setIsSearching(false);
    applyFilters();
  }, 500);

  // Get paginated orders
  const getPaginatedOrders = () => {
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    return filteredOrders.slice(startIndex, endIndex);
  };

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'pending': '#ffc107',
      'preparing': '#28a745',
      'ready': '#007bff',
      'delivered': '#6c757d',
      'cancelled': '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  // Utility function to parse dates from various formats
  const parseOrderDate = (createdAt) => {
    try {
      if (!createdAt) return 'No date';
      
      let date;
      if (createdAt.toDate && typeof createdAt.toDate === 'function') {
        // Firestore Timestamp
        date = createdAt.toDate();
      } else if (createdAt.seconds) {
        // Firestore Timestamp object
        date = new Date(createdAt.seconds * 1000);
      } else if (typeof createdAt === 'string') {
        // ISO string or other string format
        date = new Date(createdAt);
      } else if (createdAt instanceof Date) {
        // Already a Date object
        date = createdAt;
      } else {
        return 'Invalid date';
      }
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.error('Error parsing date:', error, createdAt);
      return 'Invalid date';
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchAllOrders();
  }, []);

  // Apply filters when orders change (immediate)
  useEffect(() => {
    if (orders.length > 0) {
      applyFilters();
    }
  }, [orders]);

  // Apply debounced search when search term changes
  useEffect(() => {
    if (orders.length > 0) {
      debouncedApplySearch();
    }
  }, [searchTerm]);

  // Auto-refresh orders every 5 minutes (reduced from 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllOrders(true); // true = isRefresh
    }, 300000); // 5 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Listen for order updates from other tabs/windows
  useEffect(() => {
    const handleOrderUpdate = (event) => {
      if (event.data && event.data.type === 'ORDER_PLACED') {
        console.log('🔄 AdminOrdersTable: Received order update, refreshing...');
        fetchAllOrders(true);
      }
    };

    const handleStorageChange = (event) => {
      if (event.key === 'orderUpdate') {
        try {
          const updateData = JSON.parse(event.newValue);
          if (updateData && updateData.type === 'ORDER_PLACED') {
            console.log('🔄 AdminOrdersTable: Storage change detected, refreshing...');
            fetchAllOrders(true);
          }
        } catch (error) {
          console.error('Error parsing storage update:', error);
        }
      }
    };

    const handleBroadcastMessage = (event) => {
      if (event.data && event.data.type === 'ORDER_PLACED') {
        console.log('🔄 AdminOrdersTable: Broadcast message received, refreshing...');
        fetchAllOrders(true);
      }
    };

    // Method 1: PostMessage listener
    window.addEventListener('message', handleOrderUpdate);
    
    // Method 2: localStorage listener
    window.addEventListener('storage', handleStorageChange);
    
    // Method 3: BroadcastChannel listener
    if (window.BroadcastChannel) {
      const channel = new BroadcastChannel('orderUpdates');
      channel.addEventListener('message', handleBroadcastMessage);
      
      return () => {
        window.removeEventListener('message', handleOrderUpdate);
        window.removeEventListener('storage', handleStorageChange);
        channel.removeEventListener('message', handleBroadcastMessage);
        channel.close();
      };
    }

    return () => {
      window.removeEventListener('message', handleOrderUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Listen for visibility change to refresh when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 AdminOrdersTable: Tab became visible, refreshing...');
        fetchAllOrders(true);
      }
    };

    const handleFocus = () => {
      console.log('🔄 AdminOrdersTable: Window focused, refreshing...');
      fetchAllOrders(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: '#666', fontSize: '16px' }}>Loading orders...</p>
      </div>
    );
  }

  return (
    <div className={`admin-orders-table ${className}`} style={style}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <h2 style={{ margin: 0, color: '#333' }}>All Orders</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f1f3f4';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e9ecef'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: isSearching ? '#007bff' : '#666'
                }} 
              />
              {isSearching && (
                <div style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#007bff',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  Searching...
                </div>
              )}
              <input
                type="text"
                placeholder="Search orders by customer, order number, status, or product..."
                value={searchTerm}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  border: `1px solid ${isSearching ? '#007bff' : '#ced4da'}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#007bff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#ced4da';
                }}
              />
            </div>

            <button
              onClick={() => fetchAllOrders(true)}
              disabled={refreshing}
              style={{
                padding: '12px',
                border: '1px solid #ced4da',
                borderRadius: '8px',
                background: 'white',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#666',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!refreshing) {
                  e.target.style.backgroundColor = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                if (!refreshing) {
                  e.target.style.backgroundColor = 'white';
                }
              }}
            >
              <RefreshCw 
                size={16} 
                style={{ 
                  animation: refreshing ? 'spin 1s linear infinite' : 'none'
                }} 
              />
              Refresh
            </button>
          </div>

          {/* Results Summary */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '14px',
            color: '#666'
          }}>
            <div style={{
              fontSize: '14px',
              color: '#666'
            }}>
              Showing {filteredOrders.length} of {orders.length} recent orders (limited to avoid quota)
              {lastUpdated && (
                <span style={{ marginLeft: '16px' }}>
                  • Last updated: <strong>{lastUpdated.toLocaleTimeString()}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div style={{ overflowX: 'auto' }}>
          {filteredOrders.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
              <Package size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>{searchTerm ? 'No orders found matching your search' : 'No orders found'}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef', fontWeight: '600', color: '#333' }}>Order ID</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef', fontWeight: '600', color: '#333' }}>Customer</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef', fontWeight: '600', color: '#333' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef', fontWeight: '600', color: '#333' }}>Items</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef', fontWeight: '600', color: '#333' }}>Total</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef', fontWeight: '600', color: '#333' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e9ecef', fontWeight: '600', color: '#333' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {getPaginatedOrders().map(order => (
                  <tr 
                    key={order.id}
                    style={{
                      borderBottom: '1px solid #e9ecef'
                    }}
                  >
                    <td style={{ padding: '12px', fontWeight: '500', color: '#007bff' }}>
                      {order.order_number ? (
                        <div>
                          <div style={{ 
                            fontSize: '16px', 
                            fontWeight: 'bold', 
                            color: '#007bff',
                            textShadow: '0 1px 2px rgba(0,123,255,0.2)',
                            letterSpacing: '0.5px'
                          }}>
                            #{order.order_number}
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#666', 
                            fontStyle: 'italic',
                            marginTop: '2px'
                          }}>
                            ID: {order.id.slice(-8)}
                          </div>
                        </div>
                      ) : (
                        <div>Order #{order.id}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: '500' }}>{order.customer_name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{order.order_type}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: getStatusColor(order.status) + '20',
                        color: getStatusColor(order.status)
                      }}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {order.items ? order.items.length : 0} items
                    </td>
                    <td style={{ padding: '12px', fontWeight: '600', color: '#28a745' }}>
                      ₹{order.total_amount ? order.total_amount.toFixed(2) : '0.00'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                      {parseOrderDate(order.created_at)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        className="btn btn-sm btn-outline"
                        title="View Details"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {paginationInfo.totalPages > 1 && (
          <div style={{
            padding: '20px',
            borderTop: '1px solid #e9ecef',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px'
          }}>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                background: currentPage === 1 ? '#f8f9fa' : 'white',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                color: currentPage === 1 ? '#6c757d' : '#333'
              }}
            >
              Previous
            </button>
            
            {Array.from({ length: paginationInfo.totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  background: currentPage === page ? '#007bff' : 'white',
                  color: currentPage === page ? 'white' : '#333',
                  cursor: 'pointer'
                }}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === paginationInfo.totalPages}
              style={{
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                background: currentPage === paginationInfo.totalPages ? '#f8f9fa' : 'white',
                cursor: currentPage === paginationInfo.totalPages ? 'not-allowed' : 'pointer',
                color: currentPage === paginationInfo.totalPages ? '#6c757d' : '#333'
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AdminOrdersTable;
