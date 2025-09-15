import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Package, CheckCircle, User, LogOut, Clock, RefreshCw, X, Search } from 'lucide-react';
import { apiService } from '../services/api';
import websocketService from '../services/websocketService';
import LoadingScreen from './LoadingScreen';

// Import the new smaller components
import SearchBar from './SearchBar';
import OrdersTable from './OrdersTable';
import FilterTabs from './FilterTabs';
import OrderCard from './OrderCard';


// Debounce utility function (Google-style search delay)
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

const DeliveryDashboard = ({ user, onLogout }) => {
  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [minLoadingComplete, setMinLoadingComplete] = useState(false);
  const [filter, setFilter] = useState('pending');
  const filterRef = useRef(filter);
  
  // Keep ref updated with current filter value
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);
  const [notifications, setNotifications] = useState({
    pending: 0,
    preparing: 0,
    ready: 0,
    delivered: 0
  });
  const [showRefreshNotification, setShowRefreshNotification] = useState(false);
  const [viewedSections, setViewedSections] = useState(new Set());
  const [updateTimeout, setUpdateTimeout] = useState(null);
  const [websocketStatus, setWebsocketStatus] = useState('connecting');
  const [updatingOrders, setUpdatingOrders] = useState(new Set()); // Track orders being updated
  const [isSectionLoading, setIsSectionLoading] = useState(false); // Track if current section is loading
  
  // Pagination and search state for delivered orders
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [paginationInfo, setPaginationInfo] = useState({
    total: 0,
    totalPages: 1,
    currentPage: 1
  });
  const [pageCursors, setPageCursors] = useState({});
  const pageCursorsRef = useRef({}); // Store cursors for each page

  // Set minimum loading time for better UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingComplete(true);
    }, 3000); // Show loading screen for at least 3 seconds

    return () => clearTimeout(timer);
  }, []);

  // Mark a section as viewed and clear its notifications
  const markSectionAsViewed = useCallback((status) => {
    if (status !== 'all') {
      setViewedSections(prev => new Set([...prev, status]));
      setNotifications(prev => ({
        ...prev,
        [status]: 0
      }));
    }
  }, []);

  // Calculate notifications based on current orders
  const calculateNotifications = useCallback((orders) => {
    const counts = {
      pending: 0,
      preparing: 0,
      ready: 0,
      delivered: 0
    };
    
    orders.forEach(order => {
      if (counts.hasOwnProperty(order.status)) {
        counts[order.status]++;
      }
    });
    
    // Only show notifications for sections that haven't been viewed yet
    const smartCounts = { ...counts };
    
    // Clear notifications for current filter (user is already viewing this section)
    if (filterRef.current !== 'all') {
      smartCounts[filterRef.current] = 0;
    }
    
    setNotifications(prev => {
      const hasChanged = JSON.stringify(prev) !== JSON.stringify(smartCounts);
      if (hasChanged) {
        return smartCounts;
      }
      return prev;
    });
  }, [filter]);

  const fetchOrders = useCallback(async (currentFilter = filter) => {
    try {
      console.log('🔄 fetchOrders called with filter:', currentFilter);
      setIsSectionLoading(true);
      
      const response = await apiService.getOrders(currentFilter, 1);
      
      if (response && response.orders) {
        console.log(`✅ Fetched ${response.orders.length} orders for filter: ${currentFilter}`);
        setOrders(response.orders);
        
        // Calculate notifications for all orders
        calculateNotifications(response.orders);
        
        // For delivered orders, also set up pagination
        if (currentFilter === 'delivered') {
          setFilteredOrders([]); // Clear search results
          setPaginationInfo({
            total: response.orders.length,
            totalPages: Math.ceil(response.orders.length / ordersPerPage),
            currentPage: 1
          });
        }
      } else {
        console.log(`❌ No orders found for filter: ${currentFilter}`);
        setOrders([]);
        calculateNotifications([]);
      }
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      toast.error('Failed to fetch orders');
      setOrders([]);
      calculateNotifications([]);
    } finally {
      setIsSectionLoading(false);
    }
  }, [filter, calculateNotifications, ordersPerPage]);

  // Initialize orders on component mount
  useEffect(() => {
    fetchOrders(filter);
  }, [fetchOrders, filter]);

  // WebSocket event handlers
  const handleProductUpdated = useCallback(() => {
    setShowRefreshNotification(true);
    toast('🔄 Menu has been updated by admin. Please refresh to see changes.', { duration: 4000 });
  }, []);

  const handleProductCreated = useCallback(() => {
    setShowRefreshNotification(true);
    toast('🆕 New product added by admin. Please refresh to see changes.', { duration: 4000 });
  }, []);

  const handleProductDeleted = useCallback(() => {
    setShowRefreshNotification(true);
    toast('🗑️ Product removed by admin. Please refresh to see changes.', { duration: 4000 });
  }, []);

  // Debounced update function to prevent too many rapid updates
  const debouncedUpdate = useCallback((updateFn, delay = 100) => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    
    const timeout = setTimeout(() => {
      updateFn();
      setUpdateTimeout(null);
    }, delay);
    
    setUpdateTimeout(timeout);
  }, [updateTimeout]);

  // WebSocket connection and event handling
  useEffect(() => {
    const connectWebSocket = async () => {
      console.log('🔌 DeliveryDashboard: Connecting to WebSocket...');
      try {
        await websocketService.connect();
        console.log('✅ DeliveryDashboard: WebSocket connected');
        
        // Register as delivery dashboard
        await websocketService.registerDashboard('delivery');
        console.log('✅ DeliveryDashboard: Registered as delivery dashboard');
        
        // Set up event listeners
        websocketService.on('orderPlaced', (order) => {
          console.log('🚨 New order placed:', order);
          // Immediately fetch latest orders for the current filter
          fetchOrders(filter);
        });
        
        websocketService.on('orderStatusUpdated', (data) => {
          console.log('🔄 Order status updated:', data);
          // Don't call calculateNotifications here as it would overwrite the WebSocket increment
          // Just update the orders list
          fetchOrders(filter);
        });
        
        websocketService.on('productUpdated', handleProductUpdated);
        websocketService.on('productCreated', handleProductCreated);
        websocketService.on('productDeleted', handleProductDeleted);
        
        // Listen for order updates via BroadcastChannel
        const channel = new BroadcastChannel('orderUpdates');
        const handleOrderUpdate = (event) => {
          if (event.data && event.data.type === 'ORDER_PLACED') {
            console.log('🚨 Immediate order update received:', event.data.order);
            // Immediately fetch latest orders
            fetchOrders(filter);
          }
        };
        
        channel.addEventListener('message', handleOrderUpdate);
        
        // Listen for storage changes (fallback)
        const handleStorageChange = (event) => {
          if (event.key === 'orderUpdate' && event.newValue) {
            console.log('🚨 Order update via storage detected');
            const orderData = JSON.parse(event.newValue);
            // Immediately fetch latest orders
            fetchOrders(filter);
          }
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        // Cleanup function
        return () => {
          console.log('🔌 Cleaning up WebSocket listeners for DeliveryDashboard...');
          websocketService.off('orderPlaced');
          websocketService.off('orderStatusUpdated');
          websocketService.off('productUpdated', handleProductUpdated);
          websocketService.off('productCreated', handleProductCreated);
          websocketService.off('productDeleted', handleProductDeleted);
          channel.removeEventListener('message', handleOrderUpdate);
          window.removeEventListener('storage', handleStorageChange);
        };
      } catch (error) {
        console.error('❌ WebSocket connection failed:', error);
        setWebsocketStatus('disconnected');
      }
    };

    connectWebSocket();
  }, [filter, fetchOrders, handleProductUpdated, handleProductCreated, handleProductDeleted]);

  // Update WebSocket status
  useEffect(() => {
    const updateWebSocketStatus = () => {
      const status = websocketService.getConnectionStatus();
      setWebsocketStatus(status.isConnected ? 'connected' : 'disconnected');
    };

    updateWebSocketStatus();
    const interval = setInterval(updateWebSocketStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateOrderStatus = async (orderId, status) => {
    try {
      // Set loading state for this order
      setUpdatingOrders(prev => new Set([...prev, orderId]));
      
      console.log(`🔄 Updating order ${orderId} to status: ${status}`);
      
      const response = await apiService.updateOrderStatus(orderId, status);
      
      if (response && response.success) {
        console.log(`✅ Order ${orderId} updated to ${status}`);
        toast.success(`Order ${orderId} marked as ${status}`);
        
        // Update local state immediately
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId 
              ? { ...order, status, updated_at: new Date().toISOString() }
              : order
          )
        );
        
        // Clear notifications for the section that was updated
        clearSectionNotifications(filter);
      } else {
        throw new Error(response?.error || 'Failed to update order status');
      }
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      toast.error(`Failed to update order: ${error.message}`);
    } finally {
      // Remove loading state for this order
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const markOrderDelivered = async (orderId) => {
    await updateOrderStatus(orderId, 'delivered');
  };

  const handleFilterChange = (newFilter) => {
    // Mark the previous filter as viewed
    if (filter !== 'all') {
      markSectionAsViewed(filter);
    }
    
    console.log(`🔄 Filter changed from ${filter} to ${newFilter}`);
    setFilter(newFilter);
    setCurrentPage(1); // Reset to first page when changing filters
    
    // Clear search when switching away from delivered
    if (newFilter !== 'delivered') {
      setSearchTerm('');
      setFilteredOrders([]);
    }
    
    // Fetch orders for the new filter
    fetchOrders(newFilter);
  };

  const updateItemPreparedCount = (orderId, itemId, newQuantity) => {
    // Immediate UI update - no delays, no flags
    setOrders(prevOrders => 
      prevOrders.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            items: order.items.map(item => 
              item.id === itemId 
                ? { ...item, prepared_count: newQuantity }
                : item
            )
          };
        }
        return order;
      })
    );
    
    // Clear notifications for the section that was updated
    clearSectionNotifications(filter);
  };

  const calculatePreparationProgress = (items) => {
    if (!items || items.length === 0) return 0;
    
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const preparedItems = items.reduce((sum, item) => sum + (item.prepared_count || 0), 0);
    
    return totalItems === 0 ? 0 : Math.round((preparedItems / totalItems) * 100);
  };

  // Pagination and search functions for delivered orders
  const handleSearch = useCallback((searchValue) => {
    console.log(`🔍 handleSearch called with: "${searchValue}"`);
    console.log(`🔍 Current filter: "${filter}"`);
    console.log(`🔍 Total orders available: ${orders.length}`);
    
    setSearchTerm(searchValue);
    setCurrentPage(1); // Reset to first page when searching
    
    if (filter === 'delivered') {
      console.log(`🔍 Client-side search for: "${searchValue}" in delivered orders`);
      
      if (searchValue.trim() === '') {
        console.log(`🔍 Empty search - clearing filtered results`);
        // If search is empty, clear filtered results and show normal pagination
        setFilteredOrders([]);
        return;
      }
      
      console.log(`🔍 Starting client-side filtering...`);
      console.log(`🔍 Orders to search through:`, orders.map(o => ({
        id: o.id,
        customer_name: o.customer_name,
        order_number: o.order_number,
        contact_number: o.contact_number,
        order_type: o.order_type,
        status: o.status
      })));
      
      // Use client-side filtering (same logic as OrdersStatusTable)
      const filtered = orders.filter(order => {
        const searchLower = searchValue.toLowerCase();
        const customerMatch = order.customer_name && order.customer_name.toLowerCase().includes(searchLower);
        const idMatch = order.id && String(order.id).toLowerCase().includes(searchLower);
        const orderNumberMatch = order.order_number && order.order_number.toString().includes(searchValue);
        const contactMatch = order.contact_number && order.contact_number.includes(searchValue);
        const typeMatch = order.order_type && order.order_type.toLowerCase().includes(searchLower);
        const statusMatch = order.status && order.status.toLowerCase().includes(searchLower);
        
        const isMatch = customerMatch || idMatch || orderNumberMatch || contactMatch || typeMatch || statusMatch;
        
        if (isMatch) {
          console.log(`🔍 MATCH FOUND:`, {
            id: order.id,
            customer_name: order.customer_name,
            order_number: order.order_number,
            contact_number: order.contact_number,
            order_type: order.order_type,
            status: order.status,
            matches: {
              customer: customerMatch,
              id: idMatch,
              orderNumber: orderNumberMatch,
              contact: contactMatch,
              type: typeMatch,
              status: statusMatch
            }
          });
        }
        
        return isMatch;
      });
      
      console.log(`🔍 Client-side search results: ${filtered.length} orders found`);
      console.log(`🔍 Filtered orders:`, filtered.map(o => ({
        id: o.id,
        customer_name: o.customer_name,
        order_number: o.order_number,
        contact_number: o.contact_number,
        order_type: o.order_type,
        status: o.status
      })));
      
      // Update filtered orders with search results
      setFilteredOrders(filtered);
      
      // Update pagination info for search results
      setPaginationInfo({
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / ordersPerPage),
        currentPage: 1
      });
      
      console.log(`🔍 Updated pagination info:`, {
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / ordersPerPage),
        currentPage: 1
      });
    } else {
      console.log(`🔍 Not in delivered filter, skipping search`);
    }
  }, [filter, orders, ordersPerPage]);

  // Google-style real-time search with debouncing
  const handleRealTimeSearch = useCallback((searchValue) => {
    console.log(`🔍 handleRealTimeSearch called with: "${searchValue}"`);
    console.log(`🔍 Current filter: "${filter}"`);
    console.log(`🔍 Total orders available: ${orders.length}`);
    
    setSearchTerm(searchValue);
    setCurrentPage(1); // Reset to first page when searching
    
    if (filter === 'delivered') {
      console.log(`🔍 Real-time client-side search for: "${searchValue}" in delivered orders`);
      
      if (searchValue.trim() === '') {
        console.log(`🔍 Empty real-time search - clearing filtered results`);
        // If search is empty, clear filtered results and show normal pagination
        setFilteredOrders([]);
        return;
      }
      
      console.log(`🔍 Starting real-time client-side filtering...`);
      console.log(`🔍 Orders to search through:`, orders.map(o => ({
        id: o.id,
        customer_name: o.customer_name,
        order_number: o.order_number,
        contact_number: o.contact_number,
        order_type: o.order_type,
        status: o.status
      })));
      
      // Use client-side filtering (same logic as handleSearch)
      const filtered = orders.filter(order => {
        const searchLower = searchValue.toLowerCase();
        const customerMatch = order.customer_name && order.customer_name.toLowerCase().includes(searchLower);
        const idMatch = order.id && String(order.id).toLowerCase().includes(searchLower);
        const orderNumberMatch = order.order_number && order.order_number.toString().includes(searchValue);
        const contactMatch = order.contact_number && order.contact_number.includes(searchValue);
        const typeMatch = order.order_type && order.order_type.toLowerCase().includes(searchLower);
        const statusMatch = order.status && order.status.toLowerCase().includes(searchLower);
        
        const isMatch = customerMatch || idMatch || orderNumberMatch || contactMatch || typeMatch || statusMatch;
        
        if (isMatch) {
          console.log(`🔍 REAL-TIME MATCH FOUND:`, {
            id: order.id,
            customer_name: order.customer_name,
            order_number: order.order_number,
            contact_number: order.contact_number,
            order_type: order.order_type,
            status: order.status,
            matches: {
              customer: customerMatch,
              id: idMatch,
              orderNumber: orderNumberMatch,
              contact: contactMatch,
              type: typeMatch,
              status: statusMatch
            }
          });
        }
        
        return isMatch;
      });
      
      console.log(`🔍 Real-time client-side search results: ${filtered.length} orders found`);
      console.log(`🔍 Real-time filtered orders:`, filtered.map(o => ({
        id: o.id,
        customer_name: o.customer_name,
        order_number: o.order_number,
        contact_number: o.contact_number,
        order_type: o.order_type,
        status: o.status
      })));
      
      // Update filtered orders with search results
      setFilteredOrders(filtered);
      
      // Update pagination info for search results
      setPaginationInfo({
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / ordersPerPage),
        currentPage: 1
      });
      
      console.log(`🔍 Updated real-time pagination info:`, {
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / ordersPerPage),
        currentPage: 1
      });
    } else {
      console.log(`🔍 Not in delivered filter, skipping real-time search`);
    }
  }, [filter, orders, ordersPerPage]);

  // Debounced search function (Google-style)
  const debouncedSearch = useCallback(
    debounce((searchValue) => {
      handleRealTimeSearch(searchValue);
    }, 300), // Wait 300ms after user stops typing (like Google)
    [handleRealTimeSearch]
  );

  // Separate function to fetch orders with specific page
  const fetchOrdersWithPage = useCallback(async (currentFilter, pageNumber) => {
    try {
      console.log('🔄 fetchOrdersWithPage called with filter:', currentFilter, 'page:', pageNumber);
      setIsSectionLoading(true);
      
      const response = await apiService.getOrders(currentFilter, pageNumber);
      
      if (response && response.orders) {
        console.log(`✅ Fetched ${response.orders.length} orders for filter: ${currentFilter}, page: ${pageNumber}`);
        setOrders(response.orders);
        
        // Update pagination info
        setPaginationInfo({
          total: response.total || response.orders.length,
          totalPages: response.totalPages || Math.ceil((response.total || response.orders.length) / ordersPerPage),
          currentPage: pageNumber
        });
        
        // Store cursor for this page
        if (response.cursor) {
          setPageCursors(prev => ({
            ...prev,
            [pageNumber]: response.cursor
          }));
          pageCursorsRef.current[pageNumber] = response.cursor;
        }
        
        // Calculate notifications for all orders
        calculateNotifications(response.orders);
      } else {
        console.log(`❌ No orders found for filter: ${currentFilter}, page: ${pageNumber}`);
        setOrders([]);
        calculateNotifications([]);
      }
    } catch (error) {
      console.error('❌ Error fetching orders with page:', error);
      toast.error('Failed to fetch orders');
      setOrders([]);
      calculateNotifications([]);
    } finally {
      setIsSectionLoading(false);
    }
  }, [calculateNotifications, ordersPerPage]);

  // Dynamic fetch function that handles both regular and paginated requests
  const fetchOrdersDynamic = useCallback(async (currentFilter = filter) => {
    try {
      console.log('🔄 fetchOrdersDynamic called with filter:', currentFilter);
      setIsSectionLoading(true);
      
      // For delivered orders, use pagination
      if (currentFilter === 'delivered') {
        await fetchOrdersWithPage(currentFilter, currentPage);
      } else {
        // For other filters, use regular fetch
        await fetchOrders(currentFilter);
      }
    } catch (error) {
      console.error('❌ Error in fetchOrdersDynamic:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setIsSectionLoading(false);
    }
  }, [filter, currentPage, fetchOrders, fetchOrdersWithPage]);

  // Handle page changes for delivered orders
  const handlePageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
    // Fetch orders for the new page
    if (filter === 'delivered') {
      fetchOrdersWithPage(filter, pageNumber);
    }
  }, [filter, fetchOrdersWithPage]);

  // Get paginated orders for display
  const getPaginatedOrders = useCallback(() => {
    if (filter !== 'delivered') return orders;
    
    // If we have search results, use those
    if (searchTerm && filteredOrders.length > 0) {
      const startIndex = (currentPage - 1) * ordersPerPage;
      const endIndex = startIndex + ordersPerPage;
      const validResults = filteredOrders.filter(order => 
        order && 
        order.id &&
        order.customer_name &&
        order.items &&
        Array.isArray(order.items)
      );
      return validResults.slice(startIndex, endIndex);
    }
    
    // Otherwise, use regular orders
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const validResults = orders.filter(order => 
      order && 
      order.id &&
      order.customer_name &&
      order.items &&
      Array.isArray(order.items)
    );
    return validResults.slice(startIndex, endIndex);
  }, [filter, orders, searchTerm, filteredOrders, currentPage, ordersPerPage]);

  if (loading || !minLoadingComplete) {
    return <LoadingScreen />;
  }

  return (
    <div className="container" style={{
      background: 'linear-gradient(135deg, #7abbca 0%, #5a9bb8 25%, #4a8ba8 50%, #3a7b98 75%, #2a6b88 100%)',
      minHeight: '100vh',
      position: 'relative'
    }}>
      <style>
        {`
          @keyframes bounce {
            0%, 80%, 100% { 
              transform: scale(0);
              opacity: 0.5;
            }
            40% { 
              transform: scale(1);
              opacity: 1;
            }
          }
          
          @keyframes float {
            0%, 100% { 
              transform: translateY(0px) rotate(0deg);
              opacity: 0.7;
            }
            50% { 
              transform: translateY(-20px) rotate(180deg);
              opacity: 1;
            }
          }
          
          .floating-element {
            position: absolute;
            border-radius: 50%;
            animation: float 6s ease-in-out infinite;
            pointer-events: none;
            z-index: 1;
          }
          
          .floating-element:nth-child(1) {
            width: 80px;
            height: 80px;
            background: rgba(122, 187, 202, 0.3);
            top: 10%;
            left: 10%;
            animation-delay: 0s;
          }
          
          .floating-element:nth-child(2) {
            width: 120px;
            height: 120px;
            background: rgba(90, 155, 184, 0.2);
            top: 20%;
            right: 15%;
            animation-delay: 2s;
          }
          
          .floating-element:nth-child(3) {
            width: 60px;
            height: 60px;
            background: rgba(74, 139, 168, 0.4);
            bottom: 20%;
            left: 20%;
            animation-delay: 4s;
          }
          
          .floating-element:nth-child(4) {
            width: 100px;
            height: 100px;
            background: rgba(58, 123, 152, 0.3);
            bottom: 30%;
            right: 25%;
            animation-delay: 1s;
          }
        `}
      </style>
      
      {/* Animated Background Elements */}
      <div className="floating-element"></div>
      <div className="floating-element"></div>
      <div className="floating-element"></div>
      <div className="floating-element"></div>
      
      <div className="header" style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '12px',
        marginBottom: '20px',
        position: 'relative',
        zIndex: 10
      }}>
        <h1 className="header-title" style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Delivery Dashboard</h1>
        <div className="user-info">
          <div className="role-badge" style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>Delivery</div>
          
          {/* WebSocket Status Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded-lg text-sm mr-3" style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div className={`w-2 h-2 rounded-full ${
              websocketStatus === 'connected' ? 'bg-green-500' : 
              websocketStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className={`${
              websocketStatus === 'connected' ? 'text-green-200' : 
              websocketStatus === 'connecting' ? 'text-yellow-200' : 'text-red-200'
            }`}>
              {websocketStatus === 'connected' ? 'Real-time' : 
               websocketStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
            <User size={18} />
            <span>{user.username}</span>
          </div>
          <button className="btn btn-secondary" onClick={onLogout} style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* Backend Status Info - Now handled by global indicator */}
      <div style={{ 
        padding: '12px', 
        marginBottom: '20px', 
        borderRadius: '8px', 
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: 'white',
        fontSize: '14px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 10
      }}>
        <span>🌐 Backend Status: Check the indicator in the top-right corner</span>
      </div>

      <div className="delivery-main-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', position: 'relative', zIndex: 10 }}>
        <div>
          {/* Filter Tabs - Now using the new component */}
          <FilterTabs 
            filter={filter}
            handleFilterChange={handleFilterChange}
            notifications={notifications}
            isSectionLoading={isSectionLoading}
          />

          {/* Orders List */}
          <div className="card" style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                Orders ({filter === 'delivered' ? (searchTerm ? filteredOrders.length : orders.length) : orders.length})
              </h3>
              <button 
                className="btn btn-sm btn-outline"
                onClick={() => fetchOrders(filter)}
                disabled={isSectionLoading}
                title="Refresh orders"
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}
              >
                <RefreshCw size={16} className={isSectionLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
            
            <div>
              {filter === 'delivered' ? (
                // Table view for delivered orders - Using the new OrdersTable component
                <div>
                  {/* Search Bar - Using the new SearchBar component */}
                  <SearchBar 
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    debouncedSearch={debouncedSearch}
                    handleSearch={handleSearch}
                    filteredOrders={filteredOrders}
                    isSectionLoading={isSectionLoading}
                  />

                  {/* Orders Table - Using the new OrdersTable component */}
                  <OrdersTable 
                    orders={orders}
                    searchTerm={searchTerm}
                    filteredOrders={filteredOrders}
                    isSectionLoading={isSectionLoading}
                    getPaginatedOrders={getPaginatedOrders}
                    currentPage={currentPage}
                    paginationInfo={paginationInfo}
                    ordersPerPage={ordersPerPage}
                    handlePageChange={handlePageChange}
                  />
                </div>
              ) : (
                // Regular card view for other sections - Using the new OrderCard component
                <div className="order-list">
                  {isSectionLoading ? (
                    // Simple loading animation for non-delivered sections
                    <div style={{ 
                      padding: '60px 20px',
                      textAlign: 'center',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '500',
                        marginBottom: '16px',
                        color: 'white',
                        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}>
                        Loading {filter} orders
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255, 255, 255, 0.8)',
                          animation: 'bounce 1.4s infinite ease-in-out'
                        }}></div>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255, 255, 255, 0.8)',
                          animation: 'bounce 1.4s infinite ease-in-out',
                          animationDelay: '0.2s'
                        }}></div>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255, 255, 255, 0.8)',
                          animation: 'bounce 1.4s infinite ease-in-out',
                          animationDelay: '0.4s'
                        }}></div>
                      </div>
                    </div>
                  ) : orders.length === 0 ? (
                    // Empty state
                    <div style={{ 
                      padding: '40px', 
                      textAlign: 'center', 
                      color: 'rgba(255, 255, 255, 0.8)' 
                    }}>
                      <Package size={48} style={{ opacity: 0.6, marginBottom: '16px', color: 'white' }} />
                      <p style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>No {filter} orders found</p>
                    </div>
                  ) : (
                    // Actual orders
                    orders.map(order => (
                      <OrderCard 
                        key={order.id}
                        order={order}
                        updateOrderStatus={updateOrderStatus}
                        markOrderDelivered={markOrderDelivered}
                        updateItemPreparedCount={updateItemPreparedCount}
                        calculatePreparationProgress={calculatePreparationProgress}
                        updatingOrders={updatingOrders}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Notification Popup */}
      {showRefreshNotification && (
        <div className="refresh-notification" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          padding: '20px',
          zIndex: 1000,
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <div className="refresh-notification-content" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <RefreshCw size={20} className="refresh-icon" style={{ color: 'white', marginTop: '2px' }} />
            <div className="refresh-text" style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>🔄 Menu Updated</h4>
              <p style={{ margin: '0 0 16px 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>Admin has made changes to the menu. Please refresh to see the latest items.</p>
              <div className="refresh-actions" style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-primary refresh-page-btn"
                  onClick={() => window.location.reload()}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={16} />
                  Refresh Page
                </button>
                <button 
                  className="btn btn-secondary dismiss-btn"
                  onClick={() => setShowRefreshNotification(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button 
              className="refresh-close-btn"
              onClick={() => setShowRefreshNotification(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryDashboard;