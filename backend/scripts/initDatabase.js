const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Initializing database...');

db.serialize(() => {
  // Users table (for counter and delivery staff)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('counter', 'delivery', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    category TEXT,
    is_available BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    customer_name TEXT,
    total_amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
    order_type TEXT NOT NULL DEFAULT 'dine-in' CHECK(order_type IN ('dine-in', 'takeaway', 'delivery')),
    created_by INTEGER,
    delivered_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME,
    FOREIGN KEY (created_by) REFERENCES users (id),
    FOREIGN KEY (delivered_by) REFERENCES users (id)
  )`);

  // Order items table
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    is_prepared BOOLEAN DEFAULT 0,
    prepared_at DATETIME,
    prepared_quantity INTEGER DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
  )`);

  // Transactions table for sales tracking
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders (id)
  )`);

  // Insert sample users
  const bcrypt = require('bcryptjs');
  const saltRounds = 10;
  
  // Create users synchronously within the serialize block
  const counterHash = bcrypt.hashSync('counter123', saltRounds);
  db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', 
         ['counter', counterHash, 'counter']);
  
  const deliveryHash = bcrypt.hashSync('delivery123', saltRounds);
  db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', 
         ['delivery', deliveryHash, 'delivery']);
  
  const adminHash = bcrypt.hashSync('admin123', saltRounds);
  db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', 
         ['admin', adminHash, 'admin']);

  console.log('Sample users created: counter, delivery, admin');

  // Clear existing data and insert new ones
  db.run('DELETE FROM transactions', [], (err) => {
    if (err) {
      console.error('Error clearing transactions:', err.message);
    }
  });
  
  db.run('DELETE FROM order_items', [], (err) => {
    if (err) {
      console.error('Error clearing order items:', err.message);
    }
  });
  
  db.run('DELETE FROM orders', [], (err) => {
    if (err) {
      console.error('Error clearing orders:', err.message);
    }
  });
  
  db.run('DELETE FROM products', [], (err) => {
    if (err) {
      console.error('Error clearing products:', err.message);
    } else {
      console.log('Existing data cleared');
    }
  });

          // Insert sample products
        const sampleProducts = [
          ['Iced Tea', 'Refreshing iced tea with lemon', 89.00, '/images/iced-tea.jpg', 'Beverage'],
          ['Hot Chocolate', 'Rich and creamy hot chocolate', 100.00, '/images/hot-chocolate.jpg', 'Beverage'],
          ['Lemon Mint Cooler', 'Cool and refreshing lemon mint drink', 60.00, '/images/lemon-mint.jpg', 'Beverage']
        ];

  sampleProducts.forEach(product => {
    db.run('INSERT OR REPLACE INTO products (name, description, price, image_url, category) VALUES (?, ?, ?, ?, ?)', 
           product);
  });
  
  console.log('Sample products created');
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database initialized successfully!');
  }
});
