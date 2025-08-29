const jwt = require('jsonwebtoken');
const { getAuth } = require('../config/firebase');

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please provide a valid authentication token' 
      });
    }

    // For development: Accept demo token
    if (token === 'demo-token') {
      req.user = {
        id: 'demo-user',
        role: 'admin',
        firebaseToken: 'demo-token'
      };
      return next();
    }

    // For production: Verify JWT token
    if (process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verify with Firebase Auth for additional security
        try {
          const auth = getAuth();
          await auth.verifyIdToken(decoded.firebaseToken);
        } catch (firebaseError) {
          console.warn('⚠️ Firebase token verification failed:', firebaseError.message);
          // Continue with JWT verification for now
        }

        req.user = decoded;
        next();
      } catch (error) {
        console.error('❌ Token verification failed:', error.message);
        
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            error: 'Token expired',
            message: 'Your session has expired. Please login again.' 
          });
        }
        
        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({ 
            error: 'Invalid token',
            message: 'Invalid authentication token provided.' 
          });
        }

        return res.status(500).json({ 
          error: 'Authentication error',
          message: 'An error occurred during authentication.' 
        });
      }
    } else {
      // No JWT_SECRET configured, use demo mode
      req.user = {
        id: 'demo-user',
        role: 'admin',
        firebaseToken: 'demo-token'
      };
      next();
    }
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'An error occurred during authentication.' 
    });
  }
};

// Role-based access control middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please login to access this resource.' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have permission to access this resource.' 
      });
    }

    next();
  };
};

// Rate limiting middleware
const rateLimiter = require('express-rate-limit');

const createRateLimiter = (windowMs, max, message) => {
  return rateLimiter({
    windowMs: windowMs || 15 * 60 * 1000, // 15 minutes default
    max: max || 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests',
      message: message || 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = {
  authenticateToken,
  requireRole,
  createRateLimiter
};
