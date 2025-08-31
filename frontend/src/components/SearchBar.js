import React from 'react';
import { Search, X, RefreshCw } from 'lucide-react';

const SearchBar = ({ 
  searchTerm, 
  setSearchTerm, 
  debouncedSearch, 
  handleSearch, 
  filteredOrders, 
  isSectionLoading 
}) => {
  return (
    <div style={{ 
      marginBottom: '20px',
      padding: '16px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #e9ecef',
      position: 'sticky',
      top: '0',
      zIndex: 10
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
          onChange={(e) => {
            const value = e.target.value;
            setSearchTerm(value); // Update input immediately
            debouncedSearch(value); // Trigger debounced search
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
        {/* Google-style "thinking" indicator */}
        {searchTerm && isSectionLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 12px',
            color: '#6c757d',
            fontSize: '12px'
          }}>
            <RefreshCw size={14} className="animate-spin" />
            <span>Searching...</span>
          </div>
        )}
      </div>
      
      {/* Search Status - Always visible when search term exists */}
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
  );
};

export default SearchBar;
