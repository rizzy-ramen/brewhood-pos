import { storage } from './src/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Function to upload image to Firebase Storage
const uploadImageToFirebase = async (filePath, fileName) => {
  try {
    // Read the file from the backend public/images directory
    const response = await fetch(`http://localhost:5000${filePath}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filePath}`);
    }
    
    const blob = await response.blob();
    
    // Create a reference to Firebase Storage
    const storageRef = ref(storage, `product-images/${fileName}`);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, blob);
    console.log(`✅ Uploaded ${fileName}`);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`🔗 Download URL for ${fileName}:`, downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error(`❌ Error uploading ${fileName}:`, error);
    return null;
  }
};

// Main function to upload all images
const uploadAllImages = async () => {
  console.log('🚀 Starting image upload to Firebase Storage...');
  
  const images = [
    { path: '/images/iced-tea.jpg', name: 'iced-tea.jpg' },
    { path: '/images/hot-chocolate.jpg', name: 'hot-chocolate.jpg' },
    { path: '/images/lemon-mint.jpg', name: 'lemon-mint.jpg' }
  ];
  
  const results = {};
  
  for (const image of images) {
    const url = await uploadImageToFirebase(image.path, image.name);
    if (url) {
      results[image.name] = url;
    }
  }
  
  console.log('📋 Upload Results:', results);
  
  // Now update the products in Firestore with the new image URLs
  if (Object.keys(results).length > 0) {
    console.log('🔄 Now you need to update the products in Firestore with these URLs:');
    console.log('Iced Tea:', results['iced-tea.jpg']);
    console.log('Hot Chocolate:', results['hot-chocolate.jpg']);
    console.log('Lemon Mint Cooler:', results['lemon-mint.jpg']);
  }
};

// Run the upload
uploadAllImages().catch(console.error);
