const sqlite3 = require('sqlite3').verbose();
const { db: firestoreDb, auth: firebaseAuth } = require('./firebase-admin');

// Connect to existing SQLite database
const sqliteDb = new sqlite3.Database('./database.sqlite');

console.log('🚀 Starting migration from SQLite to Firebase...');

// Migration functions
const migrateUsers = () => {
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM users', async (err, users) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`📊 Found ${users.length} users to migrate`);
      
      for (const user of users) {
        try {
          // Store user data directly in Firestore (without Firebase Auth for now)
          await firestoreDb.collection('users').add({
            username: user.username,
            role: user.role,
            password_hash: user.password, // Keep the existing password hash from SQLite
            created_at: new Date(user.created_at),
            migrated_from_sqlite: true,
            firebase_auth_created: false // Flag to indicate this user needs Firebase Auth setup
          });
          
          console.log(`✅ Migrated user: ${user.username} (Firestore only)`);
        } catch (error) {
          console.log(`⚠️ Failed to migrate user ${user.username}:`, error.message);
        }
      }
      
      resolve();
    });
  });
};

const migrateProducts = () => {
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM products', async (err, products) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`📊 Found ${products.length} products to migrate`);
      
      for (const product of products) {
        try {
          await firestoreDb.collection('products').doc(product.id.toString()).set({
            name: product.name,
            description: product.description,
            price: product.price,
            image_url: product.image_url,
            category: product.category,
            is_available: product.is_available === 1,
            created_at: new Date(product.created_at),
            migrated_from_sqlite: true
          });
          
          console.log(`✅ Migrated product: ${product.name}`);
        } catch (error) {
          console.log(`⚠️ Failed to migrate product ${product.name}:`, error.message);
        }
      }
      
      resolve();
    });
  });
};

const migrateOrders = () => {
  return new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM orders', async (err, orders) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`📊 Found ${orders.length} orders to migrate`);
      
      for (const order of orders) {
        try {
          // Get order items
          const orderItems = await new Promise((resolveItems, rejectItems) => {
            sqliteDb.all('SELECT * FROM order_items WHERE order_id = ?', [order.id], (err, items) => {
              if (err) rejectItems(err);
              else resolveItems(items);
            });
          });
          
          // Create order in Firestore
          const orderData = {
            customer_name: order.customer_name,
            customer_id: order.customer_id,
            order_type: order.order_type,
            status: order.status,
            total_amount: order.total_amount,
            created_at: new Date(order.created_at),
            delivered_at: order.delivered_at ? new Date(order.delivered_at) : null,
            migrated_from_sqlite: true
          };
          
          // Only add delivered_by_user if it has a value
          if (order.delivered_by_user) {
            orderData.delivered_by_user = order.delivered_by_user;
          }
          
          const orderRef = await firestoreDb.collection('orders').add(orderData);
          
          // Add order items
          for (const item of orderItems) {
            // Get product name from products table
            const productName = await new Promise((resolveProduct, rejectProduct) => {
              sqliteDb.get('SELECT name FROM products WHERE id = ?', [item.product_id], (err, product) => {
                if (err) rejectProduct(err);
                else resolveProduct(product ? product.name : 'Unknown Product');
              });
            });
            
            await firestoreDb.collection('orders').doc(orderRef.id).collection('items').add({
              product_id: item.product_id,
              product_name: productName,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
              prepared_quantity: item.prepared_quantity || 0,
              is_prepared: item.is_prepared === 1,
              prepared_at: item.prepared_at ? new Date(item.prepared_at) : null,
              migrated_from_sqlite: true
            });
          }
          
          console.log(`✅ Migrated order: #${order.id}`);
        } catch (error) {
          console.log(`⚠️ Failed to migrate order #${order.id}:`, error.message);
        }
      }
      
      resolve();
    });
  });
};

// Main migration function
const runMigration = async () => {
  try {
    console.log('🔄 Starting migration...');
    
    // Check if Firebase is initialized
    if (!firestoreDb) {
      console.log('❌ Firebase Admin not initialized. Please check your service account credentials.');
      return;
    }
    
    // Run migrations
    await migrateUsers();
    await migrateProducts();
    await migrateOrders();
    
    console.log('🎉 Migration completed successfully!');
    console.log('📝 Note: Users will need to reset their passwords after migration.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    sqliteDb.close();
    process.exit(0);
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
