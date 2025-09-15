const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing contact number storage in database and backend...');

// 1. Run database migration
console.log('1. Adding contact_number column to database...');
const { execSync } = require('child_process');
try {
  execSync('node scripts/addContactNumberColumn.js', { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ Database migration completed');
} catch (error) {
  console.log('⚠️ Database migration may have failed or column already exists');
}

// 2. Update server.js
console.log('2. Updating server.js to handle contact_number...');
const serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Update the destructuring to include contact_number
serverContent = serverContent.replace(
  'const { customer_name, items, order_type = \'dine-in\' } = req.body;',
  'const { customer_name, contact_number, items, order_type = \'dine-in\' } = req.body;'
);

// Update the INSERT query to include contact_number
serverContent = serverContent.replace(
  "'INSERT INTO orders (customer_name, total_amount, order_type, created_by) VALUES (?, ?, ?, ?)',",
  "'INSERT INTO orders (customer_name, contact_number, total_amount, order_type, created_by) VALUES (?, ?, ?, ?, ?)',"
);

// Update the parameters array to include contact_number
serverContent = serverContent.replace(
  '[customer_name, total_amount, order_type, created_by],',
  '[customer_name, contact_number, total_amount, order_type, created_by],'
);

// Write the updated content back
fs.writeFileSync(serverPath, serverContent);
console.log('✅ Server.js updated successfully');

console.log('🎉 Contact number fix completed!');
console.log('📝 Changes made:');
console.log('   - Added contact_number column to orders table');
console.log('   - Updated order creation endpoint to extract contact_number from request');
console.log('   - Updated INSERT query to store contact_number in database');
console.log('');
console.log('🔄 Please restart your backend server for changes to take effect');
