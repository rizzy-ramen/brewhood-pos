# 🚀 POS System Backend

A robust, scalable backend for your POS system with real-time updates via WebSocket, built with Node.js, Express, and Socket.io.

## ✨ Features

- **Real-time Updates**: Instant order updates via WebSocket
- **RESTful API**: Comprehensive order management endpoints
- **Authentication**: JWT-based authentication with role-based access control
- **Rate Limiting**: Protection against abuse and DDoS
- **Validation**: Input validation and sanitization
- **Security**: Helmet.js security headers and CORS protection
- **Logging**: Comprehensive request logging with Morgan
- **Compression**: Response compression for better performance
- **Error Handling**: Global error handling with proper HTTP status codes

## 🏗️ Architecture

```
backend/
├── src/
│   ├── config/          # Firebase configuration
│   ├── controllers/     # Business logic controllers
│   ├── middleware/      # Authentication, validation, rate limiting
│   ├── routes/          # API route definitions
│   ├── services/        # Data access and business logic
│   ├── utils/           # Utility functions
│   └── server.js        # Main server file
├── package.json         # Dependencies and scripts
├── env.example          # Environment variables template
└── README.md           # This file
```

## 🚀 Quick Start

### 0. ✅ Firestore Index Status

**Current Status**: Order sorting is fully enabled with proper Firestore indexing.

**Index Details**: 
- Collection: `orders`
- Fields: `status` (Ascending) + `created_at` (Ascending)
- Status: ✅ Active and working

**Features**: Orders are properly sorted by creation time for optimal workflow.

---

### 1. Prerequisites

- Node.js 16+ 
- npm or yarn
- Firebase project with Firestore enabled
- Firebase service account key

### 2. Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment template
cp env.example .env

# Edit .env with your Firebase credentials
nano .env
```

### 3. Environment Configuration

Create a `.env` file with your Firebase credentials:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Firebase Admin Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,https://your-domain.com
```

### 4. Firebase Service Account Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings > Service Accounts
4. Click "Generate New Private Key"
5. Download the JSON file
6. Copy the values to your `.env` file

### 5. Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# The server will start on http://localhost:5000
```

## 📡 API Endpoints

### Authentication Required for All Endpoints

Include `Authorization: Bearer <your-jwt-token>` in request headers.

### Orders

| Method | Endpoint | Description | Role Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/orders` | Create new order | `counter`, `admin` |
| `GET` | `/api/orders` | Get all orders (with pagination) | `admin`, `counter`, `delivery` |
| `GET` | `/api/orders/status/:status` | Get orders by status | `admin`, `counter`, `delivery` |
| `GET` | `/api/orders/:orderId` | Get specific order | `admin`, `counter`, `delivery` |
| `PATCH` | `/api/orders/:orderId/status` | Update order status | `admin`, `delivery` |
| `PATCH` | `/api/orders/:orderId/items/:itemId/preparation` | Update item preparation | `admin`, `delivery` |
| `GET` | `/api/orders/stats/overview` | Get order statistics | `admin` |
| `DELETE` | `/api/orders/:orderId` | Delete order | `admin` |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server health status |

## 🔌 WebSocket Events

### Client to Server

- `joinRoom(room)`: Join a specific room (e.g., 'counter', 'delivery', 'admin')
- `orderPlaced(order)`: Notify when order is placed
- `orderStatusUpdated(data)`: Notify when order status changes
- `itemPreparationUpdated(data)`: Notify when item preparation updates

### Server to Client

- `orderPlaced(order)`: New order created
- `orderStatusUpdated(data)`: Order status changed
- `itemPreparationUpdated(data)`: Item preparation updated
- `orderDeleted(data)`: Order deleted

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Different permissions for different user roles
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Controlled cross-origin access
- **Security Headers**: Helmet.js security headers
- **Error Handling**: No sensitive information leakage

## 📊 Performance Features

- **Response Compression**: Gzip compression for responses
- **Efficient Queries**: Optimized Firestore queries
- **Connection Pooling**: Socket.io connection management
- **Rate Limiting**: Prevents server overload
- **Logging**: Performance monitoring and debugging

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

## 🚀 Deployment

### 1. Production Environment

```bash
# Set production environment
export NODE_ENV=production

# Start production server
npm start
```

### 2. Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=your_very_secure_production_jwt_secret
RATE_LIMIT_MAX_REQUESTS=1000
```

### 3. Process Management (PM2)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/server.js --name "pos-backend"

# Monitor
pm2 monit

# Logs
pm2 logs pos-backend
```

### 4. Docker Deployment

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

## 🔧 Configuration Options

### Rate Limiting

- `RATE_LIMIT_WINDOW_MS`: Time window for rate limiting (default: 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window (default: 100)

### CORS

- `CORS_ORIGIN`: Allowed origins (comma-separated)

### JWT

- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRES_IN`: Token expiration time

## 📝 Logging

The server uses Morgan for HTTP request logging and console logging for:

- Server startup
- Firebase initialization
- Socket connections
- API requests
- Errors and warnings

## 🐛 Troubleshooting

### Common Issues

1. **Firebase Connection Failed**
   - Check your service account credentials
   - Verify project ID matches
   - Ensure Firestore is enabled

2. **CORS Errors**
   - Check `CORS_ORIGIN` in `.env`
   - Verify frontend URL is included

3. **Socket.io Connection Issues**
   - Check CORS configuration
   - Verify client is connecting to correct port
   - Check firewall settings

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:

1. Check the troubleshooting section
2. Review Firebase documentation
3. Check Socket.io documentation
4. Open an issue on GitHub

## 🎯 Next Steps

After setting up the backend:

1. **Update Frontend**: Modify your React app to use the new API endpoints
2. **Socket Integration**: Replace polling with WebSocket connections
3. **Authentication**: Implement JWT token management
4. **Testing**: Test all endpoints and real-time updates
5. **Deployment**: Deploy to production environment

---

**Happy coding! 🚀✨**
