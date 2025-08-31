import React from 'react';
import { RefreshCw, Package } from 'lucide-react';

const OrdersTable = ({ 
  orders, 
  searchTerm, 
  filteredOrders,
  isSectionLoading, 
  getPaginatedOrders, 
  currentPage, 
  paginationInfo, 
  ordersPerPage, 
  handlePageChange, 
  fetchOrderDetails, 
  selectedOrder 
}) => {
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
      
      return date.toLocaleString();
    } catch (error) {
      console.error('Error parsing date:', createdAt, error);
      return 'Parse error';
    }
  };
  return (
    <div>
      <style>
        {`
          @keyframes dot1 {
            0%, 20% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1.2); }
            60%, 100% { opacity: 0.3; transform: scale(0.8); }
          }
          
          @keyframes dot2 {
            0%, 20% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1.2); }
            60%, 100% { opacity: 0.3; transform: scale(0.8); }
          }
          
          @keyframes dot3 {
            0%, 20% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1.2); }
            60%, 100% { opacity: 0.3; transform: scale(0.8); }
          }
          
          .dot1 { animation-delay: 0s; }
          .dot2 { animation-delay: 0.2s; }
          .dot3 { animation-delay: 0.4s; }
        `}
      </style>
      {/* Loading State - Only affects table content */}
      {isSectionLoading ? (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          color: '#666',
          position: 'relative'
        }}>
          {/* Blurred dummy table in background */}
          <div style={{ 
            filter: 'blur(2px)',
            opacity: 0.3,
            pointerEvents: 'none'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Order ID</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Customer</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Type</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Items</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Total</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Date & Time</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', borderBottom: '1px solid #e9ecef' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...Array(6)].map((_, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #e9ecef' }}>
                      <td style={{ padding: '12px', color: '#007bff' }}>#{Math.random().toString(36).substr(2, 8)}</td>
                      <td style={{ padding: '12px' }}>Customer {index + 1}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          backgroundColor: index % 2 === 0 ? '#e3f2fd' : '#f3e5f5',
                          color: index % 2 === 0 ? '#1565c0' : '#7b1fa2'
                        }}>
                          {index % 2 === 0 ? 'takeaway' : 'dine-in'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>{Math.floor(Math.random() * 5) + 1} items</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>₹{Math.floor(Math.random() * 500) + 100}</td>
                      <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>{new Date(Date.now() - Math.random() * 86400000).toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button style={{
                          padding: '6px 12px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          background: 'white',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Loading overlay */}
          <div style={{ 
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '20px 40px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            zIndex: 10
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '8px'
            }}>
              Loading delivered orders
            </div>
            <div style={{
              fontSize: '14px',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}>
              <span className="dot1" style={{ animation: 'dot1 1.4s infinite' }}>•</span>
              <span className="dot2" style={{ animation: 'dot2 1.4s infinite' }}>•</span>
              <span className="dot3" style={{ animation: 'dot3 1.4s infinite' }}>•</span>
            </div>
          </div>
        </div>
      ) : (orders.length === 0 && !searchTerm) ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          <Package size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p>No orders found</p>
        </div>
      ) : (
        /* Orders Table */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{ 
                backgroundColor: '#f8f9fa', 
                borderBottom: '2px solid #dee2e6' 
              }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Order ID</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Customer</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Items</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Total</th>
                                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date & Time</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const paginatedOrders = getPaginatedOrders();
                console.log('🔍 Table rendering: paginatedOrders length:', paginatedOrders.length, 'currentPage:', currentPage);
                return paginatedOrders.map(order => (
                  <tr 
                    key={order.id}
                    style={{ 
                      borderBottom: '1px solid #e9ecef',
                      cursor: 'pointer',
                      backgroundColor: selectedOrder?.id === order.id ? '#f8f9ff' : 'transparent'
                    }}
                    onClick={() => fetchOrderDetails(order.id)}
                  >
                    <td style={{ padding: '12px', fontWeight: '500', color: '#007bff' }}>
                      #{order.id.slice(-8)}
                    </td>
                    <td style={{ padding: '12px' }}>{order.customer_name}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: order.order_type === 'takeaway' ? '#e3f2fd' : '#f3e5f5',
                        color: order.order_type === 'takeaway' ? '#1565c0' : '#7b1fa2'
                      }}>
                        {order.order_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>{order.items.length} items</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                      ₹{order.total_amount}
                    </td>
                                                                        <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                          {parseOrderDate(order.created_at)}
                        </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchOrderDetails(order.id);
                        }}
                        title="View Details"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination - Only show when table has content */}
      {!isSectionLoading && paginationInfo.totalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '10px',
          marginTop: '20px',
          padding: '20px 0'
        }}>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          
          <span style={{ fontSize: '14px', color: '#666' }}>
            Page {currentPage} of {paginationInfo.totalPages}
          </span>
          
          <button
            className="btn btn-sm btn-outline"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === paginationInfo.totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* Results Info - Only show when table has content */}
      {!isSectionLoading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '16px', 
          color: '#666', 
          fontSize: '14px',
          borderTop: '1px solid #e9ecef',
          marginTop: '20px'
        }}>
          Showing {((currentPage - 1) * ordersPerPage) + 1} to {Math.min(currentPage * ordersPerPage, orders.length)} of {searchTerm ? filteredOrders.length : paginationInfo.total} delivered orders
        </div>
      )}
    </div>
  );
};

export default OrdersTable;
