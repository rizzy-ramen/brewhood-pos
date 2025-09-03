import React, { useState } from 'react';
import { Menu, X, LogOut, BarChart3, User, Edit } from 'lucide-react';

const AdminHamburgerMenu = ({ 
  onLogout, 
  onModifyProducts, 
  onSales, 
  user,
  className = '',
  style = {}
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleMenuItemClick = (action) => {
    closeMenu();
    action();
  };

  return (
    <div className={`hamburger-menu ${className}`} style={style}>
      {/* Hamburger Button */}
      <button
        className="hamburger-button"
        onClick={toggleMenu}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#333',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = '#f8f9fa';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
        }}
      >
        <Menu size={24} />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="menu-overlay"
          onClick={closeMenu}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
          }}
        />
      )}

      {/* Menu Panel */}
      <div
        className={`menu-panel ${isOpen ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: isOpen ? 0 : '-300px',
          width: '300px',
          height: '100vh',
          backgroundColor: 'white',
          boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)',
          zIndex: 1001,
          transition: 'left 0.3s ease',
          overflowY: 'auto'
        }}
      >
        {/* Menu Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e9ecef',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <User size={20} style={{ color: '#dc3545' }} />
              <div>
                <div style={{ fontWeight: '600', color: '#333' }}>
                  {user?.username || 'Admin'}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  Administrator
                </div>
              </div>
            </div>
            <button
              onClick={closeMenu}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f1f3f4';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div style={{ padding: '16px 0' }}>
          {/* Modify Products */}
          <button
            onClick={() => handleMenuItemClick(onModifyProducts)}
            style={{
              width: '100%',
              padding: '16px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              color: '#333',
              fontSize: '16px',
              transition: 'all 0.2s ease',
              borderBottom: '1px solid #f1f3f4'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f8f9fa';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            <Edit size={20} style={{ color: '#007bff' }} />
            <span>Modify Products</span>
          </button>

          {/* Sales */}
          <button
            onClick={() => handleMenuItemClick(onSales)}
            style={{
              width: '100%',
              padding: '16px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              color: '#333',
              fontSize: '16px',
              transition: 'all 0.2s ease',
              borderBottom: '1px solid #f1f3f4'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f8f9fa';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            <BarChart3 size={20} style={{ color: '#28a745' }} />
            <span>Sales</span>
          </button>

          {/* Logout */}
          <button
            onClick={() => handleMenuItemClick(onLogout)}
            style={{
              width: '100%',
              padding: '16px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              color: '#dc3545',
              fontSize: '16px',
              transition: 'all 0.2s ease',
              marginTop: '16px'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#fff5f5';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>

        {/* Menu Footer */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e9ecef',
          backgroundColor: '#f8f9fa',
          marginTop: 'auto'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#666',
            textAlign: 'center'
          }}>
            POS System v1.0
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHamburgerMenu;
