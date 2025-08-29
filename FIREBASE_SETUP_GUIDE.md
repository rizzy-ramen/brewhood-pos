# 🔥 Firebase Migration Guide for POS App

## 📋 Prerequisites
- Firebase project created at [console.firebase.google.com](https://console.firebase.google.com)
- Node.js and npm installed
- Your existing POS app running with SQLite

## 🚀 Step-by-Step Setup

### 1. Get Firebase Configuration

#### Frontend Config (firebase.js)
1. Go to your Firebase Console
2. Click on your project
3. Click the gear icon ⚙️ → Project Settings
4. Scroll down to "Your apps" section
5. Click "Add app" → Web app
6. Copy the config object and replace the placeholder values in `frontend/src/firebase.js`

#### Backend Service Account
1. In Firebase Console, go to Project Settings
2. Click "Service accounts" tab
3. Click "Generate new private key"
4. Download the JSON file
5. Rename it to `serviceAccountKey.json` and place it in the `backend/` folder

### 2. Update Firebase Rules

#### Firestore Rules
Go to Firestore → Rules and update with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Products are readable by all authenticated users
    match /products/{productId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Orders are readable by all authenticated users
    match /orders/{orderId} {
      allow read, write: if request.auth != null;
      
      // Order items
      match /items/{itemId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

#### Storage Rules
Go to Storage → Rules and update with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.token.role == 'admin';
    }
  }
}
```

### 3. Run Migration

```bash
# Make sure you have the service account key file
cd backend
node migrateToFirebase.js
```

### 4. Test Firebase Connection

```bash
# Frontend
cd frontend
npm start

# Backend
cd backend
npm run dev
```

## 🔧 Configuration Files

### Frontend (firebase.js)
```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### Backend (serviceAccountKey.json)
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

## 📱 Access Your App

After migration, your app will be accessible from anywhere:
- **Local**: `http://localhost:3000`
- **Network**: `http://192.168.1.6:3000`
- **Internet**: Deploy to Firebase Hosting for global access

## 🚨 Important Notes

1. **Backup your SQLite database** before migration
2. **Users will need to reset passwords** after migration
3. **Test thoroughly** before going live
4. **Monitor Firebase usage** and costs

## 🆘 Troubleshooting

### Common Issues:
- **Service account not found**: Check file path and permissions
- **Permission denied**: Verify Firestore rules
- **Authentication failed**: Check Firebase config values
- **Migration errors**: Ensure all required fields exist

### Support:
- Check Firebase Console for errors
- Review Firebase documentation
- Check browser console for frontend errors
- Check server logs for backend errors

## 🎯 Next Steps

1. **Complete the migration** using this guide
2. **Test all functionality** thoroughly
3. **Deploy to Firebase Hosting** for production
4. **Set up custom domain** if needed
5. **Monitor performance** and costs

---

**Need help?** Check the Firebase documentation or create an issue in your project repository.
