import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { apiService } from '../services/api';

const BackendStatusIndicator = ({ 
  position = 'top-right',
  onStatusChange = null 
}) => {
  const [status, setStatus] = useState('checking'); // checking, online, offline, error




  // Check backend health
  const checkBackendHealth = async () => {
    setStatus('checking');
    
    try {
      const health = await apiService.checkHealth();
      
      if (health.status === 'OK') {
        setStatus('online');
        onStatusChange?.('online', health);
      } else {
        setStatus('error');
        onStatusChange?.('error', health);
      }
    } catch (error) {
      setStatus('offline');
      onStatusChange?.('offline', error);
    }
  };

  // Auto-check backend health every 2 minutes (reduced frequency)
  useEffect(() => {
    checkBackendHealth();
    
    const interval = setInterval(checkBackendHealth, 600000); // 10 minutes instead of 2 minutes
    return () => clearInterval(interval);
  }, []);

  // Get status icon and color
  const getStatusIcon = () => {
    switch (status) {
      case 'online':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'offline':
        return <WifiOff size={16} className="text-red-500" />;
      case 'error':
        return <AlertCircle size={16} className="text-yellow-500" />;
      case 'checking':
        return <RefreshCw size={16} className="text-blue-500 animate-spin" />;
      default:
        return <Clock size={16} className="text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'offline':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'error':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'checking':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };



  // Position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  return (
    <div className={`fixed ${getPositionClasses()} z-50`}>
      {/* Simple Status Button */}
      <div 
        className={`${getStatusColor()} border rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl text-xs px-2 py-1`}
      >
        <div className="flex items-center gap-1">
          {getStatusIcon()}
          <span className="font-medium text-xs">
            {status === 'online' ? 'Online' : 
             status === 'offline' ? 'Offline' : 
             status === 'error' ? 'Error' : 'Checking...'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BackendStatusIndicator;
