import React, { useState, useEffect } from 'react';
import { RefreshCw, Package, Search, X, Clock, CheckCircle } from 'lucide-react';
import { apiService } from '../services/api';

// Debounce utility function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

const OrdersStatusTable = ({ 
  onClose,
  className = '',
  style = {}
}) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(20);
  const [paginationInfo, setPaginationInfo] = useState({
    total: 0,
    totalPages: 1,
    currentPage: 1
  });


  // Fetch all orders
  const fetchAllOrders = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await apiService.getOrders('all', 1000); // Get up to 1000 orders
      
      let allOrders = [];
      if (response && response.orders) {
        allOrders = response.orders;
      } else if (Array.isArray(response)) {
        allOrders = response;
      }





      // Sort by creation time (newest first)
      const sortedOrders = allOrders.sort((a, b) => {
        let timeA, timeB;
        try {
          if (a.created_at?.toDate) {
            timeA = a.created_at.toDate().getTime();
          } else if (a.created_at?.seconds) {
            timeA = a.created_at.seconds * 1000;
          } else if (a.created_at) {
            timeA = new Date(a.created_at).getTime();
          } else {
            timeA = 0;
          }
          
          if (b.created_at?.toDate) {
            timeB = b.created_at.toDate().getTime();
          } else if (b.created_at?.seconds) {
            timeB = b.created_at.seconds * 1000;
          } else if (b.created_at) {
            timeB = new Date(b.created_at).getTime();
          } else {
            timeB = 0;
          }
        } catch (error) {
          timeA = a.created_at || 0;
          timeB = b.created_at || 0;
        }
        
        return timeB - timeA; // Newest first
      });

      setOrders(sortedOrders);
    } catch (error) {
      console.error('❌ Error fetching all orders:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Apply filters (search + status)
  const applyFilters = () => {
    let filtered = orders;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Apply search filter
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(order => 
        order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id && order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_number && order.order_number.toString().includes(searchTerm) ||
        order.customer_id && order.customer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.status && order.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredOrders(filtered);
    setPaginationInfo({
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / ordersPerPage),
      currentPage: 1
    });
  };

  // Search functionality
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    setCurrentPage(1);
    applyFilters();
  };

  // Status filter functionality
  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
    applyFilters();
  };

  // Debounced search
  const debouncedSearch = debounce(handleSearch, 300);

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

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'ready':
        return <Package size={16} />;
      case 'delivered':
        return <CheckCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  // Utility function to parse dates from various formats
  const parseOrderDate = (createdAt) => {
    try {
      if (!createdAt) return 'No date';
      

      
      let date;
      
      // Handle Firestore Timestamp
      if (createdAt?.toDate) {
        date = createdAt.toDate();
      }
      // Handle Firestore Timestamp with seconds
      else if (createdAt?.seconds) {
        date = new Date(createdAt.seconds * 1000);
      }
      // Handle ISO string or other date formats
      else if (typeof createdAt === 'string') {
        date = new Date(createdAt);
      }
      // Handle Date object
      else if (createdAt instanceof Date) {
        date = createdAt;
      }
      // Handle timestamp number
      else if (typeof createdAt === 'number') {
        date = new Date(createdAt);
      }
      else {
        console.warn('Unknown date format:', createdAt, 'type:', typeof createdAt);
        return 'Unknown format';
      }
      
      // Validate the date
      if (isNaN(date.getTime())) {
        console.warn('Invalid date value:', createdAt);
        return 'Invalid date';
      }
      
      return date.toLocaleString();
    } catch (error) {
      console.error('Error parsing date:', createdAt, error);
      return 'Parse error';
    }
  };

  // Fetch orders on component mount
  useEffect(() => {
    fetchAllOrders();
  }, []);

  // Apply filters when orders or filters change
  useEffect(() => {
    if (orders.length > 0) {
      applyFilters();
    }
  }, [orders, statusFilter, searchTerm]);



  return (
    <div 
      className={`orders-status-table ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        zIndex: 1002,
        overflow: 'auto',
        ...style
      }}
    >
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @keyframes dot1 {
            0%, 20% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1.2); }
            60%, 100% { opacity: 0.3; transform: scale(0.8); }
          }
          
          @keyframes dot2 {
            0%, 20% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1.2); }
            60%, 100% { opacity: 0.3; transform: scale(0.8); }
          }
          
          @keyframes dot3 {
            0%, 20% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1.2); }
            60%, 100% { opacity: 0.3; transform: scale(0.8); }
          }
          
          .dot1 { animation-delay: 0s; }
          .dot2 { animation-delay: 0.2s; }
          .dot3 { animation-delay: 0.4s; }
        `}
      </style>

      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e9ecef',
        backgroundColor: '#f8f9fa',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ margin: 0, color: '#333' }}>All Orders Status</h2>
            <h2 style={{ margin: 0, color: '#333' }}>All Orders Status</h2>
          </div>
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

        {/* Status Filter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>Filter by Status:</span>
          {['all', 'pending', 'preparing', 'ready', 'delivered', 'cancelled'].map(status => (
            <button
              key={status}
              onClick={() => handleStatusFilter(status)}
              style={{
                padding: '8px 16px',
                border: '1px solid #ced4da',
                borderRadius: '20px',
                background: statusFilter === status ? getStatusColor(status) : 'white',
                color: statusFilter === status ? 'white' : '#495057',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textTransform: 'capitalize'
              }}
              onMouseEnter={(e) => {
                if (statusFilter !== status) {
                  e.target.style.backgroundColor = '#f8f9fa';
                  e.target.style.borderColor = '#adb5bd';
                }
              }}
              onMouseLeave={(e) => {
                if (statusFilter !== status) {
                  e.target.style.backgroundColor = 'white';
                  e.target.style.borderColor = '#ced4da';
                }
              }}
            >
              {status === 'all' ? 'All Orders' : status}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '500px'
        }}>
          <Search size={20} style={{ color: '#6c757d' }} />
          <input
            type="text"
            placeholder="Search orders by customer name, order ID, customer ID, or status..."
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              debouncedSearch(value);
            }}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #ced4da',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#007bff';
              e.target.style.boxShadow = '0 0 0 3px rgba(0,123,255,0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#ced4da';
              e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}
          />
          {searchTerm && (
            <button
              onClick={() => handleSearch('')}
              style={{
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                background: 'white',
                cursor: 'pointer',
                color: '#6c757d',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f8f9fa';
                e.target.style.borderColor = '#adb5bd';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'white';
                e.target.style.borderColor = '#ced4da';
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Results Info and Refresh */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#666'
          }}>
            {statusFilter !== 'all' && (
              <span style={{ marginRight: '16px' }}>
                Status: <strong style={{ color: getStatusColor(statusFilter) }}>{statusFilter}</strong>
              </span>
            )}
            Showing {filteredOrders.length} of {orders.length} total orders
            {searchTerm && (
              <span style={{ marginLeft: '16px' }}>
                • Search: <strong>"{searchTerm}"</strong>
              </span>
            )}
          </div>
          
          <button
            onClick={() => fetchAllOrders(true)}
            disabled={loading || refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '8px 16px',
              border: '1px solid #ced4da',
              borderRadius: '6px',
              background: 'white',
              cursor: (loading || refreshing) ? 'not-allowed' : 'pointer',
              color: '#6c757d',
              fontSize: '14px',
              transition: 'all 0.2s ease',
              opacity: (loading || refreshing) ? 0.6 : 1,
              minWidth: '100px',
              height: '36px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#f8f9fa';
                e.target.style.borderColor = '#adb5bd';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = 'white';
                e.target.style.borderColor = '#ced4da';
              }
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px'
            }}>
              <RefreshCw 
                size={16} 
                style={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none'
                }}
              />
            </div>
            <span style={{ 
              display: 'inline-block',
              lineHeight: '1'
            }}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {loading && orders.length === 0 ? (
          <div style={{ position: 'relative' }}>
            {/* Blurred dummy table in background */}
            <div style={{ 
              filter: 'blur(2px)',
              opacity: 0.3,
              pointerEvents: 'none'
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Order ID</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Customer</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Type</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Items</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Total</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(8)].map((_, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #e9ecef' }}>
                        <td style={{ padding: '12px', color: '#007bff' }}>#{Math.random().toString(36).substr(2, 8)}</td>
                        <td style={{ padding: '12px' }}>Customer {index + 1}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            backgroundColor: index % 2 === 0 ? '#e3f2fd' : '#f3e5f5',
                            color: index % 2 === 0 ? '#1565c0' : '#7b1fa2'
                          }}>
                            {index % 2 === 0 ? 'takeaway' : 'dine-in'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            backgroundColor: ['#ffc107', '#28a745', '#007bff', '#6c757d'][index % 4] + '20',
                            color: ['#ffc107', '#28a745', '#007bff', '#6c757d'][index % 4]
                          }}>
                            {['pending', 'preparing', 'ready', 'delivered'][index % 4]}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>{Math.floor(Math.random() * 5) + 1} items</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>₹{Math.floor(Math.random() * 500) + 100}</td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>{new Date(Date.now() - Math.random() * 86400000).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Animated loading text overlay */}
            <div style={{ 
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '20px 40px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              zIndex: 10
            }}>
              <div style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#333',
                marginBottom: '8px'
              }}>
                Loading orders
              </div>
                             <div style={{
                 fontSize: '14px',
                 color: '#666',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 gap: '4px'
               }}>
                 <span className="dot1" style={{ animation: 'dot1 1.4s infinite' }}>•</span>
                 <span className="dot2" style={{ animation: 'dot2 1.4s infinite' }}>•</span>
                 <span className="dot3" style={{ animation: 'dot3 1.4s infinite' }}>•</span>
               </div>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            <Package size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <p>{searchTerm ? 'No orders found matching your search' : 'No orders found'}</p>
          </div>
        ) : (
          <>
            {/* Orders Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: '#f8f9fa',
                    borderBottom: '2px solid #dee2e6'
                  }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Order ID</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Customer</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Type</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Items</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Total</th>
                                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedOrders().map(order => (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom: '1px solid #e9ecef',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.parentElement.style.backgroundColor = '#f8f9ff';
                      }}
                      onMouseLeave={(e) => {
                        e.target.parentElement.style.backgroundColor = 'transparent';
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
                          `#${order.id.slice(-8)}`
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>{order.customer_name}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: order.order_type === 'takeaway' ? '#e3f2fd' : '#f3e5f5',
                          color: order.order_type === 'takeaway' ? '#1565c0' : '#7b1fa2'
                        }}>
                          {order.order_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {getStatusIcon(order.status)}
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
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>{order.items.length} items</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                        ₹{order.total_amount}
                      </td>
                      <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                        {parseOrderDate(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {paginationInfo.totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '10px',
                marginTop: '20px',
                padding: '20px 0'
              }}>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                
                <span style={{ fontSize: '14px', color: '#666' }}>
                  Page {currentPage} of {paginationInfo.totalPages}
                </span>
                
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === paginationInfo.totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OrdersStatusTable;
