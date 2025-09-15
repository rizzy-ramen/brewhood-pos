// This shows the changes needed in server.js for contact number support

// Line 278: Update the destructuring to include contact_number
const { customer_name, contact_number, items, order_type = 'dine-in' } = req.body;

// Line 317: Update the INSERT query to include contact_number
'INSERT INTO orders (customer_name, contact_number, total_amount, order_type, created_by) VALUES (?, ?, ?, ?, ?)',

// Line 318: Update the parameters array to include contact_number
[customer_name, contact_number, total_amount, order_type, created_by],
