const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'pos_database.db');

console.log('🔍 Checking database status...');
console.log('Database path:', dbPath);

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Check what tables exist
console.log('\n📋 Checking tables...');
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('❌ Error getting tables:', err.message);
  } else {
    console.log('Tables found:', tables.map(t => t.name));
  }
  
  // Check users table
  console.log('\n👥 Checking users...');
  db.all('SELECT id, username, role FROM users', (err, users) => {
    if (err) {
      console.error('❌ Error getting users:', err.message);
    } else {
      console.log('Users found:', users.length);
      users.forEach(user => {
        console.log(`- ${user.username} (${user.role})`);
      });
    }
    
    // Check products table
    console.log('\n📦 Checking products...');
    db.all('SELECT id, name, price FROM products', (err, products) => {
      if (err) {
        console.error('❌ Error getting products:', err.message);
      } else {
        console.log('Products found:', products.length);
        products.forEach(product => {
          console.log(`- ${product.name} (₹${product.price})`);
        });
      }
      
      // Close database connection
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err.message);
        } else {
          console.log('\n✅ Database check completed');
        }
      });
    });
  });
});

