import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, X, Package, Calendar } from 'lucide-react';
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
  onViewOrder,
  className = '',
  style = {}
}) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Separate state for input display
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to today's date in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [allOrders, setAllOrders] = useState([]); // Store all orders for search functionality
  const [orderDates, setOrderDates] = useState(new Set()); // Store dates with orders for calendar highlighting
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

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

      // Check if there are new orders
      if (previousOrderCount > 0 && sortedOrders.length > previousOrderCount) {
        const newOrdersCount = sortedOrders.length - previousOrderCount;
        console.log(`🆕 OrdersStatusTable: ${newOrdersCount} new order(s) detected!`);
        
        // Show notification for new orders
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #28a745;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          font-size: 14px;
          animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = `🆕 ${newOrdersCount} new order(s) detected!`;
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 300);
          }
        }, 3000);
      }
      
      setAllOrders(sortedOrders); // Store all orders for search functionality
      setOrders(sortedOrders); // This will be filtered by date in applyFilters
      
      // Extract unique dates with orders for calendar highlighting
      const datesWithOrders = new Set();
      sortedOrders.forEach(order => {
        if (order.created_at) {
          const orderDate = new Date(order.created_at).toISOString().split('T')[0];
          datesWithOrders.add(orderDate);
        }
      });
      setOrderDates(datesWithOrders);
      
      setLastUpdated(new Date());
      setPreviousOrderCount(sortedOrders.length);
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

  // Helper function to check if order matches selected date
  const isOrderFromSelectedDate = (order) => {
    const orderDate = new Date(order.created_at).toISOString().split('T')[0];
    return orderDate === selectedDate;
  };

  // Apply filters (date + search + status)
  const applyFilters = () => {
    console.log('🔍 applyFilters called with searchTerm:', searchTerm, 'statusFilter:', statusFilter, 'selectedDate:', selectedDate);
    
    let filtered;
    
    // If search is active, search across ALL orders regardless of date
    if (searchTerm.trim() !== '') {
      console.log('🔍 Applying search filter across all orders for term:', searchTerm);
      filtered = allOrders.filter(order => 
        (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.id && String(order.id).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.order_number && order.order_number.toString().includes(searchTerm)) ||
        (order.status && order.status.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      console.log('🔍 Search results count (from all orders):', filtered.length);
    } else {
      // If no search, filter by selected date first
      console.log('🗓️ Filtering orders for date:', selectedDate);
      filtered = allOrders.filter(isOrderFromSelectedDate);
      console.log('🗓️ Orders for selected date:', filtered.length);
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
      console.log('🔍 After status filter:', filtered.length);
    }
    
    setFilteredOrders(filtered);
    setPaginationInfo({
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / ordersPerPage),
      currentPage: 1
    });
    setCurrentPage(1);
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

  // Date filter functionality
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setCurrentPage(1);
    // applyFilters() will be called by useEffect when selectedDate changes
  };

  // Debounced search - only updates the actual search term after delay
  const debouncedSearch = debounce((value) => {
    console.log('🔍 Debounced search executing with value:', value);
    setSearchTerm(value);
    setCurrentPage(1);
    // applyFilters() will be called by useEffect when searchTerm changes
  }, 300);

  // Get paginated orders
  const getPaginatedOrders = () => {
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    return filteredOrders.slice(startIndex, endIndex);
  };

  // Custom Calendar Component
  const CustomCalendar = () => {
    const currentDate = new Date(calendarViewDate);
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Get first day of the month and number of days
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay();
    
    // Month names
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Generate calendar days
    const calendarDays = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarDays.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calendarDays.push({
        day,
        dateString,
        hasOrders: orderDates.has(dateString),
        isSelected: dateString === selectedDate,
        isToday: dateString === new Date().toISOString().split('T')[0]
      });
    }
    
    const navigateMonth = (direction) => {
      const newDate = new Date(currentYear, currentMonth + direction, 1);
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      const newDateString = `${year}-${month}-${day}`;
      setCalendarViewDate(newDateString);
    };
    
    return (
      <div style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'white',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        padding: '20px',
        zIndex: 1000,
        width: '320px'
      }}>
        {/* Calendar Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => navigateMonth(-1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '18px'
            }}
          >
            ‹
          </button>
          <div style={{
            fontWeight: '600',
            fontSize: '16px',
            color: '#333'
          }}>
            {monthNames[currentMonth]} {currentYear}
          </div>
          <button
            onClick={() => navigateMonth(1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '18px'
            }}
          >
            ›
          </button>
        </div>
        
        {/* Days of week header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
          marginBottom: '8px'
        }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: '600',
              color: '#666',
              padding: '8px 4px'
            }}>
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px'
        }}>
          {calendarDays.map((dayData, index) => (
            <div key={index} style={{
              minHeight: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {dayData && (
                <button
                  onClick={() => {
                    handleDateChange(dayData.dateString);
                    setShowCalendar(false);
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: dayData.isSelected ? '600' : '400',
                    backgroundColor: dayData.isSelected 
                      ? '#007bff' 
                      : dayData.isToday 
                        ? '#e3f2fd' 
                        : dayData.hasOrders 
                          ? '#e8f5e8' 
                          : 'transparent',
                    color: dayData.isSelected 
                      ? 'white' 
                      : dayData.isToday 
                        ? '#1976d2' 
                        : dayData.hasOrders 
                          ? '#2e7d32' 
                          : '#333',
                    border: dayData.hasOrders && !dayData.isSelected 
                      ? '2px solid #4caf50' 
                      : dayData.isToday && !dayData.isSelected 
                        ? '2px solid #2196f3' 
                        : '2px solid transparent',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (!dayData.isSelected) {
                      e.target.style.backgroundColor = dayData.hasOrders ? '#c8e6c9' : '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!dayData.isSelected) {
                      e.target.style.backgroundColor = dayData.isToday 
                        ? '#e3f2fd' 
                        : dayData.hasOrders 
                          ? '#e8f5e8' 
                          : 'transparent';
                    }
                  }}
                >
                  {dayData.day}
                  {dayData.hasOrders && (
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '2px',
                      width: '6px',
                      height: '6px',
                      backgroundColor: dayData.isSelected ? 'white' : '#4caf50',
                      borderRadius: '50%'
                    }} />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div style={{
          marginTop: '16px',
          fontSize: '12px',
          color: '#666',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#e3f2fd',
              border: '2px solid #2196f3',
              borderRadius: '4px'
            }} />
            <span>Today</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#e8f5e8',
              border: '2px solid #4caf50',
              borderRadius: '4px'
            }} />
            <span>Has Orders</span>
          </div>
        </div>
      </div>
    );
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
        return <Package size={16} />;
      default:
        return <Package size={16} />;
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

  // Apply filters when orders or status filter changes
  useEffect(() => {
    if (orders.length > 0) {
      applyFilters();
    }
  }, [orders, statusFilter]);

  // Apply filters when search term changes (for debounced search)
  useEffect(() => {
    if (orders.length > 0) {
      applyFilters();
    }
  }, [searchTerm]);

  // Apply filters when selected date changes
  useEffect(() => {
    if (allOrders.length > 0) {
      applyFilters();
    }
  }, [selectedDate]);

  // Handle clicks outside calendar to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCalendar && !event.target.closest('.calendar-container')) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCalendar]);

  // Auto-refresh orders every 5 minutes (reduced from 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllOrders(true); // true = isRefresh
    }, 300000); // 5 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Refresh when component becomes visible (when user switches back to this tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 OrdersStatusTable: Tab became visible, refreshing orders...');
        fetchAllOrders(true);
      }
    };

    const handleFocus = () => {
      console.log('🔄 OrdersStatusTable: Window focused, refreshing orders...');
      fetchAllOrders(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Listen for order updates from other components
  useEffect(() => {
    const handleOrderUpdate = (event) => {
      if (event.data && event.data.type === 'ORDER_PLACED') {
        console.log('🔄 OrdersStatusTable: Received order update, refreshing...');
        // Show a subtle notification
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #28a745;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          font-size: 14px;
          animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = '🆕 New order detected! Refreshing...';
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
          if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 300);
          }
        }, 3000);
        
        fetchAllOrders(true);
      }
    };

    const handleStorageChange = (event) => {
      if (event.key === 'orderUpdate') {
        try {
          const updateData = JSON.parse(event.newValue);
          if (updateData && updateData.type === 'ORDER_PLACED') {
            console.log('🔄 OrdersStatusTable: Storage change detected, refreshing...');
            fetchAllOrders(true);
          }
        } catch (error) {
          console.error('Error parsing storage update:', error);
        }
      }
    };

    const handleBroadcastMessage = (event) => {
      if (event.data && event.data.type === 'ORDER_PLACED') {
        console.log('🔄 OrdersStatusTable: Broadcast message received, refreshing...');
        fetchAllOrders(true);
      }
    };

    // Method 1: PostMessage listener
    window.addEventListener('message', handleOrderUpdate);
    
    // Method 2: Storage event listener
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
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          
          @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
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

        {/* Date Filter */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e9ecef',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Calendar size={18} style={{ color: '#666' }} />
              <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>View orders for:</span>
            </div>
            <div className="calendar-container" style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  if (!showCalendar) {
                    setCalendarViewDate(selectedDate);
                  }
                  setShowCalendar(!showCalendar);
                }}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minWidth: '140px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#007bff';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0,123,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#ced4da';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <span>{new Date(selectedDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}</span>
                <Calendar size={16} style={{ 
                  color: '#666',
                  transform: showCalendar ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }} />
              </button>
              
              {showCalendar && <CustomCalendar key={calendarViewDate} />}
            </div>
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                handleDateChange(today);
              }}
              style={{
                padding: '8px 16px',
                border: '1px solid #007bff',
                borderRadius: '6px',
                background: selectedDate === new Date().toISOString().split('T')[0] ? '#007bff' : 'white',
                color: selectedDate === new Date().toISOString().split('T')[0] ? 'white' : '#007bff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (selectedDate !== new Date().toISOString().split('T')[0]) {
                  e.target.style.backgroundColor = '#e3f2fd';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedDate !== new Date().toISOString().split('T')[0]) {
                  e.target.style.backgroundColor = 'white';
                }
              }}
            >
              Today
            </button>
          </div>
        </div>

        {/* Status Filter */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e9ecef'
        }}>
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
            value={searchInput}
            onChange={(e) => {
              const value = e.target.value;
              console.log('🔍 Input changed to:', value);
              setSearchInput(value);
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
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                handleSearch('');
              }}
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
            {!searchTerm && (
              <span style={{ marginRight: '16px' }}>
                Date: <strong style={{ color: '#007bff' }}>
                  {new Date(selectedDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </strong>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span style={{ marginRight: '16px' }}>
                Status: <strong style={{ color: getStatusColor(statusFilter) }}>{statusFilter}</strong>
              </span>
            )}
            Showing {filteredOrders.length} of {searchTerm ? allOrders.length : `${allOrders.filter(isOrderFromSelectedDate).length} (${selectedDate})`} total orders
            {lastUpdated && (
              <span style={{ marginLeft: '16px' }}>
                • Last updated: <strong>{lastUpdated.toLocaleTimeString()}</strong>
              </span>
            )}
            {searchTerm && (
              <span style={{ marginLeft: '16px' }}>
                • Search: <strong>"{searchTerm}"</strong> (across all dates)
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Auto-refresh indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: '#28a745',
              padding: '4px 8px',
              backgroundColor: '#d4edda',
              borderRadius: '4px',
              border: '1px solid #c3e6cb'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#28a745',
                animation: 'pulse 2s infinite'
              }}></div>
              Auto-refresh every 30s
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
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Actions</th>
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
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
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
                              ID: {String(order.id).slice(-8)}
                            </div>
                          </div>
                        ) : (
                          `#${String(order.id).slice(-8)}`
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
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          className="btn btn-sm btn-outline"
                          title="View Details"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewOrder && onViewOrder(order);
                          }}
                        >
                          View
                        </button>
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
