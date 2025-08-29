# 🖼️ Fix Image Loading Issue

## Problem
The counter dashboard shows "No Image" because the products have local file paths like `/images/iced-tea.jpg` that don't exist on Firebase Hosting.

## Solution
Upload the images to Firebase Storage and update the product URLs in Firestore.

## Step 1: Upload Images to Firebase Storage

1. **Go to Firebase Console**: [https://console.firebase.google.com/project/brewhood-pos/storage](https://console.firebase.google.com/project/brewhood-pos/storage)

2. **Create Storage Bucket** (if not exists):
   - Click "Get Started"
   - Choose a location (us-central1 recommended)
   - Start in test mode

3. **Upload Images**:
   - Create a folder called `product-images`
   - Upload these files from `backend/public/images/`:
     - `iced-tea.jpg`
     - `hot-chocolate.jpg`
     - `lemon-mint.jpg`

## Step 2: Get Image URLs

1. **For each uploaded image**:
   - Click on the image
   - Click "Download" button
   - Copy the URL from the address bar

2. **The URLs will look like**:
   ```
   https://firebasestorage.googleapis.com/v0/b/brewhood-pos.appspot.com/o/product-images%2Ficed-tea.jpg?alt=media
   ```

## Step 3: Update Products in Firestore

1. **Go to Firestore**: [https://console.firebase.google.com/project/brewhood-pos/firestore](https://console.firebase.google.com/project/brewhood-pos/firestore)

2. **Find the products collection** and update each product:

   **Iced Tea**:
   - Set `image_url` to the iced-tea.jpg URL

   **Hot Chocolate**:
   - Set `image_url` to the hot-chocolate.jpg URL

   **Lemon Mint Cooler**:
   - Set `image_url` to the lemon-mint.jpg URL

## Alternative: Quick Fix Script

If you want to run a script to update the URLs automatically:

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Run the update script**:
   ```bash
   cd frontend
   node updateProductImages.js
   ```

## Result
After updating the image URLs, refresh your counter dashboard and you should see the actual product images instead of emoji placeholders!

## Note
Make sure your Firebase Storage rules allow public read access to the images, or the images won't load.
