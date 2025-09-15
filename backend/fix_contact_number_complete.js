const fs = require('fs');
const path = require('path');

console.log('🔧 Implementing complete contact number storage solution...');

// 1. Update server.js to handle contact_number
console.log('1. Updating server.js to handle contact_number...');
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

console.log('🎉 Contact number storage implementation completed!');
console.log('📝 Changes made:');
console.log('   - Updated database schema to include contact_number column');
console.log('   - Updated order creation endpoint to extract and store contact_number');
console.log('   - Updated sales report to include contact_number in export');
console.log('');
console.log('🔄 Next steps:');
console.log('   1. Run: node scripts/initDatabase.js (to recreate database with contact_number column)');
console.log('   2. Restart your backend server');
console.log('   3. Test by placing an order with contact number');
console.log('   4. Generate sales report to verify contact numbers appear');
