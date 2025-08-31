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
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(20);
  const [paginationInfo, setPaginationInfo] = useState({
    total: 0,
    totalPages: 1,
    currentPage: 1
  });

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
      setFilteredOrders(sortedOrders);
      setPaginationInfo({
        total: sortedOrders.length,
        totalPages: Math.ceil(sortedOrders.length / ordersPerPage),
        currentPage: 1
      });
    } catch (error) {
      console.error('❌ Error fetching all orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Search functionality
  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue);
    setCurrentPage(1);
    
    if (searchValue.trim() === '') {
      setFilteredOrders(orders);
      setPaginationInfo({
        total: orders.length,
        totalPages: Math.ceil(orders.length / ordersPerPage),
        currentPage: 1
      });
      return;
    }

    const filtered = orders.filter(order => 
      order.customer_name && order.customer_name.toLowerCase().includes(searchValue.toLowerCase()) ||
      order.id && order.id.toLowerCase().includes(searchValue.toLowerCase()) ||
      order.customer_id && order.customer_id.toLowerCase().includes(searchValue.toLowerCase()) ||
      order.status && order.status.toLowerCase().includes(searchValue.toLowerCase())
    );

    setFilteredOrders(filtered);
    setPaginationInfo({
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / ordersPerPage),
      currentPage: 1
    });
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
          <h2 style={{ margin: 0, color: '#333' }}>All Orders Status</h2>
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

        {/* Results Info */}
        <div style={{
          marginTop: '12px',
          fontSize: '14px',
          color: '#666'
        }}>
          Showing {filteredOrders.length} of {orders.length} total orders
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
