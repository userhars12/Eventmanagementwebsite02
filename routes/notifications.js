const express = require('express');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // In a real application, you would fetch notifications from a database
    // For now, we'll return a mock response
    const mockNotifications = [
      {
        id: '1',
        type: 'event_reminder',
        title: 'Event Reminder',
        message: 'AI Workshop Series starts in 2 hours',
        read: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        data: {
          eventId: 'event123',
          eventTitle: 'AI Workshop Series'
        }
      },
      {
        id: '2',
        type: 'registration_confirmed',
        title: 'Registration Confirmed',
        message: 'Your registration for Cultural Fusion Night has been confirmed',
        read: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        data: {
          eventId: 'event456',
          eventTitle: 'Cultural Fusion Night'
        }
      },
      {
        id: '3',
        type: 'new_event',
        title: 'New Event Available',
        message: 'A new tech event "Blockchain Fundamentals" is now available for registration',
        read: false,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        data: {
          eventId: 'event789',
          eventTitle: 'Blockchain Fundamentals'
        }
      }
    ];

    // Filter notifications based on user preferences
    const filteredNotifications = mockNotifications.slice(skip, skip + limit);
    const total = mockNotifications.length;

    res.status(200).json({
      success: true,
      count: filteredNotifications.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      notifications: filteredNotifications
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching notifications'
    });
  }
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    // In a real application, you would update the notification in the database
    // For now, we'll just return a success response
    
    logger.info('Notification marked as read', {
      userId: req.user._id,
      notificationId
    });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating notification'
    });
  }
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
router.put('/read-all', protect, async (req, res) => {
  try {
    // In a real application, you would update all unread notifications for the user
    
    logger.info('All notifications marked as read', {
      userId: req.user._id
    });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating notifications'
    });
  }
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    // In a real application, you would delete the notification from the database
    
    logger.info('Notification deleted', {
      userId: req.user._id,
      notificationId
    });

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting notification'
    });
  }
});

// @desc    Get notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
router.get('/preferences', protect, async (req, res) => {
  try {
    // In a real application, you would fetch user's notification preferences
    const mockPreferences = {
      eventReminders: true,
      newEvents: true,
      registrationUpdates: true,
      emailNotifications: true,
      pushNotifications: false,
      smsNotifications: false
    };

    res.status(200).json({
      success: true,
      preferences: mockPreferences
    });
  } catch (error) {
    logger.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching preferences'
    });
  }
});

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
router.put('/preferences', protect, async (req, res) => {
  try {
    const {
      eventReminders,
      newEvents,
      registrationUpdates,
      emailNotifications,
      pushNotifications,
      smsNotifications
    } = req.body;

    // In a real application, you would update the user's notification preferences
    
    logger.info('Notification preferences updated', {
      userId: req.user._id,
      preferences: req.body
    });

    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: {
        eventReminders,
        newEvents,
        registrationUpdates,
        emailNotifications,
        pushNotifications,
        smsNotifications
      }
    });
  } catch (error) {
    logger.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating preferences'
    });
  }
});

module.exports = router;