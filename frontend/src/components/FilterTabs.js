import React from 'react';

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

const FilterTabs = ({ filter, handleFilterChange, notifications, isSectionLoading }) => {
  return (
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
  );
};

export default FilterTabs;
