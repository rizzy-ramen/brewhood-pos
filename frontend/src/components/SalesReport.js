import React, { useState, useEffect } from 'react';
import { Calendar, Download, FileSpreadsheet, TrendingUp, DollarSign, Package, Users, Clock } from 'lucide-react';
import { apiService } from '../services/api';
import * as XLSX from 'xlsx';

const SalesReport = ({ onClose }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Fetch orders for selected date
  const fetchOrdersForDate = async (date) => {
    setLoading(true);
    try {
      // Get all orders and filter by date
      const response = await apiService.getOrders('all', 1000);
      let allOrders = [];
      
      if (response && response.orders) {
        allOrders = response.orders;
      } else if (Array.isArray(response)) {
        allOrders = response;
      }

      // Filter orders by selected date
      const selectedDateObj = new Date(date);
      const filteredOrders = allOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate.toDateString() === selectedDateObj.toDateString();
      });

      setOrders(filteredOrders);
      generateReportData(filteredOrders);
    } catch (error) {
      console.error('Error fetching orders for date:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate report data
  const generateReportData = (ordersData) => {
    const totalOrders = ordersData.length;
    const totalRevenue = ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const totalItems = ordersData.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0
    );
    
    // Group by order type
    const orderTypes = ordersData.reduce((acc, order) => {
      const type = order.order_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Group by status
    const orderStatuses = ordersData.reduce((acc, order) => {
      const status = order.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Hourly breakdown
    const hourlyData = ordersData.reduce((acc, order) => {
      const hour = new Date(order.created_at).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    setReportData({
      totalOrders,
      totalRevenue,
      totalItems,
      orderTypes,
      orderStatuses,
      hourlyData,
      orders: ordersData
    });
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!reportData) return;

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['Sales Report Summary'],
      [''],
      ['Date', selectedDate],
      ['Total Orders', reportData.totalOrders],
      ['Total Revenue', `₹${reportData.totalRevenue.toFixed(2)}`],
      ['Total Items Sold', reportData.totalItems],
      [''],
      ['Order Types'],
      ...Object.entries(reportData.orderTypes).map(([type, count]) => [type, count]),
      [''],
      ['Order Statuses'],
      ...Object.entries(reportData.orderStatuses).map(([status, count]) => [status, count]),
      [''],
      ['Hourly Breakdown'],
      ['Hour', 'Orders'],
      ...Object.entries(reportData.hourlyData).map(([hour, count]) => [hour, count])
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Detailed orders sheet
    const ordersData = [
      ['Order ID', 'Order Number', 'Customer Name', 'Order Type', 'Status', 'Total Amount', 'Items', 'Time'],
      ...reportData.orders.map(order => [
        order.id,
        order.order_number || 'N/A',
        order.customer_name || 'N/A',
        order.order_type || 'N/A',
        order.status || 'N/A',
        order.total_amount || 0,
        order.items.map(item => `${item.product_name} x${item.quantity}`).join(', '),
        new Date(order.created_at).toLocaleString()
      ])
    ];

    const ordersSheet = XLSX.utils.aoa_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Orders');

    // Save file
    const fileName = `Sales_Report_${selectedDate.replace(/-/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Handle date change
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);
    fetchOrdersForDate(date);
  };

  // Initial load
  useEffect(() => {
    fetchOrdersForDate(selectedDate);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp size={24} style={{ color: '#007bff' }} />
            <h2 style={{ margin: 0, color: '#333' }}>Sales Report</h2>
          </div>
          <button
            onClick={onClose}
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
            ✕
          </button>
        </div>

        {/* Date Picker */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e9ecef'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} style={{ color: '#007bff' }} />
              <span style={{ fontWeight: '500', color: '#333' }}>Select Date:</span>
            </div>
            
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              />
            </div>

            <button
              onClick={exportToExcel}
              disabled={!reportData || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: reportData && !loading ? 'pointer' : 'not-allowed',
                opacity: reportData && !loading ? 1 : 0.6,
                transition: 'all 0.2s ease',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                if (reportData && !loading) {
                  e.target.style.backgroundColor = '#218838';
                }
              }}
              onMouseLeave={(e) => {
                if (reportData && !loading) {
                  e.target.style.backgroundColor = '#28a745';
                }
              }}
            >
              <Download size={16} />
              Export to Excel
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {loading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              color: '#666'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '16px'
              }}></div>
              <p>Loading sales data...</p>
            </div>
          ) : reportData ? (
            <div>
              {/* Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Package size={20} style={{ color: '#007bff' }} />
                    <span style={{ fontWeight: '600', color: '#333' }}>Total Orders</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                    {reportData.totalOrders}
                  </div>
                </div>

                <div style={{
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <DollarSign size={20} style={{ color: '#28a745' }} />
                    <span style={{ fontWeight: '600', color: '#333' }}>Total Revenue</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                    ₹{reportData.totalRevenue.toFixed(2)}
                  </div>
                </div>

                <div style={{
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Users size={20} style={{ color: '#ffc107' }} />
                    <span style={{ fontWeight: '600', color: '#333' }}>Items Sold</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                    {reportData.totalItems}
                  </div>
                </div>
              </div>

              {/* Order Types */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '16px', color: '#333' }}>Order Types</h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '12px'
                }}>
                  {Object.entries(reportData.orderTypes).map(([type, count]) => (
                    <div key={type} style={{
                      padding: '12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      border: '1px solid #e9ecef',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontWeight: '600', color: '#333', textTransform: 'capitalize' }}>
                        {type}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
                        {count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Statuses */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '16px', color: '#333' }}>Order Statuses</h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '12px'
                }}>
                  {Object.entries(reportData.orderStatuses).map(([status, count]) => (
                    <div key={status} style={{
                      padding: '12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      border: '1px solid #e9ecef',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontWeight: '600', color: '#333', textTransform: 'capitalize' }}>
                        {status}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
                        {count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders */}
              <div>
                <h3 style={{ marginBottom: '16px', color: '#333' }}>Recent Orders</h3>
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid #e9ecef',
                  borderRadius: '6px'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f8f9fa', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Order #</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Customer</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Type</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Status</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e9ecef' }}>Amount</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e9ecef' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.orders.slice(0, 10).map(order => (
                        <tr key={order.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                          <td style={{ padding: '12px', fontWeight: '500', color: '#007bff' }}>
                            #{order.order_number || order.id.slice(-8)}
                          </td>
                          <td style={{ padding: '12px' }}>{order.customer_name || 'N/A'}</td>
                          <td style={{ padding: '12px', textTransform: 'capitalize' }}>{order.order_type || 'N/A'}</td>
                          <td style={{ padding: '12px', textTransform: 'capitalize' }}>{order.status || 'N/A'}</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                            ₹{order.total_amount?.toFixed(2) || '0.00'}
                          </td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                            {new Date(order.created_at).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#666'
            }}>
              <FileSpreadsheet size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>No data available for the selected date</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SalesReport;
