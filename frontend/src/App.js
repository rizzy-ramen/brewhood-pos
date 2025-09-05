import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import CounterDashboard from './components/CounterDashboard';
import DeliveryDashboard from './components/DeliveryDashboard';
import AdminDashboard from './components/AdminDashboard';
import TailwindTest from './components/TailwindTest';
import BackendStatusIndicator from './components/BackendStatusIndicator';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData && userData !== 'null' && userData !== 'undefined') {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    // Token is already set by the loginUser function in backendAuth.js
    toast.success(`Welcome, ${userData.username}!`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Toaster position="top-right" />
        
        {/* Backend Status Indicator - Shows on all pages */}
        {user && (
          <BackendStatusIndicator 
            position="top-right"
            size="medium"
            showDetails={true}
            onStatusChange={(status, data) => {
              if (status === 'offline') {
                toast.error('Backend connection lost');
              }
            }}
          />
        )}
        
        <Routes>
          <Route 
            path="/login" 
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <Login onLogin={handleLogin} />
              )
            } 
          />
          
          <Route 
            path="/" 
            element={
              !user ? (
                <Navigate to="/login" replace />
              ) : user.role === 'counter' ? (
                <CounterDashboard user={user} onLogout={handleLogout} />
              ) : user.role === 'delivery' ? (
                <DeliveryDashboard user={user} onLogout={handleLogout} />
              ) : user.role === 'admin' ? (
                <AdminDashboard user={user} onLogout={handleLogout} />
              ) : (
                <div className="container">
                  <h1>Unknown Role</h1>
                  <p>Role: {user.role}</p>
                  <button className="btn btn-secondary" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )
            } 
          />
          
          <Route path="/tailwind-test" element={<TailwindTest />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
