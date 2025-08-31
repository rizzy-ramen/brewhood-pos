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
  return (
    <div>
      {/* Loading State - Only affects table content */}
      {isSectionLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          <RefreshCw size={48} className="animate-spin" style={{ opacity: 0.7, marginBottom: '16px' }} />
          <p>Loading orders...</p>
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
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Date</th>
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
                      {new Date(order.created_at).toLocaleDateString()}
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
