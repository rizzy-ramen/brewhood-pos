// DEPRECATED: This file is no longer used
// All Firestore operations have been migrated to the SQLite backend API
// 
// The frontend now uses:
// - apiService for all data operations
// - websocketService for real-time updates
// - backendAuth for authentication
//
// This file is kept for reference but should not be imported anywhere.

console.warn('⚠️ firestoreService.js is deprecated. Use apiService instead.');

// Empty exports to prevent import errors
export const productsService = {};
export const ordersService = {};
export const realtimeService = {};