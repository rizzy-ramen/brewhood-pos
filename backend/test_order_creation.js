const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'pos_database.db');

console.log('🧪 Testing order creation...');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Test data
const testOrder = {
  customer_name: 'Test Customer',
  contact_number: '9876543210',
  items: [
    { product_id: 1, quantity: 2 }
  ],
  order_type: 'dine-in'
};

console.log('📝 Test order data:', JSON.stringify(testOrder, null, 2));

// First, get product prices
const productIds = testOrder.items.map(item => item.product_id);
const placeholders = productIds.map(() => '?').join(',');

console.log('🔍 Getting product prices...');
db.all(`SELECT id, price FROM products WHERE id IN (${placeholders})`, productIds, (err, products) => {
  if (err) {
    console.error('❌ Error getting products:', err.message);
    db.close();
    return;
  }
  
  console.log('📦 Products found:', products);
  
  const productPrices = {};
  products.forEach(product => {
    productPrices[product.id] = product.price;
  });
  
  // Calculate total and prepare order items
  let total_amount = 0;
  const orderItems = [];
  
  testOrder.items.forEach(item => {
    const unit_price = productPrices[item.product_id];
    const total_price = unit_price * item.quantity;
    total_amount += total_price;
    
    orderItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price,
      total_price
    });
  });
  
  console.log('💰 Total amount:', total_amount);
  console.log('📋 Order items:', orderItems);
  
  // Try to insert the order
  console.log('💾 Inserting order...');
  db.run(
    'INSERT INTO orders (customer_name, contact_number, total_amount, order_type, created_by) VALUES (?, ?, ?, ?, ?)',
    [testOrder.customer_name, testOrder.contact_number, total_amount, testOrder.order_type, 1],
    function(err) {
      if (err) {
        console.error('❌ Error inserting order:', err.message);
        console.error('❌ Error code:', err.code);
        console.error('❌ Full error:', err);
      } else {
        console.log('✅ Order inserted successfully!');
        console.log('🆔 Order ID:', this.lastID);
      }
      
      // Close database connection
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err.message);
        } else {
          console.log('✅ Database connection closed');
        }
      });
    }
  );
});

