// API Service for communicating with your local backend
// Update this URL to match your local backend IP address
const API_BASE_URL = 'http://localhost:5000/api';

// Generate a simple demo token (replace with proper JWT in production)
const generateDemoToken = () => {
  return btoa(JSON.stringify({
    id: 'demo-user',
    role: 'counter',
    firebaseToken: 'demo-token'
  }));
};

export const apiService = {
  // Orders
  createOrder: async (orderData) => {
    try {
      const token = generateDemoToken();
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create order');
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ API Error - createOrder:', error);
      throw error;
    }
  },

  getOrders: async (status = null, limit = 100) => {
    try {
      const token = generateDemoToken();
      const url = status && status !== 'all' 
        ? `${API_BASE_URL}/orders/status/${status}?limit=${limit}`
        : `${API_BASE_URL}/orders?limit=${limit}`;
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch orders');
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ API Error - getOrders:', error);
      throw error;
    }
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      const token = generateDemoToken();
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update order status');
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ API Error - updateOrderStatus:', error);
      throw error;
    }
  },

  getOrderStats: async () => {
    try {
      const token = generateDemoToken();
      const response = await fetch(`${API_BASE_URL}/stats/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch order statistics');
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ API Error - getOrderStats:', error);
      throw error;
    }
  },

  // Health check
  checkHealth: async () => {
    try {
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
      return await response.json();
    } catch (error) {
      console.error('❌ API Error - health check:', error);
      throw error;
    }
  }
};

// Utility function to check if backend is available
export const isBackendAvailable = async () => {
  try {
    const health = await apiService.checkHealth();
    return health.status === 'OK';
  } catch (error) {
    return false;
  }
};

// Fallback to direct Firestore if backend is unavailable
export const fallbackToFirestore = {
  createOrder: async (orderData) => {
    console.warn('⚠️ Backend unavailable, falling back to Firestore');
    // Import your existing Firestore logic here
    // return await addDoc(collection(db, 'orders'), orderData);
  },
  
  getOrders: async (status = null) => {
    console.warn('⚠️ Backend unavailable, falling back to Firestore');
    // Import your existing Firestore logic here
    // return await getDocs(collection(db, 'orders'));
  }
};

// Configuration for different environments
export const config = {
  // Update this to your local backend IP address
  // For local development: http://localhost:5000
  // For network access: http://YOUR_IP_ADDRESS:5000
  backendUrl: 'http://localhost:5000',
  
  // Update this when you want to access from other devices
  // Example: http://192.168.1.100:5000 (your PC's IP address)
  networkBackendUrl: 'http://YOUR_IP_ADDRESS:5000'
};
