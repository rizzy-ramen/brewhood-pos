const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'pos_database.db');

console.log('🧪 Testing complete server logic...');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Test data (exactly like frontend sends)
const testOrder = {
  customer_name: 'Test Customer',
  contact_number: '9876543210',
  items: [
    { product_id: 1, quantity: 2 }
  ],
  order_type: 'dine-in'
};

const created_by = 1; // Counter user ID

console.log('📝 Test order data:', JSON.stringify(testOrder, null, 2));
console.log('👤 Created by user ID:', created_by);

// Step 1: Get product prices
console.log('\n🔍 Step 1: Getting product prices...');
const productIds = testOrder.items.map(item => item.product_id);
const placeholders = productIds.map(() => '?').join(',');

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
  
  // Step 2: Calculate total and prepare order items
  console.log('\n💰 Step 2: Calculating totals...');
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
  
  // Step 3: Insert order
  console.log('\n💾 Step 3: Inserting order...');
  db.run(
    'INSERT INTO orders (customer_name, contact_number, total_amount, order_type, created_by) VALUES (?, ?, ?, ?, ?)',
    [testOrder.customer_name, testOrder.contact_number, total_amount, testOrder.order_type, created_by],
    function(err) {
      if (err) {
        console.error('❌ Error inserting order:', err.message);
        console.error('❌ Error code:', err.code);
        db.close();
        return;
      }
      
      const order_id = this.lastID;
      console.log('✅ Order inserted successfully! Order ID:', order_id);
      
      // Step 4: Insert order items
      console.log('\n📦 Step 4: Inserting order items...');
      let completed = 0;
      let hasError = false;
      
      orderItems.forEach((item, index) => {
        db.run(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
          [order_id, item.product_id, item.quantity, item.unit_price, item.total_price],
          (err) => {
            if (err) {
              console.error(`❌ Error inserting order item ${index + 1}:`, err.message);
              hasError = true;
            } else {
              console.log(`✅ Order item ${index + 1} inserted successfully`);
            }
            
            completed++;
            if (completed === orderItems.length) {
              if (hasError) {
                console.log('❌ Some order items failed to insert');
                db.close();
                return;
              }
              
              // Step 5: Insert transaction
              console.log('\n💳 Step 5: Inserting transaction...');
              db.run(
                'INSERT INTO transactions (order_id, amount) VALUES (?, ?)',
                [order_id, total_amount],
                (err) => {
                  if (err) {
                    console.error('❌ Error inserting transaction:', err.message);
                    console.error('❌ Error code:', err.code);
                    db.close();
                    return;
                  }
                  
                  console.log('✅ Transaction inserted successfully!');
                  console.log('🎉 Complete order creation test passed!');
                  
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
            }
          }
        );
      });
    }
  );
});

