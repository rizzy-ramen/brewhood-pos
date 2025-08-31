import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Package, Search, X, Clock, CheckCircle } from 'lucide-react';
import { apiService } from '../services/api';
import { websocketService } from '../services/websocketService';

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
  const [lastUpdate, setLastUpdate] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');

  // Fetch all orders
  const fetchAllOrders = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
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

  // WebSocket real-time updates
  useEffect(() => {
    // Ensure WebSocket connection is established as counter user
    websocketService.connect('counter');
    
    // Check connection status periodically
    const checkConnectionStatus = () => {
      const status = websocketService.getConnectionStatus();
      setWsStatus(status.isConnected ? 'connected' : 'disconnected');
      console.log('🔌 WebSocket status:', status);
    };
    
    // Check immediately and then every 5 seconds
    checkConnectionStatus();
    const intervalId = setInterval(checkConnectionStatus, 5000);
    
    const handleOrderStatusUpdated = (updatedOrder) => {
      console.log('🔄 OrdersStatusTable: Order status updated:', updatedOrder);
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.map(order => 
          order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order
        );
        return updatedOrders;
      });
      setLastUpdate(new Date());
    };

    const handleOrderCreated = (newOrder) => {
      console.log('🆕 OrdersStatusTable: New order created:', newOrder);
      setOrders(prevOrders => {
        // Add new order at the beginning (newest first)
        const updatedOrders = [newOrder, ...prevOrders];
        return updatedOrders;
      });
      setLastUpdate(new Date());
    };

    const handleOrderDeleted = (orderId) => {
      console.log('🗑️ OrdersStatusTable: Order deleted:', orderId);
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
      setLastUpdate(new Date());
    };

    // Subscribe to WebSocket events
    websocketService.on('orderStatusUpdated', handleOrderStatusUpdated);
    websocketService.on('orderCreated', handleOrderCreated);
    websocketService.on('orderDeleted', handleOrderDeleted);

    // Cleanup subscriptions
    return () => {
      clearInterval(intervalId);
      websocketService.off('orderStatusUpdated', handleOrderStatusUpdated);
      websocketService.off('orderCreated', handleOrderCreated);
      websocketService.off('orderDeleted', handleOrderDeleted);
    };
  }, []);

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
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: wsStatus === 'connected' ? '#28a745' : '#dc3545',
              fontWeight: '500'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: wsStatus === 'connected' ? '#28a745' : '#dc3545',
                animation: wsStatus === 'connected' ? 'pulse 2s infinite' : 'none'
              }}></div>
              {wsStatus === 'connected' ? 'Live Updates' : 'WebSocket Disconnected'}
              {lastUpdate && wsStatus === 'connected' && (
                <span style={{ 
                  fontSize: '11px', 
                  color: '#666', 
                  marginLeft: '8px',
                  fontWeight: 'normal'
                }}>
                  • Last update: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
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
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={fetchAllOrders}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                background: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#6c757d',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.6 : 1
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
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            
            <button
              onClick={() => {
                const status = websocketService.getConnectionStatus();
                console.log('🔌 WebSocket Status:', status);
                alert(`WebSocket Status: ${status.isConnected ? 'Connected' : 'Disconnected'}\nSocket ID: ${status.socketId || 'None'}\nReconnect Attempts: ${status.reconnectAttempts}`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                background: 'white',
                cursor: 'pointer',
                color: '#6c757d',
                fontSize: '14px',
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
              🔌 WS Status
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            <RefreshCw size={48} className="animate-spin" style={{ opacity: 0.7, marginBottom: '16px' }} />
            <p>Loading orders...</p>
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
                        #{order.id.slice(-8)}
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
