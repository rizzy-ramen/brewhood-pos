import { db } from './src/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

// Function to update product image URLs
const updateProductImages = async () => {
  try {
    console.log('🚀 Starting to update product images in Firestore...');
    
    // Get all products
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    const imageUpdates = {
      'Iced Tea': 'https://firebasestorage.googleapis.com/v0/b/brewhood-pos.appspot.com/o/product-images%2Ficed-tea.jpg?alt=media',
      'Hot Chocolate': 'https://firebasestorage.googleapis.com/v0/b/brewhood-pos.appspot.com/o/product-images%2Fhot-chocolate.jpg?alt=media',
      'Lemon Mint Cooler': 'https://firebasestorage.googleapis.com/v0/b/brewhood-pos.appspot.com/o/product-images%2Flemon-mint.jpg?alt=media'
    };
    
    let updatedCount = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const product = docSnapshot.data();
      const productName = product.name;
      
      if (imageUpdates[productName]) {
        try {
          await updateDoc(doc(db, 'products', docSnapshot.id), {
            image_url: imageUpdates[productName]
          });
          console.log(`✅ Updated ${productName} with new image URL`);
          updatedCount++;
        } catch (error) {
          console.error(`❌ Failed to update ${productName}:`, error);
        }
      }
    }
    
    console.log(`🎉 Successfully updated ${updatedCount} products!`);
    console.log('🔄 Refresh your counter dashboard to see the images!');
    
  } catch (error) {
    console.error('❌ Error updating products:', error);
  }
};

// Run the update
updateProductImages().catch(console.error);
