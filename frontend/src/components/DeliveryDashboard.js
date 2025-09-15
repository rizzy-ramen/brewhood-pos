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
    if (filter !== 'all') {
      smartCounts[filter] = 0;
    }
    
    // Don't clear notifications for other sections - let them persist until user switches to them
    // viewedSections.forEach(viewedSection => {
    //   smartCounts[viewedSection] = 0;
    // });
    
    // Only update notifications if they've actually changed to prevent flickering
    setNotifications(prev => {
      const hasChanged = JSON.stringify(prev) !== JSON.stringify(smartCounts);
      if (hasChanged) {
        return smartCounts;
      }
      return prev;
    });
  }, [filter]); // Add filter as dependency since we use it

  // Fetch orders function with stable state management
  const fetchOrders = useCallback(async (currentFilter = filter) => {
    try {
      console.log('🔄 fetchOrders called with filter:', currentFilter);
      console.log('🔄 Original filter value:', filter);
      console.log('🔄 Current filter parameter:', currentFilter);
      console.log('🔄 Filter values match?', filter === currentFilter);
      
      // Always show loading when fetching orders (this indicates a section change or refresh)
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
        // For delivered orders, backend handles ordering via cursor-based pagination
        // For other sections, sort by creation time (oldest first for FIFO)
        let sortedOrders;
        if (currentFilter === 'delivered') {
          // Backend already returns orders in correct order for pagination
          sortedOrders = orders;
        } else {
          // Sort other sections by creation time (oldest first for FIFO)
          sortedOrders = orders.sort((a, b) => {
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
        }
        
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
    // Set up WebSocket listeners FIRST (before connecting)
    console.log('🔌 DeliveryDashboard: Setting up WebSocket listeners...');
    
    // Listen for WebSocket connection events
    websocketService.on('statusChange', (status) => {
      console.log('🔌 DeliveryDashboard: WebSocket status changed:', status);
      if (status.isConnected) {
        console.log('🔄 WebSocket connected, refreshing orders to catch any missed updates');
        // Refresh orders when WebSocket connects to catch any missed updates
        debouncedUpdate(() => fetchOrdersDynamic(filterRef.current), 500);
      }
    });
    
    
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
        debouncedUpdate(() => fetchOrdersDynamic(currentFilter), 1000);
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
          debouncedUpdate(() => fetchOrdersDynamic(currentFilter), 1000);
        } else {
          console.log(`🔄 Not viewing ${data.status} section, notification badge updated`);
          // Don't call calculateNotifications here as it would overwrite the WebSocket increment
        }
        // Removed toast notification for cleaner UI
      });
      
      websocketService.on('itemPreparationUpdated', (data) => {
        console.log('🍽️ ItemPreparationUpdated event received:', data);
        
        // Only fetch orders if we're currently viewing the preparing section
        const currentFilter = filterRef.current;
        if (currentFilter === 'preparing') {
          console.log('🍽️ Currently viewing preparing section, refreshing orders');
          debouncedUpdate(() => fetchOrdersDynamic(currentFilter), 1000);
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
      debouncedUpdate(() => fetchOrdersDynamic(currentFilter), 1000);
      // Removed toast notification for cleaner UI
    });
    
    // Update WebSocket status
    const updateWebSocketStatus = () => {
      const status = websocketService.getConnectionStatus();
      setWebsocketStatus(status.isConnected ? 'connected' : 'disconnected');
    };
    
    // Check status every 10 seconds (reduced frequency)
    let statusInterval = setInterval(updateWebSocketStatus, 10000);
    
    // Initial status check
    updateWebSocketStatus();
    
    // Connect to WebSocket and register as delivery dashboard
    const connectWebSocket = async () => {
      console.log('🔌 DeliveryDashboard: Connecting to WebSocket...');
      try {
        await websocketService.connect('delivery');
        console.log('✅ DeliveryDashboard: WebSocket connected successfully');
      } catch (error) {
        console.error('❌ DeliveryDashboard: WebSocket connection failed:', error);
      }
    };
    
    connectWebSocket();
    
    // Initial data fetch
    fetchOrders(filter);
    
    // Listen for immediate order updates from counter app
    const handleOrderUpdate = (event) => {
      if (event.data && event.data.type === 'ORDER_PLACED') {
        console.log('🚨 Immediate order update received:', event.data.order);
        // Immediately fetch latest orders
        fetchOrders(filter);
        // Update last update timestamp
        localStorage.setItem('lastOrderUpdate', Date.now().toString());
        
        // No additional polling needed - WebSocket will handle real-time updates
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
        
        // No additional polling needed - WebSocket will handle real-time updates
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
            
            // No additional polling needed - WebSocket will handle real-time updates
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
      // Clean up WebSocket listeners
      websocketService.off('statusChange');
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
  }, [filter, fetchOrders]); // Include fetchOrders in dependencies




  const updateOrderStatus = async (orderId, status) => {
    try {
      // Set loading state for this order
      setUpdatingOrders(prev => new Set([...prev, orderId]));
      
      await apiService.updateOrderStatus(orderId, status);
      
      // Immediately remove the order from the current section since its status changed
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
      
      // Removed toast notifications for cleaner UI
      // Real-time updates will handle the UI refresh via socket
    } catch (error) {
      toast.error('Failed to update order status');
    } finally {
      // Always clear loading state after API call completes
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
      
      // Always show loading when fetching orders (this indicates a section change or refresh)
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
        // For delivered orders, backend handles ordering via cursor-based pagination
        // For other sections, sort by creation time (oldest first for FIFO)
        let sortedOrders;
        if (currentFilter === 'delivered') {
          // Backend already returns orders in correct order for pagination
          sortedOrders = orders;
        } else {
          // Sort other sections by creation time (oldest first for FIFO)
          sortedOrders = orders.sort((a, b) => {
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
        }
        
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

  // Function for dynamic updates without loading state (used by WebSocket events)
  const fetchOrdersDynamic = useCallback(async (currentFilter = filter) => {
    try {
      console.log('🔄 fetchOrdersDynamic called with filter:', currentFilter);
      
      // Use pagination for delivered orders, regular fetch for others
      let response;
      if (currentFilter === 'delivered') {
        // For delivered orders, use fetchOrdersWithPage to ensure cursor storage
        if (currentPage === 1) {
          response = await apiService.getOrders(currentFilter, ordersPerPage, currentPage);
          
          // Store cursor for page 2 if we have a response
          if (response && response.lastDocumentId) {
            const newCursors = {
              ...pageCursorsRef.current,
              1: response.lastDocumentId
            };
            setPageCursors(newCursors);
            pageCursorsRef.current = newCursors;
          }
        } else {
          // For other pages, use fetchOrdersWithPage
          await fetchOrdersWithPage(currentFilter, currentPage);
          return;
        }
      } else {
        response = await apiService.getOrders(currentFilter);
      }
      
      // Extract orders from the response structure
      let orders;
      if (response && response.orders) {
        orders = response.orders;
      } else if (Array.isArray(response)) {
        orders = response;
      } else {
        orders = [];
      }
      
      // Only update if we actually got orders
      if (orders && orders.length >= 0) {
        // For delivered orders, backend handles ordering via cursor-based pagination
        // For other sections, sort by creation time (oldest first for FIFO)
        let sortedOrders;
        if (currentFilter === 'delivered') {
          // Backend already returns orders in correct order for pagination
          sortedOrders = orders;
        } else {
          // Sort other sections by creation time (oldest first for FIFO)
          sortedOrders = orders.sort((a, b) => {
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
            
            return timeA - timeB;
          });
        }
        
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
            currentPage: response.page || currentPage
          });
        }
      }
    } catch (error) {
      console.error('❌ Error in fetchOrdersDynamic:', error);
    }
  }, [filter, calculateNotifications, markSectionAsViewed, currentPage, ordersPerPage, fetchOrdersWithPage]);

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
        `}
      </style>
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

      <div className="delivery-main-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        <div>
          {/* Filter Tabs - Now using the new component */}
          <FilterTabs 
            filter={filter}
            handleFilterChange={handleFilterChange}
            notifications={notifications}
            isSectionLoading={isSectionLoading}
          />

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
                      color: '#666'
                    }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '500',
                        marginBottom: '16px',
                        color: '#333'
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
                          backgroundColor: '#007bff',
                          animation: 'bounce 1.4s infinite ease-in-out'
                        }}></div>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#007bff',
                          animation: 'bounce 1.4s infinite ease-in-out',
                          animationDelay: '0.2s'
                        }}></div>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#007bff',
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
                      color: '#666' 
                    }}>
                      <Package size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                      <p>No {filter} orders found</p>
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
