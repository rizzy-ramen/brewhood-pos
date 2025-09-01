const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Try to load .env file, but don't fail if it doesn't exist
try {
  require('dotenv').config();
} catch (error) {
  console.log('No .env file found, using default values');
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000", 
      "http://192.168.1.6:3000", 
      "http://192.168.1.29:3000",
      "https://brewhood-pos.web.app",
      "https://brewhood-pos.firebaseapp.com"
    ],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'food-stall-pos-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Database connection
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('Auth middleware - authHeader:', authHeader);
  console.log('Auth middleware - token:', token);

  if (!token) {
    console.log('Auth middleware - No token provided');
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Auth middleware - JWT verification failed:', err.message);
      return res.sendStatus(403);
    }
    console.log('Auth middleware - JWT verified, user:', user);
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  });
});

// Product Routes
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products WHERE is_available = 1 ORDER BY category, name', (err, products) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(products);
  });
});

app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(product);
  });
});

// Order Routes
app.post('/api/orders', authenticateToken, (req, res) => {
  const { customer_name, items, order_type = 'dine-in' } = req.body;

  const created_by = req.user.id;
  
  // Calculate total amount
  let total_amount = 0;
  const orderItems = [];
  
  // First, get all product prices
  const productIds = items.map(item => item.product_id);
  const placeholders = productIds.map(() => '?').join(',');
  
  db.all(`SELECT id, price FROM products WHERE id IN (${placeholders})`, productIds, (err, products) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const productPrices = {};
    products.forEach(product => {
      productPrices[product.id] = product.price;
    });
    
    // Calculate total and prepare order items
    items.forEach(item => {
      const unit_price = productPrices[item.product_id];
      const total_price = unit_price * item.quantity;
      total_amount += total_price;
      
      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price,
        total_price
      });
    });
    
    // Insert order
    db.run(
      'INSERT INTO orders (customer_name, total_amount, order_type, created_by) VALUES (?, ?, ?, ?)',
      [customer_name, total_amount, order_type, created_by],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        const order_id = this.lastID;
        
        // Insert order items
        const insertItem = (item, callback) => {
          db.run(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
            [order_id, item.product_id, item.quantity, item.unit_price, item.total_price],
            callback
          );
        };
        
        // Insert all items
        let completed = 0;
        orderItems.forEach((item, index) => {
          insertItem(item, (err) => {
            if (err) {
              console.error('Error inserting order item:', err);
            }
            completed++;
            if (completed === orderItems.length) {
              // Insert transaction record
              db.run(
                'INSERT INTO transactions (order_id, amount) VALUES (?, ?)',
                [order_id, total_amount],
                (err) => {
                  if (err) {
                    console.error('Error creating transaction:', err);
                  }
                  
                  // Get the order with items for real-time update
                  db.all(`
                    SELECT oi.*, p.name as product_name
                    FROM order_items oi
                    JOIN products p ON oi.product_id = p.id
                    WHERE oi.order_id = ?
                  `, [order_id], (err, items) => {
                    const newOrder = {
                      id: order_id,
                      order_id,

                      customer_name,
                      total_amount,
                      status: 'pending',
                      order_type,
                      created_at: new Date().toISOString(),
                      items: items || []
                    };
                    
                    // Emit new order event to all connected clients
                    io.emit('orderCreated', newOrder);
                    
                    res.json(newOrder);
                  });
                }
              );
            }
          });
        });
      }
    );
  });
});

app.get('/api/orders', authenticateToken, (req, res) => {
  const { status, limit = 50 } = req.query;
  let query = `
    SELECT o.*, u1.username as created_by_user, u2.username as delivered_by_user
    FROM orders o
    LEFT JOIN users u1 ON o.created_by = u1.id
    LEFT JOIN users u2 ON o.delivered_by = u2.id
  `;
  
  const params = [];
  
  if (status) {
    query += ' WHERE o.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY o.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, orders) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Fetch items for each order
    let completed = 0;
    const ordersWithItems = orders.map(order => ({ ...order, items: [] }));
    
    if (orders.length === 0) {
      res.json(orders);
      return;
    }
    
    orders.forEach((order, index) => {
      db.all(`
        SELECT oi.*, p.name as product_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [order.id], (err, items) => {
        if (!err) {
          ordersWithItems[index].items = items;
        }
        
        completed++;
        if (completed === orders.length) {
          res.json(ordersWithItems);
        }
      });
    });
  });
});

app.get('/api/orders/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // Get order details
  db.get(`
    SELECT o.*, u1.username as created_by_user, u2.username as delivered_by_user
    FROM orders o
    LEFT JOIN users u1 ON o.created_by = u1.id
    LEFT JOIN users u2 ON o.delivered_by = u2.id
    WHERE o.id = ?
  `, [id], (err, order) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    // Get order items
    db.all(`
      SELECT oi.*, p.name as product_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [id], (err, items) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      order.items = items;
      res.json(order);
    });
  });
});

app.put('/api/orders/:id/status', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const user_id = req.user.id;
  
  let updateQuery = 'UPDATE orders SET status = ?';
  let params = [status];
  
  // If marking as delivered, record who delivered it and when
  if (status === 'delivered') {
    updateQuery += ', delivered_by = ?, delivered_at = ?';
    params.push(user_id, new Date().toISOString());
  }
  
  updateQuery += ' WHERE id = ?';
  params.push(id);
  
  db.run(updateQuery, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    // Get updated order details and emit to all clients
    db.get(`
      SELECT o.*, u1.username as created_by_user, u2.username as delivered_by_user
      FROM orders o
      LEFT JOIN users u1 ON o.created_by = u1.id
      LEFT JOIN users u2 ON o.delivered_by = u2.id
      WHERE o.id = ?
    `, [id], (err, updatedOrder) => {
      if (!err && updatedOrder) {
        // Get items for the updated order
        db.all(`
          SELECT oi.*, p.name as product_name
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `, [id], (err, items) => {
          updatedOrder.items = items || [];
          
          // Emit order status update to all connected clients
          io.emit('orderStatusUpdated', {
            orderId: id,
            status,
            order: updatedOrder
          });
        });
      }
    });
    
    res.json({ message: 'Order status updated successfully' });
  });
});

// Sales Analytics Routes
app.get('/api/analytics/sales', authenticateToken, (req, res) => {
  const { startDate, endDate } = req.query;
  
  let query = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as order_count,
      SUM(total_amount) as daily_revenue
    FROM orders 
    WHERE status = 'delivered'
  `;
  
  const params = [];
  
  if (startDate && endDate) {
    query += ' AND DATE(created_at) BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }
  
  query += ' GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30';
  
  db.all(query, params, (err, salesData) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Get total stats
    db.get(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value
      FROM orders 
      WHERE status = 'delivered'
      ${startDate && endDate ? 'AND DATE(created_at) BETWEEN ? AND ?' : ''}
    `, startDate && endDate ? [startDate, endDate] : [], (err, totals) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        daily_sales: salesData,
        totals
      });
    });
  });
});

// Customer lookup by customer name
app.get('/api/customers/:customer_name/orders', authenticateToken, (req, res) => {
  const { customer_name } = req.params;
  
  db.all(`
    SELECT * FROM orders 
    WHERE customer_name = ? 
    ORDER BY created_at DESC
  `, [customer_name], (err, orders) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(orders);
  });
});

// Update individual order item preparation count
app.put('/api/orders/:orderId/items/:itemId/prepared', authenticateToken, (req, res) => {
  const { orderId, itemId } = req.params;
  const { prepared_quantity } = req.body;
  
  // Validate prepared_quantity
  if (typeof prepared_quantity !== 'number' || prepared_quantity < 0) {
    return res.status(400).json({ error: 'Invalid prepared_quantity' });
  }
  
  // Get current item to validate against total quantity
  db.get('SELECT quantity FROM order_items WHERE id = ? AND order_id = ?', [itemId, orderId], (err, item) => {
    if (err || !item) {
      return res.status(404).json({ error: 'Order item not found' });
    }
    
    // Ensure prepared_quantity doesn't exceed total quantity
    const finalPreparedQuantity = Math.min(prepared_quantity, item.quantity);
    
    // Set prepared_at timestamp if this is the first time any quantity is prepared
    // or clear it if going back to 0
    const prepared_at = finalPreparedQuantity > 0 ? new Date().toISOString() : null;
    const is_prepared = finalPreparedQuantity >= item.quantity; // Fully prepared flag
    
    db.run(
      'UPDATE order_items SET prepared_quantity = ?, is_prepared = ?, prepared_at = ? WHERE id = ? AND order_id = ?',
      [finalPreparedQuantity, is_prepared, prepared_at, itemId, orderId],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        if (this.changes === 0) {
          res.status(404).json({ error: 'Order item not found' });
          return;
        }
        
        // Get updated order with all items to emit real-time update
        db.get(`
          SELECT o.*, u1.username as created_by_user, u2.username as delivered_by_user
          FROM orders o
          LEFT JOIN users u1 ON o.created_by = u1.id
          LEFT JOIN users u2 ON o.delivered_by = u2.id
          WHERE o.id = ?
        `, [orderId], (err, updatedOrder) => {
          if (!err && updatedOrder) {
            // Get all items for the order
            db.all(`
              SELECT oi.*, p.name as product_name
              FROM order_items oi
              JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = ?
            `, [orderId], (err, items) => {
              updatedOrder.items = items || [];
              
              // Emit item preparation update to all connected clients
              io.emit('itemPreparationUpdated', {
                orderId,
                itemId,
                prepared_quantity: finalPreparedQuantity,
                order: updatedOrder
              });
            });
          }
        });
        
        res.json({ 
          message: 'Item preparation count updated successfully',
          prepared_quantity: finalPreparedQuantity 
        });
      }
    );
  });
});

