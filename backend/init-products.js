// Script to initialize default products in Firestore
require('dotenv').config();
const { initializeFirebase, getFirestore } = require('./src/config/firebase');

const defaultProducts = [
  {
    name: 'Iced Tea',
    description: 'Refreshing iced tea with a hint of lemon',
    price: 89,
    category: 'Beverage',
    image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400',
    is_available: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    name: 'Hot Chocolate',
    description: 'Rich and creamy hot chocolate',
    price: 100,
    category: 'Beverage',
    image_url: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400',
    is_available: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    name: 'Lemon Mint Cooler',
    description: 'Fresh lemon mint cooler with ice',
    price: 60,
    category: 'Beverage',
    image_url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400',
    is_available: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    name: 'Cappuccino',
    description: 'Classic Italian cappuccino with foamed milk',
    price: 120,
    category: 'Coffee',
    image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400',
    is_available: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    name: 'Espresso',
    description: 'Strong single shot of espresso',
    price: 80,
    category: 'Coffee',
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400',
    is_available: true,
    created_at: new Date(),
    updated_at: new Date()
  }
];

async function initializeProducts() {
  try {
    console.log('🚀 Initializing Firebase...');
    initializeFirebase();
    
    const db = getFirestore();
    console.log('✅ Firebase initialized successfully');
    
    // Check if products already exist
    const productsRef = db.collection('products');
    const snapshot = await productsRef.get();
    
    if (!snapshot.empty) {
      console.log(`📦 Found ${snapshot.size} existing products, skipping initialization`);
      return;
    }
    
    console.log('📦 No existing products found, creating default products...');
    
    // Add default products
    const batch = db.batch();
    
    defaultProducts.forEach(product => {
      const productRef = productsRef.doc();
      batch.set(productRef, product);
    });
    
    await batch.commit();
    
    console.log(`✅ Successfully created ${defaultProducts.length} default products`);
    console.log('📋 Products created:');
    defaultProducts.forEach(product => {
      console.log(`  - ${product.name}: ₹${product.price}`);
    });
    
  } catch (error) {
    console.error('❌ Error initializing products:', error);
    process.exit(1);
  }
}

// Run the initialization
if (require.main === module) {
  initializeProducts()
    .then(() => {
      console.log('🎉 Product initialization complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Product initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeProducts };
