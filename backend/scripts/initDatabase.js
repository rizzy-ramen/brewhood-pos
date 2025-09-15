const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '..', 'pos_database.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

console.log('Initializing database...');

// Clear existing data
db.serialize(() => {
  // Drop existing tables
  db.run('DROP TABLE IF EXISTS order_items');
  db.run('DROP TABLE IF EXISTS transactions');
  db.run('DROP TABLE IF EXISTS orders');
  db.run('DROP TABLE IF EXISTS products');
  db.run('DROP TABLE IF EXISTS users');

  // Users table
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'counter', 'delivery')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Products table
  db.run(`CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    category TEXT,
    is_available BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Orders table - Updated to include contact_number
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    contact_number TEXT,
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
  db.run(`CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    prepared_quantity INTEGER DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products (id)
  )`);

  // Transactions table
  db.run(`CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
  )`);

  // Insert sample users
  const bcrypt = require('bcryptjs');
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  
  console.log('👥 Creating users...');
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPassword, 'admin'], function(err) {
    if (err) console.error('Error creating admin user:', err.message);
    else console.log('✅ Admin user created');
  });
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['counter', hashedPassword, 'counter'], function(err) {
    if (err) console.error('Error creating counter user:', err.message);
    else console.log('✅ Counter user created');
  });
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['delivery', hashedPassword, 'delivery'], function(err) {
    if (err) console.error('Error creating delivery user:', err.message);
    else console.log('✅ Delivery user created');
  });
  
  console.log('Sample users created: counter, delivery, admin');

  // Insert sample products
  console.log('📦 Creating products...');
  const products = [
    ['Hot Chocolate', 'Rich and creamy hot chocolate', 100, '/images/hot-chocolate.jpg', 'Beverages'],
    ['Iced Tea', 'Refreshing iced tea', 60, '/images/iced-tea.jpg', 'Beverages'],
    ['Lemon Mint', 'Fresh lemon mint drink', 80, '/images/lemon-mint.jpg', 'Beverages'],
    ['Coffee', 'Fresh brewed coffee', 50, '/images/brewhood-logo.png', 'Beverages']
  ];

  const stmt = db.prepare('INSERT INTO products (name, description, price, image_url, category) VALUES (?, ?, ?, ?, ?)');
  products.forEach((product, index) => {
    stmt.run(product, function(err) {
      if (err) console.error(`Error creating product ${product[0]}:`, err.message);
      else console.log(`✅ Product created: ${product[0]}`);
    });
  });
  stmt.finalize();

  console.log('Sample products created');
  console.log('Database initialized successfully!');
});

// Close database connection
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database connection closed');
  }
});