import React from 'react';
import { X, Package, User, Clock, Phone, MapPin, CreditCard } from 'lucide-react';

const OrderDetailModal = ({ order, isOpen, onClose }) => {
  if (!isOpen || !order) return null;

  // Utility function to parse dates from various formats
  const parseOrderDate = (createdAt) => {
    try {
      if (!createdAt) return 'No date';
      
      let date;
      
      // Handle Firestore Timestamp
      if (createdAt?.toDate) {
        date = createdAt.toDate();
      }
      // Handle Firestore Timestamp with seconds
      else if (createdAt?.seconds) {
        date = new Date(createdAt.seconds * 1000);
      }
      // Handle ISO string or other date formats
      else if (typeof createdAt === 'string') {
        date = new Date(createdAt);
      }
      // Handle Date object
      else if (createdAt instanceof Date) {
        date = createdAt;
      }
      // Handle timestamp number
      else if (typeof createdAt === 'number') {
        date = new Date(createdAt);
      }
      else {
        console.warn('Unknown date format:', createdAt, 'type:', typeof createdAt);
        return 'Unknown format';
      }
      
      // Validate the date
      if (isNaN(date.getTime())) {
        console.warn('Invalid date value:', createdAt);
        return 'Invalid date';
      }
      
      return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata'
      });
    } catch (error) {
      console.error('Error parsing date:', createdAt, error);
      return 'Parse error';
    }
  };

  // Calculate total items
  const totalItems = order.items ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Package size={24} style={{ color: '#007bff' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#333' }}>
                Order Details
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#666' }}>
                {order.order_number ? `Order #${order.order_number}` : `ID: ${order.id}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Order Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '24px',
            padding: '12px 16px',
            backgroundColor: '#e8f5e8',
            borderRadius: '8px',
            border: '1px solid #c3e6c3'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#28a745'
            }} />
            <span style={{ fontWeight: '500', color: '#155724' }}>
              Status: {order.status || 'delivered'}
            </span>
          </div>

          {/* Customer Information */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <User size={18} />
              Customer Information
            </h3>
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>Name</label>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '500' }}>
                    {order.customer_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>Contact</label>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '500' }}>
                    {order.contact_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>Order Type</label>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '500' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: order.order_type === 'takeaway' ? '#e3f2fd' : '#f3e5f5',
                      color: order.order_type === 'takeaway' ? '#1565c0' : '#7b1fa2'
                    }}>
                      {order.order_type || 'N/A'}
                    </span>
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', fontWeight: '500' }}>Order Time</label>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '500' }}>
                    {parseOrderDate(order.created_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Package size={18} />
              Order Items ({totalItems} items)
            </h3>
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              {order.items && order.items.length > 0 ? (
                <div>
                  {order.items.map((item, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: index < order.items.length - 1 ? '1px solid #e9ecef' : 'none'
                    }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '500' }}>
                          {item.name || item.product_name || 'Unknown Item'}
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                          Quantity: {item.quantity || 1}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600' }}>
                          ₹{(item.price || item.unit_price || 0) * (item.quantity || 1)}
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                          ₹{item.price || item.unit_price || 0} each
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: '#666', fontStyle: 'italic' }}>No items found</p>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>
                Total Amount
              </span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#28a745' }}>
                ₹{order.total_amount ? order.total_amount.toFixed(2) : '0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
