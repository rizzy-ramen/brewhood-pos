import React from 'react';
import { Clock, Package, CheckCircle } from 'lucide-react';

const OrderDetailsSidebar = ({ 
  selectedOrder, 
  setSelectedOrder, 
  updateOrderStatus, 
  markOrderDelivered, 
  updateItemPreparedCount, 
  calculatePreparationProgress 
}) => {
  if (!selectedOrder) return null;

  return (
    <div className="card" style={{ height: 'fit-content', position: 'sticky', top: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Order Details</h3>
        <button
          className="btn btn-secondary"
          onClick={() => setSelectedOrder(null)}
          style={{ padding: '8px' }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ marginBottom: '8px' }}>
          {selectedOrder.custom_order_id ? (
            <div>
              <div style={{ 
                fontSize: '22px', 
                fontWeight: 'bold', 
                color: '#007bff', 
                marginBottom: '6px',
                textShadow: '0 2px 4px rgba(0,123,255,0.3)',
                letterSpacing: '1px'
              }}>
                #{selectedOrder.custom_order_id}
              </div>
              <div style={{ 
                fontSize: '13px', 
                color: '#666', 
                fontStyle: 'italic',
                opacity: 0.8
              }}>
                ID: {selectedOrder.id}
              </div>
            </div>
          ) : (
            `Order #${selectedOrder.id}`
          )}
        </h4>
        <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
          <p><strong>Customer:</strong> {selectedOrder.customer_name}</p>
          <p><strong>Customer ID:</strong> {selectedOrder.customer_id}</p>
          <p><strong>Type:</strong> {selectedOrder.order_type}</p>
          <p><strong>Status:</strong> 
            <span className={`order-status status-${selectedOrder.status}`} style={{ marginLeft: '8px' }}>
              {selectedOrder.status}
            </span>
          </p>
          <p><strong>Created:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
          {selectedOrder.delivered_at && (
            <p><strong>Delivered:</strong> {new Date(selectedOrder.delivered_at).toLocaleString()}</p>
          )}
          {selectedOrder.delivered_by_user && (
            <p><strong>Delivered by:</strong> {selectedOrder.delivered_by_user}</p>
          )}
        </div>
      </div>

      {/* Items to Prepare in Sidebar - Clean Implementation */}
      {selectedOrder.status === 'preparing' && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '12px' }}>Items to Prepare</h4>
          
          {/* Simple Progress Bar */}
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e9ecef',
            borderRadius: '4px',
            marginBottom: '16px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${calculatePreparationProgress(selectedOrder.items)}%`,
              height: '100%',
              backgroundColor: calculatePreparationProgress(selectedOrder.items) === 100 ? '#28a745' : '#007bff',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          
          <div style={{ fontSize: '12px', color: '#666', textAlign: 'right', marginBottom: '16px' }}>
            {calculatePreparationProgress(selectedOrder.items)}% Complete
          </div>

          {/* Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedOrder.items.map(item => {
              const preparedQty = item.prepared_quantity || 0;
              const isCompleted = preparedQty >= item.quantity;
              
              return (
                <div 
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: isCompleted ? '#f8fff8' : '#fff',
                    border: isCompleted ? '1px solid #28a745' : '1px solid #e9ecef',
                    borderRadius: '6px',
                    width: '100%',
                    minHeight: '56px',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Item Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '500',
                      color: isCompleted ? '#28a745' : '#333',
                      textDecoration: isCompleted ? 'line-through' : 'none'
                    }}>
                      {isCompleted && '✓ '}{item.product_name}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666',
                      marginTop: '2px'
                    }}>
                      {preparedQty} of {item.quantity} prepared
                    </div>
                  </div>
                  
                  {/* Counter Controls */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    minWidth: '100px',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      style={{ 
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: '1px solid #dc3545',
                        backgroundColor: preparedQty > 0 ? '#dc3545' : '#f8f9fa',
                        color: preparedQty > 0 ? 'white' : '#6c757d',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: preparedQty > 0 ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (preparedQty > 0) {
                          updateItemPreparedCount(selectedOrder.id, item.id, preparedQty - 1);
                        }
                      }}
                      disabled={preparedQty <= 0}
                    >
                      −
                    </button>
                    
                    <div style={{ 
                      minWidth: '24px',
                      textAlign: 'center',
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#333'
                    }}>
                      {preparedQty}
                    </div>
                    
                    <button
                      style={{ 
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: '1px solid #28a745',
                        backgroundColor: preparedQty < item.quantity ? '#28a745' : '#f8f9fa',
                        color: preparedQty < item.quantity ? 'white' : '#6c757d',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: preparedQty < item.quantity ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (preparedQty < item.quantity) {
                          updateItemPreparedCount(selectedOrder.id, item.id, preparedQty + 1);
                        }
                      }}
                      disabled={preparedQty >= item.quantity}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div style={{ 
        borderTop: '2px solid #e1e5e9', 
        paddingTop: '16px',
        fontSize: '18px',
        fontWeight: '700',
        textAlign: 'center',
        color: '#007bff'
      }}>
        Total: ₹{selectedOrder.total_amount}
      </div>
      
      {selectedOrder.status === 'pending' && (
        <button
          className="btn btn-warning"
          onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')}
          style={{ width: '100%', marginTop: '16px' }}
        >
          <Clock size={18} />
          Start Preparing
        </button>
      )}
      
      {selectedOrder.status === 'preparing' && (
        <button
          className={`btn ${calculatePreparationProgress(selectedOrder.items) === 100 ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => updateOrderStatus(selectedOrder.id, 'ready')}
          style={{ 
            width: '100%', 
            marginTop: '16px',
            opacity: calculatePreparationProgress(selectedOrder.items) === 100 ? 1 : 0.6,
            cursor: calculatePreparationProgress(selectedOrder.items) === 100 ? 'pointer' : 'not-allowed'
          }}
          disabled={calculatePreparationProgress(selectedOrder.items) !== 100}
          title={calculatePreparationProgress(selectedOrder.items) === 100 ? 'All items are prepared' : 'Complete all item preparation first'}
        >
          <Package size={18} />
          Mark Ready for Delivery
          {calculatePreparationProgress(selectedOrder.items) !== 100 && (
            <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
              ({calculatePreparationProgress(selectedOrder.items)}%)
            </span>
          )}
        </button>
      )}
      
      {selectedOrder.status === 'ready' && (
        <button
          className="btn btn-success"
          onClick={() => markOrderDelivered(selectedOrder.id)}
          style={{ width: '100%', marginTop: '16px' }}
        >
          <CheckCircle size={18} />
          Mark as Delivered
        </button>
      )}
    </div>
  );
};

export default OrderDetailsSidebar;
