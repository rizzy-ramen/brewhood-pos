// Backend Authentication Service
// This replaces Firebase Auth with your SQLite backend authentication

const API_BASE_URL = 'https://gotten-fact-indoor-weather.trycloudflare.com/api';

// Login function using backend API
export const loginUser = async (username, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed');
    }

    const data = await response.json();
    
    // Store token and user data
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return {
      success: true,
      user: data.user
    };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Logout function
export const logoutUser = async () => {
  try {
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// Get current user from localStorage
export const getCurrentUser = () => {
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  return !!(token && user);
};

// Get auth token
export const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Check if user has specific role
export const hasRole = (role) => {
  const user = getCurrentUser();
  return user && user.role === role;
};

// Check if user is admin
export const isAdmin = () => {
  return hasRole('admin');
};

// Check if user is counter staff
export const isCounter = () => {
  return hasRole('counter');
};

// Check if user is delivery staff
export const isDelivery = () => {
  return hasRole('delivery');
};
