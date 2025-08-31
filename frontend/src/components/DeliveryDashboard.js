import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Package, CheckCircle, User, LogOut, Clock, RefreshCw, X, Search } from 'lucide-react';
import { apiService } from '../services/api';
import websocketService from '../services/websocketService';
import LoadingScreen from './LoadingScreen';

const DeliveryDashboard = ({ user, onLogout }) => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
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
    if (filter !== 'all') {
      smartCounts[filter] = 0;
    }
    
    // Clear notifications for sections that have been viewed
    viewedSections.forEach(viewedSection => {
      smartCounts[viewedSection] = 0;
    });
    
    // Only update notifications if they've actually changed to prevent flickering
    setNotifications(prev => {
      const hasChanged = JSON.stringify(prev) !== JSON.stringify(smartCounts);
      if (hasChanged) {
        return smartCounts;
      }
      return prev;
    });
  }, []); // Removed dependencies to prevent constant recreation

  // Fetch orders function with stable state management
  const fetchOrders = useCallback(async (currentFilter = filter) => {
    try {
      console.log('🔄 fetchOrders called with filter:', currentFilter);
      console.log('🔄 Original filter value:', filter);
      console.log('🔄 Current filter parameter:', currentFilter);
      console.log('🔄 Filter values match?', filter === currentFilter);
      
      // Set section loading state
      setIsSectionLoading(true);
      
      // Use pagination for delivered orders, regular fetch for others
      let response;
      if (currentFilter === 'delivered') {
        // For delivered orders, use fetchOrdersWithPage to ensure cursor storage
        // But only if we're not already in fetchOrdersWithPage to prevent recursion
        if (currentPage === 1) {
          // For page 1, fetch directly and store cursor
          response = await apiService.getOrders(currentFilter, ordersPerPage, currentPage);
          
          // Store cursor for page 2 if we have a response
          if (response && response.lastDocumentId) {
            const newCursors = {
              ...pageCursorsRef.current,
              1: response.lastDocumentId
            };
            setPageCursors(newCursors);
            pageCursorsRef.current = newCursors;
            console.log(`💾 fetchOrders: Stored cursor for page 2:`, response.lastDocumentId);
          }
        } else {
          // For other pages, use fetchOrdersWithPage
          await fetchOrdersWithPage(currentFilter, currentPage);
          return; // Exit early since fetchOrdersWithPage handles everything
        }
      } else {
        response = await apiService.getOrders(currentFilter);
      }
      
      console.log('📡 API response received:', response);
      
      // Extract orders from the response structure
      let orders;
      if (response && response.orders) {
        // Backend returns {success: true, orders: [...], count: X}
        orders = response.orders;
        console.log('📦 Extracted orders from response.orders:', orders?.length || 0, 'orders');
      } else if (Array.isArray(response)) {
        // Direct array response
        orders = response;
        console.log('📦 Direct array response:', orders?.length || 0, 'orders');
      } else {
        // Fallback
        orders = [];
        console.log('⚠️ No orders found in response, using empty array');
      }
      
      console.log('📡 Final orders data:', orders);
      
      // Only update if we actually got orders (prevent clearing on error)
      if (orders && orders.length >= 0) {
        // Sort orders by creation time (oldest first, newest last)
        const sortedOrders = orders.sort((a, b) => {
          let timeA, timeB;
          
          try {
            // Handle Firestore Timestamp objects
            if (a.created_at?.toDate) {
              timeA = a.created_at.toDate().getTime();
            } else if (a.created_at?.seconds) {
              timeA = a.created_at.seconds * 1000;
            } else if (a.created_at) {
              timeA = new Date(a.created_at).getTime();
            } else {
              timeA = 0; // Fallback for orders without timestamp
            }
            
            if (b.created_at?.toDate) {
              timeB = b.created_at.toDate().getTime();
            } else if (b.created_at?.seconds) {
              timeB = b.created_at.seconds * 1000;
            } else if (b.created_at) {
              timeB = new Date(b.created_at).getTime();
            } else {
              timeB = 0; // Fallback for orders without timestamp
            }
          } catch (error) {
            console.warn('⚠️ Error parsing timestamps, using fallback sorting');
            timeA = a.created_at || 0;
            timeB = b.created_at || 0;
          }
          
          // Ascending order: oldest first (FIFO - First In, First Out)
          return timeA - timeB;
        });
        
        // Calculate notifications for fetched orders (smart calculation)
        calculateNotifications(sortedOrders);
        
        // Mark current section as viewed and clear its notifications
        if (currentFilter !== 'all') {
          markSectionAsViewed(currentFilter);
        }
        
        // Update orders without clearing them first
        console.log('📋 Setting orders state:', sortedOrders.length, 'orders');
        console.log('📋 Orders data:', sortedOrders);
        setOrders(sortedOrders);
        
        // Update pagination info for delivered orders
        if (currentFilter === 'delivered' && response.total !== undefined) {
          setPaginationInfo({
            total: response.total,
            totalPages: response.totalPages || Math.ceil(response.total / ordersPerPage),
            currentPage: response.page || currentPage
          });
        }
      }
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        filter: currentFilter
      });
      // Don't show error toast on every poll - only on user-initiated actions
      // toast.error(`Failed to fetch orders: ${error.message}`);
    } finally {
      setLoading(false);
      // Clear section loading state
      setIsSectionLoading(false);
    }
  }, [filter, calculateNotifications, markSectionAsViewed]); // Include necessary dependencies

  // Handle product updates from admin
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

  // Debounced update function to prevent rapid state changes
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

      // Initialize data fetching with new backend API
    useEffect(() => {
      // Initial data fetch
      fetchOrders(filter);
    
    let statusInterval; // Declare in the right scope
    
    // Set up WebSocket real-time updates instead of polling
    const setupWebSocket = () => {
      // Connect to WebSocket
      websocketService.connect();
      
      // Listen for real-time order updates
      websocketService.on('orderPlaced', (order) => {
        console.log('📦 DeliveryDashboard: Received orderPlaced event:', order);
        
        // Update notification for pending section (new orders are always pending)
        setNotifications(prev => ({
          ...prev,
          pending: (prev.pending || 0) + 1
        }));
        
        // Only fetch orders if we're currently viewing the pending section
        const currentFilter = filterRef.current;
        if (currentFilter === 'pending') {
          console.log('🔄 Currently viewing pending section, refreshing orders');
          debouncedUpdate(() => fetchOrders(currentFilter), 1000);
        } else {
          console.log('🔄 Not viewing pending section, notification badge updated');
        }
        // Removed toast notification for cleaner UI
      });
      
      websocketService.on('orderStatusUpdated', (data) => {
        console.log('🔄 OrderStatusUpdated event received:', data);
        
        // Update notifications based on status change
        setNotifications(prev => {
          const newNotifications = { ...prev };
          
          // Determine which section should get the notification
          if (data.status === 'preparing') {
            newNotifications.preparing = (newNotifications.preparing || 0) + 1;
          } else if (data.status === 'ready') {
            newNotifications.ready = (newNotifications.ready || 0) + 1;
          } else if (data.status === 'delivered') {
            newNotifications.delivered = (newNotifications.delivered || 0) + 1;
          }
          
          return newNotifications;
        });
        
        // Remove the order from the current section if we're viewing it
        // This prevents duplicate display until refresh
        setOrders(prevOrders => prevOrders.filter(order => order.id !== data.orderId));
        
        // Clear loading state for this order
        setUpdatingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.orderId);
          return newSet;
        });
        
        // Only fetch orders if we're currently viewing the affected section
        const currentFilter = filterRef.current;
        if (currentFilter === data.status) {
          console.log(`🔄 Currently viewing ${data.status} section, refreshing orders`);
          debouncedUpdate(() => fetchOrders(currentFilter), 1000);
        } else {
          console.log(`🔄 Not viewing ${data.status} section, notification badge updated`);
        }
        // Removed toast notification for cleaner UI
      });
      
      websocketService.on('itemPreparationUpdated', (data) => {
        console.log('🍽️ ItemPreparationUpdated event received:', data);
        
        // Only fetch orders if we're currently viewing the preparing section
        const currentFilter = filterRef.current;
        if (currentFilter === 'preparing') {
          console.log('🍽️ Currently viewing preparing section, refreshing orders');
          debouncedUpdate(() => fetchOrders(currentFilter), 1000);
        } else {
          console.log('🍽️ Not viewing preparing section, no refresh needed');
        }
        // Removed toast notification for cleaner UI
      });
      
      websocketService.on('orderDeleted', (orderId) => {
        console.log('🗑️ OrderDeleted event received:', orderId);
        
        // Always refresh orders when an order is deleted (affects all sections)
        const currentFilter = filterRef.current;
        console.log('🗑️ Order deleted, refreshing current section:', currentFilter);
        debouncedUpdate(() => fetchOrders(currentFilter), 1000);
        // Removed toast notification for cleaner UI
      });
      
      // Update WebSocket status
      const updateWebSocketStatus = () => {
        const status = websocketService.getConnectionStatus();
        setWebsocketStatus(status.isConnected ? 'connected' : 'disconnected');
      };
      
      // Check status every 2 seconds
      statusInterval = setInterval(updateWebSocketStatus, 2000);
      
      // Initial status check
      updateWebSocketStatus();
    };
    
    // Start WebSocket after initial load
    const initialWebSocketTimer = setTimeout(() => {
      setupWebSocket();
    }, 2000); // Start WebSocket after 2 seconds
    
    // Listen for immediate order updates from counter app
    const handleOrderUpdate = (event) => {
      if (event.data && event.data.type === 'ORDER_PLACED') {
        console.log('🚨 Immediate order update received:', event.data.order);
        // Immediately fetch latest orders
        fetchOrders(filter);
        // Update last update timestamp
        localStorage.setItem('lastOrderUpdate', Date.now().toString());
        
        // Trigger additional immediate poll for maximum responsiveness
        setTimeout(() => {
          console.log('🚨 Additional immediate poll triggered');
          fetchOrders(filter);
        }, 500); // Poll again after 500ms for reliability
      }
    };
    
    // Listen for storage changes (when counter app updates localStorage)
    const handleStorageChange = (event) => {
      if (event.key === 'orderUpdate' && event.newValue) {
        console.log('🚨 Order update via storage detected');
        const orderData = JSON.parse(event.newValue);
        // Immediately fetch latest orders
        fetchOrders(filter);
        // Update last update timestamp
        localStorage.setItem('lastOrderUpdate', Date.now().toString());
        
        // Trigger additional immediate poll for maximum responsiveness
        setTimeout(() => {
          console.log('🚨 Additional immediate poll triggered');
          fetchOrders(filter);
        }, 500); // Poll again after 500ms for reliability
      }
    };
    
    // Listen for BroadcastChannel updates (modern browsers)
    let broadcastChannel;
    if (window.BroadcastChannel) {
      try {
        broadcastChannel = new BroadcastChannel('orderUpdates');
        broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'ORDER_PLACED') {
            console.log('🚨 Order update via BroadcastChannel detected');
            // Immediately fetch latest orders
            fetchOrders(filter);
            // Update last update timestamp
            localStorage.setItem('lastOrderUpdate', Date.now().toString());
            
            // Trigger additional immediate poll for maximum responsiveness
            setTimeout(() => {
              console.log('🚨 Additional immediate poll triggered');
              fetchOrders(filter);
            }, 500); // Poll again after 500ms for reliability
          }
        };
      } catch (error) {
        console.log('⚠️ BroadcastChannel not available');
      }
    }
    
    // Set up event listeners
    window.addEventListener('message', handleOrderUpdate);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearTimeout(initialWebSocketTimer);
      
      // Clean up WebSocket listeners
      websocketService.off('orderPlaced');
      websocketService.off('orderStatusUpdated');
      websocketService.off('itemPreparationUpdated');
      websocketService.off('orderDeleted');
      
      // Clean up status interval
      if (statusInterval) {
        clearInterval(statusInterval);
      }
      
      window.removeEventListener('message', handleOrderUpdate);
      window.removeEventListener('storage', handleStorageChange);
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, []); // Empty dependency array - only set up once on mount

  // Handle filter changes
  useEffect(() => {
    // When filter changes, refetch data for the new filter
    fetchOrders(filter);
  }, [filter]); // Only refetch when filter changes

  // Removed individual item listeners to reduce Firestore connections
  // Items will be updated through the main orders listener



  const fetchOrderDetails = async (orderId) => {
    try {
      // Find the order from the current orders list
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
      }
    } catch (error) {
      toast.error('Failed to fetch order details');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      // Set loading state for this order
      setUpdatingOrders(prev => new Set([...prev, orderId]));
      
      await apiService.updateOrderStatus(orderId, status);
      
      // Immediately remove the order from the current section since its status changed
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
      
      // Removed toast notifications for cleaner UI
      // Real-time updates will handle the UI refresh via socket
      // Loading state will be cleared when orders list is refreshed via WebSocket
    } catch (error) {
      toast.error('Failed to update order status');
      // Clear loading state on error
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
    // Removed finally block - loading state persists until list refresh
  };

  const markOrderDelivered = async (orderId) => {
    await updateOrderStatus(orderId, 'delivered');
  };

  // Clear notifications when switching filters
  const handleFilterChange = (newFilter) => {
    // Mark the previous filter as viewed
    if (filter !== 'all') {
      setViewedSections(prev => new Set([...prev, filter]));
    }
    
    setFilter(newFilter);
    

    
    // Clear notifications for the current section being viewed
    setNotifications(prev => ({
      ...prev,
      [newFilter]: 0
    }));
    
    // Mark the current section as viewed
    setViewedSections(prev => new Set([...prev, newFilter]));
  };

  // Simple and fast item preparation update
  const updateItemPreparedCount = (orderId, itemId, newQuantity) => {
    // Immediate UI update - no delays, no flags
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId 
          ? {
              ...order,
              items: order.items.map(item => 
                item.id === itemId 
                  ? { ...item, prepared_quantity: newQuantity }
                  : item
              )
            }
          : order
      )
    );

    // Update Firestore in background - no await to block UI
    apiService.updateItemPreparation(orderId, itemId, newQuantity)
      .catch(error => {
        toast.error('Failed to save changes');
        // Note: Real-time listener will restore correct values
      });
  };

  // Calculate overall preparation progress for an order
  const calculatePreparationProgress = (items) => {
    if (!items || items.length === 0) return 0;
    
    let totalItems = 0;
    let preparedItems = 0;
    
    items.forEach(item => {
      totalItems += item.quantity;
      preparedItems += item.prepared_quantity || 0;
    });
    
    return totalItems === 0 ? 0 : Math.round((preparedItems / totalItems) * 100);
  };

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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ready':
        return <Package size={18} />;
      case 'delivered':
        return <CheckCircle size={18} />;
      default:
        return <Clock size={18} />;
    }
  };

  // Notification Badge Component
  const NotificationBadge = ({ count }) => {
    if (count === 0) return null;
    
    return (
      <span style={{
        backgroundColor: '#dc3545',
        color: 'white',
        borderRadius: '50%',
        padding: '2px 6px',
        fontSize: '12px',
        fontWeight: 'bold',
        marginLeft: '8px',
        minWidth: '20px',
        textAlign: 'center',
        display: 'inline-block',
        animation: 'pulse 2s infinite'
      }}>
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  // Pagination and search functions for delivered orders
  const handleSearch = useCallback(async (searchValue) => {
    setSearchTerm(searchValue);
    setCurrentPage(1); // Reset to first page when searching
    
    if (filter === 'delivered') {
              if (searchValue.trim() === '') {
          // If search is empty, clear filtered results and show normal pagination
          setFilteredOrders([]);
          // Trigger a normal fetch to show the first page
          // We'll use a timeout to ensure this happens after the current function completes
          setTimeout(() => {
            if (filter === 'delivered') {
              // Fetch first page of normal orders
              fetchOrdersWithPage('delivered', 1);
            }
          }, 0);
          return;
        }
      
      // Show loading state
      setIsSectionLoading(true);
      
      try {
        console.log(`🔍 Searching for: "${searchValue}" in delivered orders`);
        
        // Call backend search API
        const response = await apiService.searchOrders('delivered', searchValue);
        
        if (response && response.success && response.orders) {
          const searchResults = response.orders;
          console.log(`🔍 Search results: ${searchResults.length} orders found`);
          console.log(`🔍 Search results data:`, searchResults);
          
          // Update filtered orders with search results
          setFilteredOrders(searchResults);
          
          // Update pagination info for search results
          setPaginationInfo({
            total: searchResults.length,
            totalPages: Math.ceil(searchResults.length / ordersPerPage),
            currentPage: 1
          });
          
          // Clear the main orders state since we're showing search results
          setOrders([]);
        } else {
          console.log('🔍 No search results found');
          setFilteredOrders([]);
          setPaginationInfo({
            total: 0,
            totalPages: 0,
            currentPage: 1
          });
        }
      } catch (error) {
        console.error('❌ Search error:', error);
        // Fallback to client-side filtering if search fails
        const filtered = orders.filter(order => 
          order.customer_name && order.customer_name.toLowerCase().includes(searchValue.toLowerCase()) ||
          order.id && order.id.toLowerCase().includes(searchValue.toLowerCase()) ||
          order.customer_id && order.customer_id.toLowerCase().includes(searchValue.toLowerCase())
        );
        setFilteredOrders(filtered);
      } finally {
        setIsSectionLoading(false);
      }
    }
  }, [filter, orders]);

  // Separate function to fetch orders with specific page
  const fetchOrdersWithPage = useCallback(async (currentFilter, pageNumber) => {
    try {
      console.log('🔄 fetchOrdersWithPage called with filter:', currentFilter, 'page:', pageNumber);
      
      // Set section loading state
      setIsSectionLoading(true);
      
      // Use pagination for delivered orders, regular fetch for others
      let response;
      if (currentFilter === 'delivered') {
        // For cursor-based pagination, we need the last document ID from the previous page
        // Use the ref to get the current cursors state immediately
        const currentCursors = pageCursorsRef.current;
        const lastDocId = pageNumber > 1 ? currentCursors[pageNumber - 1] : null;
        console.log(`🔄 Fetching page ${pageNumber} with cursor:`, lastDocId);
        console.log(`🔍 Available cursors:`, currentCursors);
        console.log(`🔍 Looking for cursor at key:`, pageNumber - 1);
        response = await apiService.getOrders(currentFilter, ordersPerPage, pageNumber, lastDocId);
      } else {
        response = await apiService.getOrders(currentFilter);
      }
      
      console.log('📡 API response received:', response);
      
      // Extract orders from the response structure
      let orders;
      if (response && response.orders) {
        orders = response.orders;
        console.log('📦 Extracted orders from response.orders:', orders?.length || 0, 'orders');
      } else if (Array.isArray(response)) {
        orders = response;
        console.log('📦 Direct array response:', orders?.length || 0, 'orders');
      } else {
        orders = [];
        console.log('⚠️ No orders found in response, using empty array');
      }
      
      console.log('📡 Final orders data:', orders);
      
      // Only update if we actually got orders
      if (orders && orders.length >= 0) {
        // Sort orders by creation time (oldest first for FIFO)
        const sortedOrders = orders.sort((a, b) => {
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
            console.warn('⚠️ Error parsing timestamps, using fallback sorting');
            timeA = a.created_at || 0;
            timeB = b.created_at || 0;
          }
          
          return timeA - timeB;
        });
        
        // Calculate notifications for fetched orders
        calculateNotifications(sortedOrders);
        
        // Mark current section as viewed and clear its notifications
        if (currentFilter !== 'all') {
          markSectionAsViewed(currentFilter);
        }
        
        // Update orders
        setOrders(sortedOrders);
        
        // Update pagination info for delivered orders
        if (currentFilter === 'delivered' && response.total !== undefined) {
          setPaginationInfo({
            total: response.total,
            totalPages: response.totalPages || Math.ceil(response.total / ordersPerPage),
            currentPage: response.page || pageNumber
          });
          
                  // Store the cursor for this page to use for next page
        if (response.lastDocumentId) {
          // Update both state and ref for immediate access
          const newCursors = {
            ...pageCursorsRef.current,
            [pageNumber]: response.lastDocumentId
          };
          
          setPageCursors(newCursors);
          pageCursorsRef.current = newCursors;
          
          console.log(`💾 Updated cursors object:`, newCursors);
          console.log(`💾 Stored cursor for page ${pageNumber}:`, response.lastDocumentId);
        }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching orders with page:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        filter: currentFilter,
        page: pageNumber
      });
    } finally {
      setLoading(false);
      setIsSectionLoading(false);
    }
  }, [ordersPerPage, calculateNotifications, markSectionAsViewed]);

  // Handle page change for pagination
  const handlePageChange = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
    // Fetch orders for the new page
    if (filter === 'delivered') {
      // Call fetchOrders with the new page number directly
      fetchOrdersWithPage('delivered', pageNumber);
    }
  }, [filter, fetchOrdersWithPage]);

  // Calculate pagination for delivered orders
  const getPaginatedOrders = useCallback(() => {
    if (filter !== 'delivered') return orders;
    
    // For delivered orders, the backend already returns the correct page
    // No need to slice since we're getting exactly what we need
    if (searchTerm && filteredOrders.length > 0) {
      console.log('🔍 getPaginatedOrders: Returning filtered orders:', filteredOrders.length);
      console.log('🔍 Filtered orders data:', filteredOrders);
      
      // Validate search results before returning
      const validResults = filteredOrders.filter(order => 
        order && 
        order.id && 
        order.customer_name && 
        order.items && 
        Array.isArray(order.items)
      );
      
      if (validResults.length !== filteredOrders.length) {
        console.warn(`⚠️ Filtered ${filteredOrders.length - validResults.length} invalid orders from search results`);
      }
      
      return validResults;
    }
    
    console.log('🔍 getPaginatedOrders: Returning orders from backend:', orders.length, 'currentPage:', currentPage);
    return orders;
  }, [filter, orders, searchTerm, filteredOrders, currentPage]);

  // Calculate total pages for delivered orders
  const getTotalPages = useCallback(() => {
    if (filter !== 'delivered') return 1;
    
    // If we have search results, use filtered count
    if (searchTerm && filteredOrders.length > 0) {
      return Math.ceil(filteredOrders.length / ordersPerPage);
    }
    
    // Otherwise, use backend total count if available
    // This will be updated when fetchOrders completes
    return 1; // Will be updated by backend response
  }, [filter, searchTerm, filteredOrders, ordersPerPage]);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSearchTerm('');
    setFilteredOrders([]);
  }, [filter]);

  // Keep ref in sync with state
  useEffect(() => {
    pageCursorsRef.current = pageCursors;
  }, [pageCursors]);

  if (loading || !minLoadingComplete) {
    return <LoadingScreen />;
  }

  return (
    <div className="container">
      <div className="header">
        <h1 className="header-title">Delivery Dashboard</h1>
        <div className="user-info">
          <div className="role-badge">Delivery</div>
          
          {/* WebSocket Status Indicator */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded-lg text-sm mr-3">
            <div className={`w-2 h-2 rounded-full ${
              websocketStatus === 'connected' ? 'bg-green-500' : 
              websocketStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className={`${
              websocketStatus === 'connected' ? 'text-green-700' : 
              websocketStatus === 'connecting' ? 'text-yellow-700' : 'text-red-700'
            }`}>
              {websocketStatus === 'connected' ? 'Real-time' : 
               websocketStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
            </span>
          </div>
          
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

      {/* Backend Status Info - Now handled by global indicator */}
      <div style={{ 
        padding: '12px', 
        marginBottom: '20px', 
        borderRadius: '8px', 
        backgroundColor: '#e3f2fd',
        border: '1px solid #90caf9',
        color: '#1565c0',
        fontSize: '14px',
        textAlign: 'center'
      }}>
        <span>🌐 Backend Status: Check the indicator in the top-right corner</span>
      </div>

      <div className="delivery-main-layout" style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1fr 400px' : '1fr', gap: '20px' }}>
        <div>
          {/* Filter Tabs */}
          <div className="card">
            <div className="filter-tabs-container">
              <div className="filter-tabs">
                <button
                  className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('pending')}
                  disabled={isSectionLoading}
                >
                  <span className="tab-label">Pending</span>
                  <NotificationBadge count={notifications.pending} />
                </button>
                <button
                  className={`filter-tab ${filter === 'preparing' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('preparing')}
                  disabled={isSectionLoading}
                >
                  <span className="tab-label">Preparing</span>
                  <NotificationBadge count={notifications.preparing} />
                </button>
                <button
                  className={`filter-tab ${filter === 'ready' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('ready')}
                  disabled={isSectionLoading}
                >
                  <span className="tab-label">Ready</span>
                  <NotificationBadge count={notifications.ready} />
                </button>
                <button
                  className={`filter-tab ${filter === 'delivered' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('delivered')}
                  disabled={isSectionLoading}
                >
                  <span className="tab-label">Delivered</span>
                  <NotificationBadge count={notifications.delivered} />
                </button>

              </div>
            </div>
          </div>

          {/* Orders List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>
                Orders ({filter === 'delivered' ? (searchTerm ? filteredOrders.length : orders.length) : orders.length})
              </h3>
              <button 
                className="btn btn-sm btn-outline"
                onClick={() => fetchOrders(filter)}
                disabled={isSectionLoading}
                title="Refresh orders"
              >
                <RefreshCw size={16} className={isSectionLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
            
            {isSectionLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                <RefreshCw size={48} className="animate-spin" style={{ opacity: 0.7, marginBottom: '16px' }} />
                <p>Loading orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                <Package size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                <p>No orders found</p>
              </div>
            ) : filter === 'delivered' ? (
              // Table view for delivered orders
              <div>
                {/* Search Bar - Always Visible */}
                <div style={{ 
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    maxWidth: '500px'
                  }}>
                    <Search size={20} style={{ color: '#6c757d' }} />
                    <input
                      type="text"
                      placeholder="Search orders by customer name, order ID, customer ID, or product name..."
                      value={searchTerm}
                      onChange={(e) => handleSearch(e.target.value)}
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
                  
                  {/* Search Status */}
                  {searchTerm && (
                    <div style={{ 
                      marginTop: '8px', 
                      fontSize: '12px', 
                      color: '#6c757d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>
                        {filteredOrders.length > 0 
                          ? `Found ${filteredOrders.length} orders matching "${searchTerm}"`
                          : `No orders found matching "${searchTerm}"`
                        }
                      </span>
                      {filteredOrders.length > 0 && (
                        <button
                          onClick={() => handleSearch('')}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            background: 'white',
                            cursor: 'pointer',
                            color: '#6c757d',
                            fontSize: '11px'
                          }}
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  )}
                </div>

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
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Items</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Total</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const paginatedOrders = getPaginatedOrders();
                        console.log('🔍 Table rendering: paginatedOrders length:', paginatedOrders.length, 'currentPage:', currentPage);
                        return paginatedOrders.map(order => (
                          <tr 
                            key={order.id}
                            style={{ 
                              borderBottom: '1px solid #e9ecef',
                              cursor: 'pointer',
                              backgroundColor: selectedOrder?.id === order.id ? '#f8f9ff' : 'transparent'
                            }}
                            onClick={() => fetchOrderDetails(order.id)}
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
                            <td style={{ padding: '12px' }}>{order.items.length} items</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                              ₹{order.total_amount}
                            </td>
                            <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                              {new Date(order.created_at).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchOrderDetails(order.id);
                                }}
                                title="View Details"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
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

                {/* Results Info */}
                <div style={{ 
                  textAlign: 'center', 
                  padding: '16px', 
                  color: '#666', 
                  fontSize: '14px',
                  borderTop: '1px solid #e9ecef',
                  marginTop: '20px'
                }}>
                  Showing {((currentPage - 1) * ordersPerPage) + 1} to {Math.min(currentPage * ordersPerPage, orders.length)} of {searchTerm ? filteredOrders.length : paginationInfo.total} delivered orders
                </div>
              </div>
            ) : (
              // Regular card view for other sections
              <div className="order-list">
                {orders.map(order => (
                  <div 
                    key={order.id} 
                    className="order-card"
                    style={{ 
                      cursor: 'pointer',
                      border: selectedOrder?.id === order.id ? '2px solid #007bff' : '1px solid #e1e5e9'
                    }}
                    onClick={() => fetchOrderDetails(order.id)}
                  >
                    <div className="order-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="order-id">Order #{order.id}</div>
                        <span className={`order-status status-${order.status}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="order-amount">
                        Total: ₹{order.total_amount}
                      </div>
                    </div>
                    <div className="order-body">
                      <p><strong>Customer:</strong> {order.customer_name}</p>
                      <p><strong>Type:</strong> {order.order_type}</p>
                      <p><strong>Items:</strong> {order.items.length}</p>
                      {order.status === 'preparing' && (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ 
                            height: '8px', 
                            backgroundColor: '#e0e0e0', 
                            borderRadius: '4px', 
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            <div style={{
                              width: `${calculatePreparationProgress(order.items)}%`,
                              height: '100%',
                              background: calculatePreparationProgress(order.items) === 100 
                                ? 'linear-gradient(90deg, #28a745, #20c997)' 
                                : (calculatePreparationProgress(order.items) > 0 
                                  ? 'linear-gradient(90deg, #fd7e14, #ffc107)' 
                                  : (calculatePreparationProgress(order.items) > 0 
                                    ? 'linear-gradient(90deg, #fd7e14, #ffc107)' 
                                    : 'linear-gradient(90deg, #ffc107, #ffd60a)')),
                              borderRadius: '4px',
                              transition: 'all 0.3s ease'
                            }}>
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#666', 
                            marginTop: '4px', 
                            textAlign: 'right' 
                          }}>
                            {calculatePreparationProgress(order.items)}% Prepared
                          </div>
                        </div>
                      )}

                      {/* Items to Prepare - Clean Implementation */}
                      {order.status === 'preparing' && (
                        <div style={{ marginTop: '16px' }}>
                          <div style={{ 
                            fontSize: '13px', 
                            fontWeight: '600', 
                            color: '#333',
                            marginBottom: '12px'
                          }}>
                            🍽️ Items to Prepare
                          </div>
                          
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '8px'
                          }}>
                            {order.items.map(item => {
                              const preparedQty = item.prepared_quantity || 0;
                              const isCompleted = preparedQty >= item.quantity;
                              
                              return (
                                <div 
                                  key={item.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px',
                                    backgroundColor: isCompleted ? '#f8fff8' : '#fff',
                                    border: isCompleted ? '1px solid #28a745' : '1px solid #e9ecef',
                                    border: isCompleted ? '1px solid #28a745' : '1px solid #e9ecef',
                                    borderRadius: '6px',
                                    width: '100%',
                                    minHeight: '56px',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  {/* Item Name and Progress */}
                                  <div style={{ flex: 1 }}>
                                    <div style={{ 
                                      fontSize: '14px', 
                                      fontWeight: '500',
                                      color: isCompleted ? '#28a745' : '#333',
                                      textDecoration: isCompleted ? 'line-through' : 'none'
                                    }}>
                                      {isCompleted && '✓ '}{item.product_name}
                                    </div>
                                    <div style={{ 
                                      fontSize: '12px', 
                                      color: '#666',
                                      marginTop: '2px'
                                    }}>
                                      {preparedQty} of {item.quantity} prepared
                                    </div>
                                  </div>
                                  
                                  {/* Counter Controls */}
                                  <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px',
                                    minWidth: '100px',
                                    justifyContent: 'flex-end'
                                  }}>
                                    <button
                                      style={{ 
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        border: '1px solid #dc3545',
                                        backgroundColor: preparedQty > 0 ? '#dc3545' : '#f8f9fa',
                                        color: preparedQty > 0 ? 'white' : '#6c757d',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        cursor: preparedQty > 0 ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (preparedQty > 0) {
                                          updateItemPreparedCount(order.id, item.id, preparedQty - 1);
                                        }
                                      }}
                                      disabled={preparedQty <= 0}
                                    >
                                      −
                                    </button>
                                    
                                    <div style={{ 
                                      minWidth: '24px',
                                      textAlign: 'center',
                                      fontSize: '16px',
                                      fontWeight: '700',
                                      color: '#333'
                                    }}>
                                      {preparedQty}
                                    </div>
                                    
                                    <button
                                      style={{ 
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        border: '1px solid #28a745',
                                        backgroundColor: preparedQty < item.quantity ? '#28a745' : '#f8f9fa',
                                        color: preparedQty < item.quantity ? 'white' : '#6c757d',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        cursor: preparedQty < item.quantity ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (preparedQty < item.quantity) {
                                          updateItemPreparedCount(order.id, item.id, preparedQty + 1);
                                        }
                                      }}
                                      disabled={preparedQty >= item.quantity}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="order-actions">
                      {order.status === 'pending' && (
                        <button
                          className="btn btn-warning"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateOrderStatus(order.id, 'preparing');
                          }}
                          disabled={updatingOrders.has(order.id)}
                        >
                          {updatingOrders.has(order.id) ? (
                            <>
                              <RefreshCw size={18} className="animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Clock size={18} />
                              Start Preparing
                            </>
                          )}
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          className={`btn ${calculatePreparationProgress(order.items) === 100 ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateOrderStatus(order.id, 'ready');
                          }}
                          disabled={calculatePreparationProgress(order.items) !== 100 || updatingOrders.has(order.id)}
                          title={calculatePreparationProgress(order.items) === 100 ? 'All items are prepared' : 'Complete all item preparation first'}
                          style={{
                            opacity: calculatePreparationProgress(order.items) === 100 ? 1 : 0.6,
                            cursor: calculatePreparationProgress(order.items) === 100 ? 'pointer' : 'not-allowed'
                          }}
                        >
                          {updatingOrders.has(order.id) ? (
                            <>
                              <RefreshCw size={18} className="animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Package size={18} />
                              Mark Ready
                              {calculatePreparationProgress(order.items) !== 100 && (
                                <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
                                  ({calculatePreparationProgress(order.items)}%)
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      )}
                      {order.status === 'preparing' && calculatePreparationProgress(order.items) !== 100 && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6c757d', 
                          marginTop: '4px',
                          textAlign: 'center',
                          fontStyle: 'italic'
                        }}>
                          ⚠️ Complete all item preparation to enable "Mark Ready"
                        </div>
                      )}
                      {order.status === 'ready' && (
                        <button
                          className="btn btn-success"
                          onClick={(e) => {
                            e.stopPropagation();
                            markOrderDelivered(order.id);
                          }}
                          disabled={updatingOrders.has(order.id)}
                        >
                          {updatingOrders.has(order.id) ? (
                            <>
                              <RefreshCw size={18} className="animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <CheckCircle size={18} />
                              Mark Delivered
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Order Details Sidebar */}
        {selectedOrder && (
          <div className="card" style={{ height: 'fit-content', position: 'sticky', top: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Order Details</h3>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedOrder(null)}
                style={{ padding: '8px' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '8px' }}>Order #{selectedOrder.id}</h4>
              <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
                <p><strong>Customer:</strong> {selectedOrder.customer_name}</p>
                <p><strong>Customer ID:</strong> {selectedOrder.customer_id}</p>
                <p><strong>Type:</strong> {selectedOrder.order_type}</p>
                <p><strong>Status:</strong> 
                  <span className={`order-status status-${selectedOrder.status}`} style={{ marginLeft: '8px' }}>
                    {selectedOrder.status}
                  </span>
                </p>
                <p><strong>Created:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                {selectedOrder.delivered_at && (
                  <p><strong>Delivered:</strong> {new Date(selectedOrder.delivered_at).toLocaleString()}</p>
                )}
                {selectedOrder.delivered_by_user && (
                  <p><strong>Delivered by:</strong> {selectedOrder.delivered_by_user}</p>
                )}
              </div>
            </div>

            {/* Items to Prepare in Sidebar - Clean Implementation */}
            {selectedOrder.status === 'preparing' && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '12px' }}>Items to Prepare</h4>
                
                {/* Simple Progress Bar */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '4px',
                  marginBottom: '16px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${calculatePreparationProgress(selectedOrder.items)}%`,
                    height: '100%',
                    backgroundColor: calculatePreparationProgress(selectedOrder.items) === 100 ? '#28a745' : '#007bff',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                
                <div style={{ fontSize: '12px', color: '#666', textAlign: 'right', marginBottom: '16px' }}>
                  {calculatePreparationProgress(selectedOrder.items)}% Complete
                </div>

                {/* Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedOrder.items.map(item => {
                    const preparedQty = item.prepared_quantity || 0;
                    const isCompleted = preparedQty >= item.quantity;
                    
                    return (
                      <div 
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px',
                          backgroundColor: isCompleted ? '#f8fff8' : '#fff',
                          border: isCompleted ? '1px solid #28a745' : '1px solid #e9ecef',
                          borderRadius: '6px',
                          width: '100%',
                          minHeight: '56px',
                          boxSizing: 'border-box'
                        }}
                      >
                        {/* Item Details */}
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: '500',
                            color: isCompleted ? '#28a745' : '#333',
                            textDecoration: isCompleted ? 'line-through' : 'none'
                          }}>
                            {isCompleted && '✓ '}{item.product_name}
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#666',
                            marginTop: '2px'
                          }}>
                            {preparedQty} of {item.quantity} prepared
                          </div>
                        </div>
                        
                        {/* Counter Controls */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          minWidth: '100px',
                          justifyContent: 'flex-end'
                        }}>
                          <button
                            style={{ 
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              border: '1px solid #dc3545',
                              backgroundColor: preparedQty > 0 ? '#dc3545' : '#f8f9fa',
                              color: preparedQty > 0 ? 'white' : '#6c757d',
                              fontSize: '16px',
                              fontWeight: 'bold',
                              cursor: preparedQty > 0 ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (preparedQty > 0) {
                                updateItemPreparedCount(selectedOrder.id, item.id, preparedQty - 1);
                              }
                            }}
                            disabled={preparedQty <= 0}
                          >
                            −
                          </button>
                          
                          <div style={{ 
                            minWidth: '24px',
                            textAlign: 'center',
                            fontSize: '16px',
                            fontWeight: '700',
                            color: '#333'
                          }}>
                            {preparedQty}
                          </div>
                          
                          <button
                            style={{ 
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              border: '1px solid #28a745',
                              backgroundColor: preparedQty < item.quantity ? '#28a745' : '#f8f9fa',
                              color: preparedQty < item.quantity ? 'white' : '#6c757d',
                              fontSize: '16px',
                              fontWeight: 'bold',
                              cursor: preparedQty < item.quantity ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (preparedQty < item.quantity) {
                                updateItemPreparedCount(selectedOrder.id, item.id, preparedQty + 1);
                              }
                            }}
                            disabled={preparedQty >= item.quantity}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div style={{ 
              borderTop: '2px solid #e1e5e9', 
              paddingTop: '16px',
              fontSize: '18px',
              fontWeight: '700',
              textAlign: 'center',
              color: '#007bff'
            }}>
              Total: ₹{selectedOrder.total_amount}
            </div>
            
            {selectedOrder.status === 'pending' && (
              <button
                className="btn btn-warning"
                onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')}
                style={{ width: '100%', marginTop: '16px' }}
              >
                <Clock size={18} />
                Start Preparing
              </button>
            )}
            
            {selectedOrder.status === 'preparing' && (
              <button
                className={`btn ${calculatePreparationProgress(selectedOrder.items) === 100 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => updateOrderStatus(selectedOrder.id, 'ready')}
                style={{ 
                  width: '100%', 
                  marginTop: '16px',
                  opacity: calculatePreparationProgress(selectedOrder.items) === 100 ? 1 : 0.6,
                  cursor: calculatePreparationProgress(selectedOrder.items) === 100 ? 'pointer' : 'not-allowed'
                }}
                disabled={calculatePreparationProgress(selectedOrder.items) !== 100}
                title={calculatePreparationProgress(selectedOrder.items) === 100 ? 'All items are prepared' : 'Complete all item preparation first'}
              >
                <Package size={18} />
                Mark Ready for Delivery
                {calculatePreparationProgress(selectedOrder.items) !== 100 && (
                  <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
                    ({calculatePreparationProgress(selectedOrder.items)}%)
                  </span>
                )}
              </button>
            )}
            
            {selectedOrder.status === 'ready' && (
              <button
                className="btn btn-success"
                onClick={() => markOrderDelivered(selectedOrder.id)}
                style={{ width: '100%', marginTop: '16px' }}
              >
                <CheckCircle size={18} />
                Mark as Delivered
              </button>
            )}
          </div>
        )}
      </div>

      {/* Refresh Notification Popup */}
      {showRefreshNotification && (
        <div className="refresh-notification">
          <div className="refresh-notification-content">
            <RefreshCw size={20} className="refresh-icon" />
            <div className="refresh-text">
              <h4>🔄 Menu Updated</h4>
              <p>Admin has made changes to the menu. Please refresh to see the latest items.</p>
              <div className="refresh-actions">
                <button 
                  className="btn btn-primary refresh-page-btn"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw size={16} />
                  Refresh Page
                </button>
                <button 
                  className="btn btn-secondary dismiss-btn"
                  onClick={() => setShowRefreshNotification(false)}
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button 
              className="refresh-close-btn"
              onClick={() => setShowRefreshNotification(false)}
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
