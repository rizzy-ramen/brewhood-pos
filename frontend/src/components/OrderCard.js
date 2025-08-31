import React from 'react';
import { Clock, Package, CheckCircle, RefreshCw } from 'lucide-react';

const OrderCard = ({ 
  order, 
  selectedOrder, 
  fetchOrderDetails, 
  updateOrderStatus, 
  markOrderDelivered, 
  updateItemPreparedCount, 
  calculatePreparationProgress, 
  updatingOrders 
}) => {
  return (
    <div 
      key={order.id} 
      className="order-card"
      style={{ 
        cursor: 'pointer',
        border: selectedOrder?.id === order.id ? '2px solid #007bff' : '1px solid #e1e5e9'
      }}
      onClick={() => fetchOrderDetails(order.id)}
    >
      <div className="order-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="order-id">
            {order.order_number ? (
              <div>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: '#007bff',
                  textShadow: '0 1px 2px rgba(0,123,255,0.2)',
                  letterSpacing: '0.5px'
                }}>
                  #{order.order_number}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: '#666', 
                  fontStyle: 'italic',
                  marginTop: '2px'
                }}>
                  ID: {order.id}
                </div>
              </div>
            ) : (
              <div>Order #{order.id}</div>
            )}
          </div>
          <span className={`order-status status-${order.status}`}>
            {order.status}
          </span>
        </div>
        <div className="order-amount">
          Total: ₹{order.total_amount}
        </div>
      </div>
      <div className="order-body">
        <p><strong>Customer:</strong> {order.customer_name}</p>
        <p><strong>Type:</strong> {order.order_type}</p>
        <p><strong>Items:</strong> {order.items.length}</p>
        {order.status === 'preparing' && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ 
              height: '8px', 
              backgroundColor: '#e0e0e0', 
              borderRadius: '4px', 
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                width: `${calculatePreparationProgress(order.items)}%`,
                height: '100%',
                background: calculatePreparationProgress(order.items) === 100 
                  ? 'linear-gradient(90deg, #28a745, #20c997)' 
                  : (calculatePreparationProgress(order.items) > 0 
                    ? 'linear-gradient(90deg, #fd7e14, #ffc107)' 
                    : 'linear-gradient(90deg, #ffc107, #ffd60a)'),
                borderRadius: '4px',
                transition: 'all 0.3s ease'
              }}>
              </div>
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginTop: '4px', 
              textAlign: 'right' 
            }}>
              {calculatePreparationProgress(order.items)}% Prepared
            </div>
          </div>
        )}

        {/* Items to Prepare - Clean Implementation */}
        {order.status === 'preparing' && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              color: '#333',
              marginBottom: '12px'
            }}>
              🍽️ Items to Prepare
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px'
            }}>
              {order.items.map(item => {
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
                    {/* Item Name and Progress */}
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
                            updateItemPreparedCount(order.id, item.id, preparedQty - 1);
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
                            updateItemPreparedCount(order.id, item.id, preparedQty + 1);
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
      </div>
      <div className="order-actions">
        {order.status === 'pending' && (
          <button
            className="btn btn-warning"
            onClick={(e) => {
              e.stopPropagation();
              updateOrderStatus(order.id, 'preparing');
            }}
            disabled={updatingOrders.has(order.id)}
          >
            {updatingOrders.has(order.id) ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Clock size={18} />
                Start Preparing
              </>
            )}
          </button>
        )}
        {order.status === 'preparing' && (
          <button
            className={`btn ${calculatePreparationProgress(order.items) === 100 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={(e) => {
              e.stopPropagation();
              updateOrderStatus(order.id, 'ready');
            }}
            disabled={calculatePreparationProgress(order.items) !== 100 || updatingOrders.has(order.id)}
            title={calculatePreparationProgress(order.items) === 100 ? 'All items are prepared' : 'Complete all item preparation first'}
            style={{
              opacity: calculatePreparationProgress(order.items) === 100 ? 1 : 0.6,
              cursor: calculatePreparationProgress(order.items) === 100 ? 'pointer' : 'not-allowed'
            }}
          >
            {updatingOrders.has(order.id) ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Package size={18} />
                Mark Ready
                {calculatePreparationProgress(order.items) !== 100 && (
                  <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.8 }}>
                    ({calculatePreparationProgress(order.items)}%)
                  </span>
                )}
              </>
            )}
          </button>
        )}
        {order.status === 'preparing' && calculatePreparationProgress(order.items) !== 100 && (
          <div style={{ 
            fontSize: '12px', 
            color: '#6c757d', 
            marginTop: '4px',
            textAlign: 'center',
            fontStyle: 'italic'
          }}>
            ⚠️ Complete all item preparation to enable "Mark Ready"
          </div>
        )}
        {order.status === 'ready' && (
          <button
            className="btn btn-success"
            onClick={(e) => {
              e.stopPropagation();
              markOrderDelivered(order.id);
            }}
            disabled={updatingOrders.has(order.id)}
          >
            {updatingOrders.has(order.id) ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                Mark Delivered
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
