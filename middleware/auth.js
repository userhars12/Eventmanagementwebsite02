const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Protect routes - require authentication
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Get token from cookie
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'No user found with this token'
        });
      }

      // Check if user account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account has been deactivated'
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(401).json({
          success: false,
          message: 'Account is temporarily locked due to multiple failed login attempts'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      logger.error('Token verification failed:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Optional authentication - doesn't fail if no token
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (user && user.isActive && !user.isLocked) {
          req.user = user;
        }
      } catch (error) {
        // Token invalid, but continue without user
        logger.warn('Invalid token in optional auth:', error.message);
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

// Check if user owns the resource or is admin
exports.ownerOrAdmin = (resourceUserField = 'user') => {
  return (req, res, next) => {
    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.resource ? req.resource[resourceUserField] : req.params.userId;
    
    if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this resource'
    });
  };
};

// Check if user is event organizer or admin
exports.eventOrganizerOrAdmin = async (req, res, next) => {
  try {
    const Event = require('../models/Event');
    const eventId = req.params.eventId || req.params.id;
    
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      req.event = event;
      return next();
    }

    // Check if user is the organizer or co-organizer
    const isOrganizer = event.organizer.toString() === req.user._id.toString();
    const isCoOrganizer = event.coOrganizers && event.coOrganizers.some(
      coOrg => coOrg.toString() === req.user._id.toString()
    );

    if (isOrganizer || isCoOrganizer) {
      req.event = event;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Not authorized to manage this event'
    });
  } catch (error) {
    logger.error('Event organizer check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authorization'
    });
  }
};

// Rate limiting for sensitive operations
exports.sensitiveOperationLimit = (req, res, next) => {
  // This would typically use Redis for distributed rate limiting
  // For now, we'll use a simple in-memory approach
  const userKey = req.user._id.toString();
  const operation = req.route.path;
  
  // In production, implement proper rate limiting with Redis
  // For demo purposes, we'll just log and continue
  logger.info(`Sensitive operation: ${operation} by user: ${userKey}`);
  next();
};

// Verify email middleware
exports.requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email address to access this feature',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
};

// Check user permissions for specific actions
exports.checkPermission = (permission) => {
  return (req, res, next) => {
    const userPermissions = {
      user: ['read:own-profile', 'update:own-profile', 'register:events'],
      organizer: ['read:own-profile', 'update:own-profile', 'register:events', 'create:events', 'manage:own-events'],
      admin: ['*'] // Admin has all permissions
    };

    const permissions = userPermissions[req.user.role] || [];
    
    if (permissions.includes('*') || permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Permission denied: ${permission} required`
    });
  };
};