// Admin Routes - Product Management
app.post('/api/admin/products', authenticateToken, (req, res) => {
  console.log('Admin route accessed, user:', req.user);
  // Check if user is admin
  if (req.user.role !== 'admin') {
    console.log('Access denied, user role:', req.user.role);
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { name, description, price, image_url, category } = req.body;
  
  // Validation
  if (!name || !price || price <= 0) {
    return res.status(400).json({ error: 'Name and valid price are required' });
  }
  
  db.run(
    'INSERT INTO products (name, description, price, image_url, category, is_available) VALUES (?, ?, ?, ?, ?, 1)',
    [name, description, price, image_url, category],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Get the newly created product
      db.get('SELECT * FROM products WHERE id = ?', [this.lastID], (err, product) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // Emit real-time update to all clients
        io.emit('productCreated', product);
        
        res.status(201).json({
          message: 'Product created successfully',
          product
        });
      });
    }
  );
});

app.put('/api/admin/products/:id', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { id } = req.params;
  const { name, description, price, image_url, category, is_available } = req.body;
  
  console.log('Admin updating product:', { id, name, description, price, image_url, category, is_available });
  console.log('is_available type:', typeof is_available, 'value:', is_available);
  console.log('is_available === true:', is_available === true);
  console.log('is_available === false:', is_available === false);
  console.log('is_available === undefined:', is_available === undefined);
  
  // Validation
  if (!name || !price || price <= 0) {
    return res.status(400).json({ error: 'Name and valid price are required' });
  }
  
  // First, get the current product to preserve ALL its fields
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, currentProduct) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!currentProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Preserve the current is_available status unless explicitly provided
    const isAvailableValue = is_available !== undefined ? (is_available === true ? 1 : 0) : currentProduct.is_available;
    
    // Preserve existing values if new values are empty strings or undefined
    const finalName = name || currentProduct.name;
    const finalDescription = description !== '' ? (description || currentProduct.description) : currentProduct.description;
    const finalImageUrl = image_url !== '' ? (image_url || currentProduct.image_url) : currentProduct.image_url;
    const finalCategory = category !== '' ? (category || currentProduct.category) : currentProduct.category;
    
    console.log('Current product is_available from DB:', currentProduct.is_available);
    console.log('Received is_available from request:', is_available);
    console.log('Calculated isAvailableValue:', isAvailableValue);
    console.log('Will set is_available to:', isAvailableValue);
    console.log('Preserving fields - name:', finalName, 'description:', finalDescription, 'image_url:', finalImageUrl, 'category:', finalCategory);
    
    db.run(
      'UPDATE products SET name = ?, description = ?, price = ?, image_url = ?, category = ?, is_available = ? WHERE id = ?',
      [finalName, finalDescription, price, finalImageUrl, finalCategory, isAvailableValue, id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Product not found' });
        }
        
        // Get the updated product
        db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          // Emit real-time update to all clients
          io.emit('productUpdated', product);
          
          res.json({
            message: 'Product updated successfully',
            product
          });
        });
      }
    );
  });
});

app.delete('/api/admin/products/:id', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { id } = req.params;
  
  // Check if product is used in any orders
  db.get('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?', [id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (result.count > 0) {
      // Instead of deleting, mark as unavailable
      db.run('UPDATE products SET is_available = 0 WHERE id = ?', [id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // Get the updated product
        db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          // Emit real-time update to all clients
          io.emit('productUpdated', product);
          
          res.json({
            message: 'Product marked as unavailable (cannot delete products with order history)',
            product
          });
        });
      });
    } else {
      // Safe to delete
      db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Product not found' });
        }
        
        // Emit real-time update to all clients
        io.emit('productDeleted', { id: parseInt(id) });
        
        res.json({
          message: 'Product deleted successfully'
        });
      });
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Food Stall POS API is running' });
});

// Debug endpoint to check all products
app.get('/api/debug/products', (req, res) => {
  db.all('SELECT * FROM products', (err, products) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ 
      count: products.length, 
      products: products.map(p => ({ 
        id: p.id, 
        name: p.name, 
        description: p.description,
        price: p.price,
        image_url: p.image_url,
        category: p.category,
        is_available: p.is_available,
        created_at: p.created_at
      }))
    });
  });
});

// Admin endpoint to get all products with full details
app.get('/api/admin/products', authenticateToken, (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  db.all('SELECT * FROM products ORDER BY category, name', (err, products) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(products);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://192.168.1.29:${PORT}`);
  console.log(`Socket.io server is ready for real-time updates`);
});
