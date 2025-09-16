const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'pos_database.db');

console.log('🔍 Verifying database schema...');
console.log('Database path:', dbPath);

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Check orders table schema
db.all('PRAGMA table_info(orders)', (err, rows) => {
  if (err) {
    console.error('❌ Error getting table info:', err.message);
  } else {
    console.log('\n📋 Orders table columns:');
    console.log('========================');
    rows.forEach(row => {
      console.log(`- ${row.name} (${row.type}) ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    // Check if contact_number column exists
    const hasContactNumber = rows.some(row => row.name === 'contact_number');
    console.log('\n🔍 Contact number column exists:', hasContactNumber ? '✅ YES' : '❌ NO');
    
    if (hasContactNumber) {
      console.log('🎉 Database schema is correct! Contact number support is ready.');
    } else {
      console.log('⚠️  Contact number column is missing. Run: node scripts/initDatabase.js');
    }
  }
  
  // Close database connection
  db.close((err) => {
    if (err) {
      console.error('❌ Error closing database:', err.message);
    } else {
      console.log('\n✅ Database connection closed');
    }
  });
});

