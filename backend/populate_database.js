const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'pos_database.db');

console.log('🔧 Populating database with sample data...');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Clear existing data
console.log('🧹 Clearing existing data...');
db.serialize(() => {
  db.run('DELETE FROM order_items');
  db.run('DELETE FROM orders');
  db.run('DELETE FROM transactions');
  db.run('DELETE FROM products');
  db.run('DELETE FROM users');
  
  // Insert sample users
  console.log('👥 Creating users...');
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPassword, 'admin']);
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['counter', hashedPassword, 'counter']);
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['delivery', hashedPassword, 'delivery']);
  
  console.log('✅ Users created: admin, counter, delivery');
  
  // Insert sample products
  console.log('📦 Creating products...');
  const products = [
    ['Coffee', 'Fresh brewed coffee', 50, '/images/coffee.jpg', 'Beverages'],
    ['Tea', 'Aromatic tea', 30, '/images/tea.jpg', 'Beverages'],
    ['Sandwich', 'Delicious sandwich', 120, '/images/sandwich.jpg', 'Food'],
    ['Cake', 'Sweet cake slice', 80, '/images/cake.jpg', 'Dessert']
  ];

  const stmt = db.prepare('INSERT INTO products (name, description, price, image_url, category) VALUES (?, ?, ?, ?, ?)');
  products.forEach(product => {
    stmt.run(product);
  });
  stmt.finalize();

  console.log('✅ Products created: Coffee, Tea, Sandwich, Cake');
  console.log('🎉 Database populated successfully!');
});

// Close database connection
db.close((err) => {
  if (err) {
    console.error('❌ Error closing database:', err.message);
  } else {
    console.log('✅ Database connection closed');
  }
});
