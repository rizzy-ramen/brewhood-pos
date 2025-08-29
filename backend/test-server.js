// Simple test script to verify backend setup
const { initializeFirebase } = require('./src/config/firebase');

console.log('🧪 Testing backend setup...');

// Test Firebase initialization
try {
  console.log('🔥 Testing Firebase initialization...');
  const app = initializeFirebase();
  console.log('✅ Firebase initialized successfully!');
  console.log('🔥 App name:', app.name);
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  console.log('💡 Make sure you have:');
  console.log('   1. Created a .env file with Firebase credentials');
  console.log('   2. Downloaded Firebase service account key');
  console.log('   3. Set correct FIREBASE_PROJECT_ID');
}

console.log('\n📋 Backend setup test completed!');
console.log('💡 Next steps:');
console.log('   1. Create .env file with your Firebase credentials');
console.log('   2. Run: npm run dev');
console.log('   3. Test API endpoints');
console.log('   4. Integrate with your frontend');
