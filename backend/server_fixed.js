// This is a patch file showing the changes needed in server.js
// The order creation endpoint needs to be updated to:

// 1. Extract contact_number from request body (line 278):
const { customer_name, contact_number, items, order_type = 'dine-in' } = req.body;

// 2. Update the INSERT query to include contact_number (line 317):
db.run(
  'INSERT INTO orders (customer_name, contact_number, total_amount, order_type, created_by) VALUES (?, ?, ?, ?, ?)',
  [customer_name, contact_number, total_amount, order_type, created_by],
  function(err) {
    // ... rest of the function
  }
);
