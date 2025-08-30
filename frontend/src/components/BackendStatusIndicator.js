import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { apiService, API_BASE_URL } from '../services/api';

const BackendStatusIndicator = ({ 
  showDetails = true, 
  position = 'top-right',
  size = 'medium',
  onStatusChange = null 
}) => {
  const [status, setStatus] = useState('checking'); // checking, online, offline, error
  const [lastCheck, setLastCheck] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Get base URL from API service
  useEffect(() => {
    setBaseUrl(API_BASE_URL);
  }, []);

  // Check backend health
  const checkBackendHealth = async () => {
    const startTime = Date.now();
    setStatus('checking');
    
    try {
      const health = await apiService.checkHealth();
      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;
      
      if (health.status === 'OK') {
        setStatus('online');
        setResponseTime(responseTimeMs);
        setErrorMessage('');
        onStatusChange?.('online', health);
      } else {
        setStatus('error');
        setErrorMessage('Backend returned unexpected status');
        onStatusChange?.('error', health);
      }
      
      setLastCheck(new Date());
    } catch (error) {
      setStatus('offline');
      setErrorMessage(error.message || 'Connection failed');
      setResponseTime(null);
      onStatusChange?.('offline', error);
      setLastCheck(new Date());
    }
  };

  // Auto-check backend health every 30 seconds
  useEffect(() => {
    checkBackendHealth();
    
    const interval = setInterval(checkBackendHealth, 30000);
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

  const getStatusText = () => {
    switch (status) {
      case 'online':
        return 'Backend Online';
      case 'offline':
        return 'Backend Offline';
      case 'error':
        return 'Backend Error';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown Status';
    }
  };

  // Size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'text-xs px-2 py-1';
      case 'medium':
        return 'text-sm px-3 py-2';
      case 'large':
        return 'text-base px-4 py-3';
      default:
        return 'text-sm px-3 py-2';
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
      {/* Main Status Indicator */}
      <div 
        className={`${getStatusColor()} border rounded-lg shadow-lg cursor-pointer transition-all duration-200 hover:shadow-xl ${getSizeClasses()}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium">{getStatusText()}</span>
          {responseTime && status === 'online' && (
            <span className="text-xs opacity-75">({responseTime}ms)</span>
          )}
          <span className="text-xs opacity-60">🌐</span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && showDetails && (
        <div className={`mt-2 ${getStatusColor()} border rounded-lg shadow-lg p-3 max-w-sm ${getSizeClasses()}`}>
          <div className="space-y-2">
            {/* Status Details */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Status:</span>
              <span className="capitalize">{status}</span>
            </div>

            {/* Backend Endpoint */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Backend:</span>
              <span className="text-xs break-all max-w-48">{baseUrl}</span>
            </div>

            {/* Health Endpoint */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Health Check:</span>
              <span className="text-xs break-all max-w-48">
                {baseUrl.replace('/api', '')}/health
              </span>
            </div>

            {/* Connection Type */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Connection:</span>
              <span className="text-xs">Cloudflare Tunnel</span>
            </div>

            {/* Response Time */}
            {responseTime && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Response:</span>
                <span>{responseTime}ms</span>
              </div>
            )}

            {/* Last Check */}
            {lastCheck && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Last Check:</span>
                <span className="text-xs">
                  {lastCheck.toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Error:</span>
                <span className="text-xs text-red-600 max-w-32 break-words">
                  {errorMessage}
                </span>
              </div>
            )}

            {/* Manual Refresh Button */}
            <div className="pt-2 border-t border-current border-opacity-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  checkBackendHealth();
                }}
                className="w-full flex items-center justify-center gap-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded px-2 py-1 text-xs transition-colors"
              >
                <RefreshCw size={12} />
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Indicator */}
      <div className="mt-1 flex items-center justify-center">
        <div className={`w-2 h-2 rounded-full ${
          status === 'online' ? 'bg-green-500' : 
          status === 'offline' ? 'bg-red-500' : 
          status === 'error' ? 'bg-yellow-500' : 'bg-blue-500'
        } animate-pulse`}></div>
      </div>
    </div>
  );
};

export default BackendStatusIndicator;
