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
  const [salesDates, setSalesDates] = useState(new Set());
  const [allOrdersLoading, setAllOrdersLoading] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch all orders to identify dates with sales data
  const fetchAllOrdersForCalendar = async () => {
    setAllOrdersLoading(true);
    try {
      const response = await apiService.getOrders('all', 1000);
      let allOrders = [];
      
      if (response && response.orders) {
        allOrders = response.orders;
      } else if (Array.isArray(response)) {
        allOrders = response;
      }

      // Extract unique dates with sales
      const datesWithSales = new Set();
      allOrders.forEach(order => {
        if (order.created_at) {
          const orderDate = new Date(order.created_at).toISOString().split('T')[0];
          datesWithSales.add(orderDate);
        }
      });

      setSalesDates(datesWithSales);
    } catch (error) {
      console.error('Error fetching all orders for calendar:', error);
    } finally {
      setAllOrdersLoading(false);
    }
  };

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

      // Filter orders by selected date - show ONLY orders for the selected date
      const selectedDateObj = new Date(date);
      const filteredOrders = allOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate.toDateString() === selectedDateObj.toDateString();
      });

      // Use only the filtered orders for the selected date
      const ordersToUse = filteredOrders;

      setOrders(ordersToUse);
      generateReportData(ordersToUse);
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
      sum + (order.items ? order.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) : 0), 0
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

    // Summary sheet with better formatting
    const summaryData = [
      ['SALES REPORT SUMMARY'],
      [''],
      ['Report Date', selectedDate],
      ['Generated On', new Date().toLocaleString()],
      ['Orders Included', reportData.totalOrders],
      [''],
      ['OVERVIEW'],
      ['Total Orders', reportData.totalOrders],
      ['Total Revenue', `₹${reportData.totalRevenue.toFixed(2)}`],
      ['Total Items Sold', reportData.totalItems],
      ['Average Order Value', reportData.totalOrders > 0 ? `₹${(reportData.totalRevenue / reportData.totalOrders).toFixed(2)}` : '₹0.00'],
      [''],
      ['ORDER TYPES BREAKDOWN'],
      ['Type', 'Count', 'Percentage'],
      ...Object.entries(reportData.orderTypes).map(([type, count]) => [
        type.charAt(0).toUpperCase() + type.slice(1), 
        count, 
        `${((count / reportData.totalOrders) * 100).toFixed(1)}%`
      ]),
      [''],
      ['ORDER STATUS BREAKDOWN'],
      ['Status', 'Count', 'Percentage'],
      ...Object.entries(reportData.orderStatuses).map(([status, count]) => [
        status.charAt(0).toUpperCase() + status.slice(1), 
        count, 
        `${((count / reportData.totalOrders) * 100).toFixed(1)}%`
      ]),
      [''],
      ['HOURLY BREAKDOWN'],
      ['Hour', 'Orders', 'Percentage'],
      ...Object.entries(reportData.hourlyData)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([hour, count]) => [
          `${hour}:00`, 
          count, 
          `${((count / reportData.totalOrders) * 100).toFixed(1)}%`
        ])
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Add basic styling to summary sheet
    const summaryRange = XLSX.utils.decode_range(summarySheet['!ref']);
    for (let row = 0; row <= summaryRange.e.r; row++) {
      for (let col = 0; col <= summaryRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!summarySheet[cellAddress]) continue;
        
        if (row === 0) {
          // Main title
          summarySheet[cellAddress].s = {
            font: { bold: true, size: 16 },
            alignment: { horizontal: "center" }
          };
        } else if (summaryData[row] && summaryData[row][0] && summaryData[row][0].includes('BREAKDOWN')) {
          // Section headers
          summarySheet[cellAddress].s = {
            font: { bold: true, size: 12 },
            fill: { fgColor: { rgb: "D9E2F3" } }
          };
        }
      }
    }
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Detailed orders sheet - Include ALL orders with complete details
    const ordersData = [
      ['DETAILED ORDERS LIST'],
      [''],
      ['Order ID', 'Order Number', 'Customer Name', 'Contact Number', 'Order Type', 'Status', 'Total Amount (₹)', 'Items Details', 'Created Time'],
      ...reportData.orders.map(order => {
        // Handle missing items array
        const itemsText = order.items && Array.isArray(order.items) 
          ? order.items.map(item => `${item.product_name || 'Unknown'} x${item.quantity || 0}`).join(', ')
          : 'No items data';
        
        return [
          String(order.id || 'N/A'),
        order.order_number || 'N/A',
        order.customer_name || 'N/A',
          order.contact_number || 'N/A',
        order.order_type || 'N/A',
        order.status || 'N/A',
        order.total_amount || 0,
          itemsText,
          order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'
        ];
      })
    ];

    const ordersSheet = XLSX.utils.aoa_to_sheet(ordersData);
    
    // Auto-size columns and add styling
    const ordersRange = XLSX.utils.decode_range(ordersSheet['!ref']);
    const colWidths = [];
    for (let col = 0; col <= ordersRange.e.c; col++) {
      let maxWidth = 10;
      for (let row = 0; row <= ordersRange.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = ordersSheet[cellAddress];
        if (cell && cell.v) {
          const cellLength = String(cell.v).length;
          maxWidth = Math.max(maxWidth, cellLength);
        }
      }
      colWidths.push({ wch: Math.min(maxWidth + 2, 50) });
    }
    ordersSheet['!cols'] = colWidths;
    
    // Style header rows
    for (let col = 0; col <= ordersRange.e.c; col++) {
      // Style main title (row 0)
      const titleCell = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ordersSheet[titleCell]) {
        ordersSheet[titleCell].s = {
          font: { bold: true, size: 14 },
          alignment: { horizontal: "center" }
        };
      }
      
      // Style column headers (row 2)
      const headerCell = XLSX.utils.encode_cell({ r: 2, c: col });
      if (ordersSheet[headerCell]) {
        ordersSheet[headerCell].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "366092" } },
          alignment: { horizontal: "center" }
        };
      }
    }
    
    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Orders');

    // Save file
    const fileName = `Sales_Report_${selectedDate.replace(/-/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Handle date change
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);
    // fetchOrdersForDate will be called automatically by useEffect when selectedDate changes
  };

  // Custom Calendar Component
  const CustomCalendar = () => {
    const currentDate = new Date(calendarViewDate);
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    // Get first day of the month and number of days
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay();
    
    // Month names
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Generate calendar days
    const calendarDays = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarDays.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calendarDays.push({
        day,
        dateString,
        hasSales: salesDates.has(dateString),
        isSelected: dateString === selectedDate,
        isToday: dateString === new Date().toISOString().split('T')[0]
      });
    }
    
    const navigateMonth = (direction) => {
      // Create new date for the first day of the target month
      const newDate = new Date(currentYear, currentMonth + direction, 1);
      
      // Format date manually to avoid timezone issues
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      const newDateString = `${year}-${month}-${day}`;
      
      // Update calendar view date, not selected date
      setCalendarViewDate(newDateString);
    };
    
    return (
      <div style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'white',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        padding: '20px',
        zIndex: 1000,
        width: '380px'
      }}>
        {/* Calendar Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => navigateMonth(-1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '18px'
            }}
          >
            ‹
          </button>
          <div style={{
            fontWeight: '600',
            fontSize: '16px',
            color: '#333'
          }}>
            {monthNames[currentMonth]} {currentYear}
          </div>
          <button
            onClick={() => navigateMonth(1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '18px'
            }}
          >
            ›
          </button>
        </div>
        
        {/* Days of week header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
          marginBottom: '8px'
        }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: '600',
              color: '#666',
              padding: '8px 4px'
            }}>
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px'
        }}>
          {calendarDays.map((dayData, index) => (
            <div key={index} style={{
              minHeight: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {dayData && (
                <button
                  onClick={() => handleDateChange(dayData.dateString)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: dayData.isSelected ? '600' : '400',
                    backgroundColor: dayData.isSelected 
                      ? '#007bff' 
                      : dayData.isToday 
                        ? '#e3f2fd' 
                        : dayData.hasSales 
                          ? '#e8f5e8' 
                          : 'transparent',
                    color: dayData.isSelected 
                      ? 'white' 
                      : dayData.isToday 
                        ? '#1976d2' 
                        : dayData.hasSales 
                          ? '#2e7d32' 
                          : '#333',
                    border: dayData.hasSales && !dayData.isSelected 
                      ? '2px solid #4caf50' 
                      : dayData.isToday && !dayData.isSelected 
                        ? '2px solid #2196f3' 
                        : '2px solid transparent',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (!dayData.isSelected) {
                      e.target.style.backgroundColor = dayData.hasSales ? '#c8e6c9' : '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!dayData.isSelected) {
                      e.target.style.backgroundColor = dayData.isToday 
                        ? '#e3f2fd' 
                        : dayData.hasSales 
                          ? '#e8f5e8' 
                          : 'transparent';
                    }
                  }}
                >
                  {dayData.day}
                  {dayData.hasSales && (
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '2px',
                      width: '6px',
                      height: '6px',
                      backgroundColor: dayData.isSelected ? 'rgba(255,255,255,0.8)' : '#4caf50',
                      borderRadius: '50%'
                    }} />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #e9ecef',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#e8f5e8',
              border: '2px solid #4caf50',
              borderRadius: '3px'
            }} />
            <span>Has Sales</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#e3f2fd',
              border: '2px solid #2196f3',
              borderRadius: '3px'
            }} />
            <span>Today</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#007bff',
              borderRadius: '3px'
            }} />
            <span>Selected</span>
          </div>
        </div>
      </div>
    );
  };

  // Initial load
  useEffect(() => {
    fetchOrdersForDate(selectedDate);
  }, [selectedDate]);

  // Load all orders for calendar highlighting on component mount
  useEffect(() => {
    fetchAllOrdersForCalendar();
  }, []);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCalendar && !event.target.closest('.calendar-container')) {
        setShowCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

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
        maxWidth: '1100px',
        maxHeight: '95vh',
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
            
            <div className="calendar-container" style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  if (!showCalendar) {
                    // When opening calendar, set view to the month of selected date
                    setCalendarViewDate(selectedDate);
                  }
                  setShowCalendar(!showCalendar);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  minWidth: '160px',
                  justifyContent: 'space-between'
                }}
              >
                <span>{new Date(selectedDate).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}</span>
                <Calendar size={16} style={{ 
                  color: '#666',
                  transform: showCalendar ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }} />
              </button>
              
              {showCalendar && <CustomCalendar key={calendarViewDate} />}
              
              {/* Loading indicator for calendar data */}
              {allOrdersLoading && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  backgroundColor: 'white',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid #007bff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Loading sales dates...
                </div>
              )}
            </div>

            <button
              onClick={exportToExcel}
              disabled={!reportData || loading || !reportData?.totalOrders || reportData.totalOrders === 0}
              title={
                loading ? 'Loading sales data...' :
                !reportData ? 'No data available' :
                (!reportData?.totalOrders || reportData.totalOrders === 0) ? 'No sales data available for this date' :
                'Export sales report to Excel'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: (reportData && !loading && reportData?.totalOrders > 0) ? 'pointer' : 'not-allowed',
                opacity: (reportData && !loading && reportData?.totalOrders > 0) ? 1 : 0.6,
                transition: 'all 0.2s ease',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                if (reportData && !loading && reportData?.totalOrders > 0) {
                  e.target.style.backgroundColor = '#218838';
                }
              }}
              onMouseLeave={(e) => {
                if (reportData && !loading && reportData?.totalOrders > 0) {
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
          ) : reportData && reportData.totalOrders > 0 ? (
            <div>
              {/* Enhanced Summary Cards with Visual Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px',
                marginBottom: '32px'
              }}>
                {/* Total Orders Card */}
                <div style={{
                  padding: '24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '12px',
                  color: 'white',
                  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1 }}>
                    <Package size={80} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                      borderRadius: '8px' 
                    }}>
                      <Package size={24} />
                    </div>
                    <span style={{ fontWeight: '600', fontSize: '16px' }}>Total Orders</span>
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>
                    {reportData.totalOrders}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    Orders placed on {selectedDate}
                  </div>
                </div>

                {/* Total Revenue Card */}
                <div style={{
                  padding: '24px',
                  background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                  borderRadius: '12px',
                  color: 'white',
                  boxShadow: '0 8px 25px rgba(17, 153, 142, 0.3)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1 }}>
                    <DollarSign size={80} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                      borderRadius: '8px' 
                    }}>
                      <DollarSign size={24} />
                    </div>
                    <span style={{ fontWeight: '600', fontSize: '16px' }}>Total Revenue</span>
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>
                    ₹{reportData.totalRevenue.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    Revenue generated today
                  </div>
                </div>

                {/* Total Items Card */}
                <div style={{
                  padding: '24px',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  borderRadius: '12px',
                  color: 'white',
                  boxShadow: '0 8px 25px rgba(240, 147, 251, 0.3)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1 }}>
                    <Package size={80} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                      borderRadius: '8px' 
                    }}>
                      <Package size={24} />
                    </div>
                    <span style={{ fontWeight: '600', fontSize: '16px' }}>Items Sold</span>
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>
                    {reportData.totalItems}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    Total items sold today
                  </div>
                </div>

                {/* Average Order Value Card */}
                <div style={{
                  padding: '24px',
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  borderRadius: '12px',
                  color: 'white',
                  boxShadow: '0 8px 25px rgba(79, 172, 254, 0.3)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1 }}>
                    <TrendingUp size={80} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ 
                      padding: '8px', 
                      backgroundColor: 'rgba(255, 255, 255, 0.2)', 
                      borderRadius: '8px' 
                    }}>
                      <TrendingUp size={24} />
                    </div>
                    <span style={{ fontWeight: '600', fontSize: '16px' }}>Avg Order Value</span>
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>
                    ₹{reportData.totalOrders > 0 ? (reportData.totalRevenue / reportData.totalOrders).toFixed(2) : '0.00'}
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    Per order average
                  </div>
                </div>
              </div>

              {/* Enhanced Order Types with Progress Bars */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  marginBottom: '20px', 
                  color: '#333', 
                  fontSize: '20px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Package size={20} style={{ color: '#007bff' }} />
                  Order Types Distribution
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  {Object.entries(reportData.orderTypes).map(([type, count], index) => {
                    const percentage = reportData.totalOrders > 0 ? (count / reportData.totalOrders) * 100 : 0;
                    const colors = [
                      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
                    ];
                    const color = colors[index % colors.length];
                    
                    return (
                    <div key={type} style={{
                        padding: '20px',
                        background: color,
                        borderRadius: '12px',
                        color: 'white',
                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          position: 'absolute', 
                          top: '-10px', 
                          right: '-10px', 
                          opacity: 0.1 
                        }}>
                          <Package size={40} />
                        </div>
                        <div style={{ 
                          fontWeight: '600', 
                          fontSize: '16px', 
                          textTransform: 'capitalize',
                          marginBottom: '8px'
                        }}>
                        {type}
                      </div>
                        <div style={{ 
                          fontSize: '28px', 
                          fontWeight: 'bold',
                          marginBottom: '8px'
                        }}>
                        {count}
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          opacity: 0.9,
                          marginBottom: '12px'
                        }}>
                          {percentage.toFixed(1)}% of total
                        </div>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Enhanced Order Statuses with Visual Indicators */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  marginBottom: '20px', 
                  color: '#333', 
                  fontSize: '20px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Clock size={20} style={{ color: '#28a745' }} />
                  Order Status Tracking
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  {Object.entries(reportData.orderStatuses).map(([status, count], index) => {
                    const percentage = reportData.totalOrders > 0 ? (count / reportData.totalOrders) * 100 : 0;
                    const statusColors = {
                      'pending': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                      'preparing': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                      'ready': 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
                      'delivered': 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
                      'cancelled': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
                    };
                    const statusIcons = {
                      'pending': '⏳',
                      'preparing': '👨‍🍳',
                      'ready': '✅',
                      'delivered': '🚚',
                      'cancelled': '❌'
                    };
                    const color = statusColors[status.toLowerCase()] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    const icon = statusIcons[status.toLowerCase()] || '📊';
                    
                    return (
                    <div key={status} style={{
                        padding: '20px',
                        background: color,
                        borderRadius: '12px',
                        color: '#333',
                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                        border: '2px solid rgba(255, 255, 255, 0.3)'
                      }}>
                        <div style={{ 
                          position: 'absolute', 
                          top: '-10px', 
                          right: '-10px', 
                          opacity: 0.2,
                          fontSize: '40px'
                        }}>
                          {icon}
                        </div>
                        <div style={{ 
                          fontWeight: '600', 
                          fontSize: '16px', 
                          textTransform: 'capitalize',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ fontSize: '20px' }}>{icon}</span>
                        {status}
                      </div>
                        <div style={{ 
                          fontSize: '28px', 
                          fontWeight: 'bold',
                          marginBottom: '8px',
                          color: '#2c3e50'
                        }}>
                        {count}
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          color: '#7f8c8d',
                          marginBottom: '12px'
                        }}>
                          {percentage.toFixed(1)}% of total
                        </div>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          backgroundColor: 'rgba(0, 0, 0, 0.1)',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: '#2c3e50',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Enhanced Hourly Breakdown Chart */}
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ 
                  marginBottom: '20px', 
                  color: '#333', 
                  fontSize: '20px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Clock size={20} style={{ color: '#e74c3c' }} />
                  Hourly Sales Distribution
                </h3>
                <div style={{
                  padding: '24px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '12px',
                  border: '1px solid #e9ecef',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                    gap: '8px',
                    marginBottom: '16px'
                  }}>
                    {Object.entries(reportData.hourlyData)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([hour, count]) => {
                        const maxCount = Math.max(...Object.values(reportData.hourlyData));
                        const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        const isCurrentHour = new Date().getHours() === parseInt(hour);
                        
                        return (
                          <div key={hour} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <div style={{
                              width: '100%',
                              height: '120px',
                              display: 'flex',
                              alignItems: 'end',
                              justifyContent: 'center',
                              position: 'relative'
                            }}>
                              <div style={{
                                width: '20px',
                                height: `${height}%`,
                                background: isCurrentHour 
                                  ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'
                                  : 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                                borderRadius: '10px 10px 0 0',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                transition: 'all 0.3s ease',
                                position: 'relative'
                              }}>
                                {count > 0 && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '-25px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    color: '#2c3e50',
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                                  }}>
                                    {count}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              color: isCurrentHour ? '#e74c3c' : '#7f8c8d',
                              textAlign: 'center'
                            }}>
                              {hour}:00
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    color: '#7f8c8d',
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid #e9ecef'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                        borderRadius: '2px'
                      }}></div>
                      <span>Orders by Hour</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                        borderRadius: '2px'
                      }}></div>
                      <span>Current Hour</span>
                    </div>
                  </div>
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
              <p>No orders found for {selectedDate}</p>
              <p style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>
                Try selecting a different date to view sales data
              </p>
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
