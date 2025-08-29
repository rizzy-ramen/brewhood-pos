import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your Firebase configuration
// Replace these values with your actual Firebase app credentials
const firebaseConfig = {
  apiKey: "AIzaSyAyepv5_lsNsbtVWeJI_wsujeern7fKtno",
  authDomain: "brewhood-pos.firebaseapp.com",
  projectId: "brewhood-pos",
  storageBucket: "brewhood-pos.firebasestorage.app",
  messagingSenderId: "618394274544",
  appId: "1:618394274544:web:30ab1cf601448efee45035",
  measurementId: "G-CS37YX5K1J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Debug logging
console.log('🔥 Firebase initialized with config:', firebaseConfig);
console.log('🔥 Project ID:', firebaseConfig.projectId);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

console.log('🔥 Firestore instance:', db);
console.log('🔥 Auth instance:', auth);

export default app;
