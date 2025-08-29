import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import bcrypt from 'bcryptjs';

// Custom login function that works with your existing user data
export const loginUser = async (username, password) => {
  try {
    // Query Firestore for user
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error('Invalid credentials');
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('🔍 Found user:', userData);
    console.log('🔍 Password hash from DB:', userData.password_hash);
    console.log('🔍 Password entered:', password);
    console.log('🔍 Password match:', userData.password_hash === password);
    
    // Check password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, userData.password_hash);
    if (isPasswordValid) {
      // Create a custom email for Firebase Auth
      const email = `${username}@pos.local`;
      
      // For now, skip Firebase Auth and just return success
      // This allows the app to work immediately
      return {
        success: true,
        user: {
          id: userDoc.id,
          username: userData.username,
          role: userData.role,
          uid: null
        }
      };
    } else {
      throw new Error('Invalid credentials');
    }
  } catch (error) {
    throw error;
  }
};

// Logout function
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    throw error;
  }
};

// Get current user
export const getCurrentUser = () => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return auth.currentUser !== null;
};
