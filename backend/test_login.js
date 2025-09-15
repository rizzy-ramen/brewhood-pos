const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'pos_database.db');

console.log('🔐 Testing login credentials...');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Test credentials
const testCredentials = [
  { username: 'admin', password: 'admin123' },
  { username: 'counter', password: 'admin123' },
  { username: 'delivery', password: 'admin123' }
];

let completed = 0;

testCredentials.forEach(({ username, password }) => {
  console.log(`\n🔍 Testing ${username}...`);
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      console.error(`❌ Database error for ${username}:`, err.message);
    } else if (!user) {
      console.log(`❌ User ${username} not found in database`);
    } else {
      console.log(`✅ User ${username} found:`, { id: user.id, username: user.username, role: user.role });
      
      // Test password
      const isValid = await bcrypt.compare(password, user.password);
      console.log(`🔐 Password '${password}' is ${isValid ? 'VALID' : 'INVALID'} for ${username}`);
      
      if (!isValid) {
        console.log(`🔍 Stored password hash: ${user.password}`);
        console.log(`🔍 Expected password hash: ${bcrypt.hashSync(password, 10)}`);
      }
    }
    
    completed++;
    if (completed === testCredentials.length) {
      db.close();
    }
  });
});
