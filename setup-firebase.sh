#!/bin/bash

echo "🔥 Firebase Setup Script for POS App"
echo "====================================="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "📦 Installing Firebase CLI..."
    npm install -g firebase-tools
else
    echo "✅ Firebase CLI already installed"
fi

echo ""
echo "🚀 Next Steps:"
echo "1. Go to https://console.firebase.google.com"
echo "2. Create a new project or select existing one"
echo "3. Add a web app to get your config"
echo "4. Go to Project Settings → Service Accounts"
echo "5. Generate new private key and save as 'backend/serviceAccountKey.json'"
echo "6. Update 'frontend/src/firebase.js' with your config"
echo "7. Run: npm run migrate-firebase"
echo ""
echo "📖 See FIREBASE_SETUP_GUIDE.md for detailed instructions"
echo ""

# Check if service account key exists
if [ -f "backend/serviceAccountKey.json" ]; then
    echo "✅ Service account key found"
    echo "🚀 Ready to run migration!"
    echo "Run: npm run migrate-firebase"
else
    echo "⚠️  Service account key not found"
    echo "Please download it from Firebase Console and save as 'backend/serviceAccountKey.json'"
fi

echo ""
echo "🎯 After setup, your app will be accessible from anywhere!"
echo "🌐 Deploy to Firebase Hosting for global access"
