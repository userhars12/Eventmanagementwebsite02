const express = require('express');
const { query, validationResult } = require('express-validator');
const Event = require('../models/Event');
const User = require('../models/User');
const Registration = require('../models/Registration');
const { protect, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @desc    Get admin dashboard data
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', protect, authorize('admin'), async (req, res) => {
  try {
    const [
      totalUsers,
      totalEvents,
      totalRegistrations,
      pendingEvents,
      activeEvents,
      completedEvents,
      recentUsers,
      recentEvents,
      topCategories,
      monthlyStats
    ] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      Registration.countDocuments(),
      Event.countDocuments({ status: 'draft' }),
      Event.countDocuments({ 
        status: 'published',
        'dateTime.start': { $gte: new Date() }
      }),
      Event.countDocuments({ status: 'completed' }),
      User.find().sort({ createdAt: -1 }).limit(5).select('firstName lastName email createdAt'),
      Event.find().sort({ createdAt: -1 }).limit(5).select('title category status createdAt'),
      Event.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      Event.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            events: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ])
    ]);

    const dashboardData = {
      overview: {
        totalUsers,
        totalEvents,
        totalRegistrations,
        pendingEvents,
        activeEvents,
        completedEvents
      },
      recentActivity: {
        users: recentUsers,
        events: recentEvents
      },
      analytics: {
        topCategories,
        monthlyStats
      },
      metrics: {
        userGrowthRate: calculateGrowthRate(totalUsers, 'users'),
        eventGrowthRate: calculateGrowthRate(totalEvents, 'events'),
        averageRegistrationsPerEvent: totalEvents > 0 ? Math.round(totalRegistrations / totalEvents) : 0
      }
    };

    logger.info('Admin dashboard accessed', {
      adminId: req.user._id,
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching dashboard data'
    });
  }
});

// @desc    Get all users with advanced filtering
// @route   GET /api/admin/users
// @access  Private (Admin only)
router.get('/users', protect, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['user', 'organizer', 'admin']).withMessage('Invalid role'),
  query('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.isActive = req.query.status === 'active';
    if (req.query.university) filter.university = new RegExp(req.query.university, 'i');
    if (req.query.search) {
      filter.$or = [
        { firstName: new RegExp(req.query.search, 'i') },
        { lastName: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      users
    });
  } catch (error) {
    logger.error('Admin get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users'
    });
  }
});

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin only)
router.put('/users/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('User status updated by admin', {
      adminId: req.user._id,
      userId: user._id,
      newStatus: isActive ? 'active' : 'inactive'
    });

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    logger.error('Admin update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating user status'
    });
  }
});

// @desc    Get system statistics
// @route   GET /api/admin/stats
// @access  Private (Admin only)
router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const stats = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]),
      Event.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Registration.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const [userStats, eventStats, registrationStats] = stats;

    res.status(200).json({
      success: true,
      data: {
        users: userStats,
        events: eventStats,
        registrations: registrationStats
      }
    });
  } catch (error) {
    logger.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching statistics'
    });
  }
});

// Helper function to calculate growth rate
function calculateGrowthRate(currentValue, type) {
  // This would typically compare with previous period data
  // For now, return a simulated growth rate
  const growthRates = {
    users: Math.floor(Math.random() * 20) + 5, // 5-25%
    events: Math.floor(Math.random() * 30) + 10 // 10-40%
  };
  
  return growthRates[type] || 0;
}

module.exports = router;