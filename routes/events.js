const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { protect, authorize, eventOrganizerOrAdmin, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const emailService = require('../utils/email');
const duplicateDetector = require('../utils/duplicateDetection');

const router = express.Router();

// @desc    Get all events with filtering, sorting, and pagination
// @route   GET /api/events
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isIn(['technology', 'cultural', 'sports', 'academic', 'social', 'arts', 'music', 'business']),
  query('status').optional().isIn(['draft', 'published', 'cancelled', 'completed', 'postponed']),
  query('visibility').optional().isIn(['public', 'private', 'university-only']),
  query('sort').optional().isIn(['date', 'title', 'created', 'popularity', 'rating']),
  query('order').optional().isIn(['asc', 'desc'])
], optionalAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: errors.array()
      });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object - Show only live, upcoming, or past events
    const filter = {
      status: 'published'
    };

    // Filter by event status (live, upcoming, past)
    const now = new Date();
    if (req.query.eventStatus) {
      switch (req.query.eventStatus) {
        case 'live':
          filter['dateTime.start'] = { $lte: now };
          filter['dateTime.end'] = { $gte: now };
          break;
        case 'upcoming':
          filter['dateTime.start'] = { $gt: now };
          break;
        case 'past':
          filter['dateTime.end'] = { $lt: now };
          break;
        default:
          // Show all published events by default
          break;
      }
    } else {
      // Default: show only upcoming and live events (no past events unless specifically requested)
      filter.$or = [
        { 'dateTime.start': { $gt: now } }, // upcoming
        { 'dateTime.start': { $lte: now }, 'dateTime.end': { $gte: now } } // live
      ];
    }

    // Category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Search filter
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    // Location filter (if coordinates provided)
    if (req.query.lat && req.query.lng) {
      const maxDistance = parseInt(req.query.radius) || 10000; // 10km default
      filter['venue.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
          },
          $maxDistance: maxDistance
        }
      };
    }

    // University filter for university-only events
    if (req.query.university) {
      filter.$or = [
        { visibility: 'public' },
        { visibility: 'university-only', 'organizer.university': req.query.university }
      ];
    } else {
      filter.visibility = { $in: ['public'] };
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      const dateFilter = {};
      if (req.query.startDate) {
        dateFilter.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        dateFilter.$lte = new Date(req.query.endDate);
      }
      filter['dateTime.start'] = dateFilter;
    }

    // Price filter
    if (req.query.priceMin !== undefined || req.query.priceMax !== undefined) {
      const priceFilter = {};
      if (req.query.priceMin !== undefined) {
        priceFilter.$gte = parseFloat(req.query.priceMin);
      }
      if (req.query.priceMax !== undefined) {
        priceFilter.$lte = parseFloat(req.query.priceMax);
      }
      filter['pricing.amount'] = priceFilter;
    }

    // Free events only
    if (req.query.freeOnly === 'true') {
      filter['pricing.type'] = 'free';
    }

    // Build sort object
    let sort = {};
    const sortBy = req.query.sort || 'date';
    const order = req.query.order === 'desc' ? -1 : 1;

    switch (sortBy) {
      case 'date':
        sort = { 'dateTime.start': order };
        break;
      case 'title':
        sort = { title: order };
        break;
      case 'created':
        sort = { createdAt: order };
        break;
      case 'popularity':
        sort = { 'analytics.registrations': order };
        break;
      case 'rating':
        sort = { 'ratings.average': order };
        break;
      default:
        sort = { 'dateTime.start': 1 };
    }

    // Execute query
    const events = await Event.find(filter)
      .populate('organizer', 'firstName lastName avatar university')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Event.countDocuments(filter);

    // Add computed fields
    const eventsWithStatus = events.map(event => ({
      ...event,
      registrationStatus: getRegistrationStatus(event),
      availableSpots: Math.max(0, event.registration.maxAttendees - event.registration.currentAttendees),
      isUserRegistered: req.user ? false : false // TODO: Check user registration
    }));

    res.status(200).json({
      success: true,
      count: events.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      events: eventsWithStatus
    });
  } catch (error) {
    logger.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching events'
    });
  }
});

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'firstName lastName avatar university bio socialLinks')
      .populate('coOrganizers', 'firstName lastName avatar university');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check visibility permissions
    if (event.visibility === 'private' && (!req.user || req.user._id.toString() !== event.organizer._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'This event is private'
      });
    }

    // Increment view count
    await event.incrementViews();

    // Check if user is registered
    let userRegistration = null;
    if (req.user) {
      userRegistration = await Registration.findOne({
        event: event._id,
        user: req.user._id
      });
    }

    // Get registration statistics
    const registrationStats = await Registration.aggregate([
      { $match: { event: event._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = registrationStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      event: {
        ...event.toObject(),
        registrationStatus: getRegistrationStatus(event),
        availableSpots: Math.max(0, event.registration.maxAttendees - event.registration.currentAttendees),
        isUserRegistered: !!userRegistration,
        userRegistration,
        registrationStats: stats
      }
    });
  } catch (error) {
    logger.error('Get single event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching event'
    });
  }
});

// @desc    Check for duplicate events
// @route   POST /api/events/check-duplicates
// @access  Private (Organizer/Admin)
router.post('/check-duplicates', protect, authorize('organizer', 'admin'), [
  body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
  body('description').trim().isLength({ min: 20, max: 2000 }).withMessage('Description must be between 20 and 2000 characters'),
  body('category').isIn(['technology', 'cultural', 'sports', 'academic', 'social', 'arts', 'music', 'business']),
  body('venue.name').trim().isLength({ min: 2, max: 100 }).withMessage('Venue name is required'),
  body('dateTime.start').isISO8601().withMessage('Valid start date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Create a temporary event object for duplicate checking
    const tempEvent = {
      ...req.body,
      organizer: req.user._id
    };

    // Check for duplicates
    const duplicateAnalysis = await duplicateDetector.checkForDuplicates(tempEvent, {
      threshold: 0.7, // Lower threshold for warnings
      excludeEventId: req.body.excludeEventId || null
    });

    // Generate explanations for duplicates
    const duplicatesWithExplanations = duplicateAnalysis.duplicates.map(duplicate => ({
      ...duplicate,
      explanation: duplicateDetector.generateExplanation(duplicate)
    }));

    const suggestionsWithExplanations = duplicateAnalysis.suggestions.map(suggestion => ({
      ...suggestion,
      explanation: duplicateDetector.generateExplanation(suggestion)
    }));

    logger.info('Duplicate check performed', {
      userId: req.user._id,
      eventTitle: tempEvent.title,
      duplicatesFound: duplicateAnalysis.duplicates.length,
      suggestionsFound: duplicateAnalysis.suggestions.length
    });

    res.status(200).json({
      success: true,
      isDuplicate: duplicateAnalysis.isDuplicate,
      duplicates: duplicatesWithExplanations,
      suggestions: suggestionsWithExplanations,
      analysis: duplicateAnalysis.analysis,
      recommendations: {
        shouldBlock: duplicateAnalysis.duplicates.some(d => d.confidence === 'VERY_HIGH'),
        shouldWarn: duplicateAnalysis.duplicates.length > 0 || duplicateAnalysis.suggestions.length > 0,
        message: duplicateAnalysis.isDuplicate 
          ? 'Similar events found. Please review before creating.'
          : duplicateAnalysis.suggestions.length > 0
          ? 'Some similar events found. You may want to review them.'
          : 'No similar events found. You can proceed with creating this event.'
      }
    });
  } catch (error) {
    logger.error('Duplicate check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during duplicate check'
    });
  }
});

// @desc    Create new event
// @route   POST /api/events
// @access  Private (Organizer/Admin)
router.post('/', protect, authorize('organizer', 'admin'), [
  body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
  body('description').trim().isLength({ min: 20, max: 2000 }).withMessage('Description must be between 20 and 2000 characters'),
  body('category').isIn(['technology', 'cultural', 'sports', 'academic', 'social', 'arts', 'music', 'business']),
  body('venue.name').trim().isLength({ min: 2, max: 100 }).withMessage('Venue name is required'),
  body('venue.capacity').isInt({ min: 1 }).withMessage('Venue capacity must be at least 1'),
  body('dateTime.start').isISO8601().withMessage('Valid start date is required'),
  body('dateTime.end').isISO8601().withMessage('Valid end date is required'),
  body('contact.email').isEmail().withMessage('Valid contact email is required'),
  body('pricing.type').isIn(['free', 'paid', 'donation']).withMessage('Invalid pricing type'),
  body('pricing.amount').optional().isFloat({ min: 0 }).withMessage('Price must be non-negative'),
  body('skipDuplicateCheck').optional().isBoolean().withMessage('Skip duplicate check must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Validate dates
    const startDate = new Date(req.body.dateTime.start);
    const endDate = new Date(req.body.dateTime.end);
    const now = new Date();

    if (startDate <= now) {
      return res.status(400).json({
        success: false,
        message: 'Event start date must be in the future'
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'Event end date must be after start date'
      });
    }

    // Check for duplicates unless explicitly skipped
    if (!req.body.skipDuplicateCheck) {
      const tempEvent = {
        ...req.body,
        organizer: req.user._id
      };

      const duplicateAnalysis = await duplicateDetector.checkForDuplicates(tempEvent, {
        threshold: 0.8 // Higher threshold for blocking
      });

      // Block creation if very high confidence duplicates found
      const veryHighConfidenceDuplicates = duplicateAnalysis.duplicates.filter(
        d => d.confidence === 'VERY_HIGH'
      );

      if (veryHighConfidenceDuplicates.length > 0) {
        logger.warn('Event creation blocked due to high confidence duplicate', {
          userId: req.user._id,
          eventTitle: tempEvent.title,
          duplicateEventId: veryHighConfidenceDuplicates[0].event._id,
          probability: veryHighConfidenceDuplicates[0].probability
        });

        return res.status(409).json({
          success: false,
          message: 'A very similar event already exists. Please review the existing event or modify your event details.',
          code: 'DUPLICATE_DETECTED',
          duplicates: veryHighConfidenceDuplicates.map(d => ({
            ...d,
            explanation: duplicateDetector.generateExplanation(d)
          })),
          canOverride: true // Allow override with skipDuplicateCheck flag
        });
      }

      // Warn about medium/high confidence duplicates but allow creation
      if (duplicateAnalysis.duplicates.length > 0) {
        logger.info('Event created with duplicate warning', {
          userId: req.user._id,
          eventTitle: tempEvent.title,
          duplicatesFound: duplicateAnalysis.duplicates.length
        });
      }
    }

    // Create event
    const eventData = {
      ...req.body,
      organizer: req.user._id
    };

    // Set default registration max attendees to venue capacity
    if (!eventData.registration) {
      eventData.registration = {};
    }
    if (!eventData.registration.maxAttendees) {
      eventData.registration.maxAttendees = eventData.venue.capacity;
    }

    const event = await Event.create(eventData);

    // Populate organizer info
    await event.populate('organizer', 'firstName lastName avatar university');

    // Update user stats
    await req.user.updateOne({ $inc: { 'stats.eventsCreated': 1 } });

    logger.info('Event created', {
      eventId: event._id,
      title: event.title,
      organizerId: req.user._id,
      category: event.category,
      duplicateCheckSkipped: !!req.body.skipDuplicateCheck
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    logger.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating event'
    });
  }
});

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (Event Organizer/Admin)
router.put('/:id', protect, eventOrganizerOrAdmin, [
  body('title').optional().trim().isLength({ min: 5, max: 100 }),
  body('description').optional().trim().isLength({ min: 20, max: 2000 }),
  body('category').optional().isIn(['technology', 'cultural', 'sports', 'academic', 'social', 'arts', 'music', 'business']),
  body('venue.name').optional().trim().isLength({ min: 2, max: 100 }),
  body('venue.capacity').optional().isInt({ min: 1 }),
  body('dateTime.start').optional().isISO8601(),
  body('dateTime.end').optional().isISO8601(),
  body('contact.email').optional().isEmail(),
  body('pricing.type').optional().isIn(['free', 'paid', 'donation']),
  body('pricing.amount').optional().isFloat({ min: 0 }),
  body('skipDuplicateCheck').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const event = req.event; // Set by eventOrganizerOrAdmin middleware

    // Check if event can be updated
    if (event.status === 'completed' || event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update completed or cancelled events'
      });
    }

    // Validate dates if provided
    if (req.body.dateTime) {
      const startDate = new Date(req.body.dateTime.start || event.dateTime.start);
      const endDate = new Date(req.body.dateTime.end || event.dateTime.end);
      const now = new Date();

      if (startDate <= now) {
        return res.status(400).json({
          success: false,
          message: 'Event start date must be in the future'
        });
      }

      if (endDate <= startDate) {
        return res.status(400).json({
          success: false,
          message: 'Event end date must be after start date'
        });
      }
    }

    // Check for duplicates if significant changes are made and not explicitly skipped
    const significantFields = ['title', 'description', 'dateTime', 'venue', 'category'];
    const hasSignificantChanges = significantFields.some(field => req.body[field] !== undefined);

    if (hasSignificantChanges && !req.body.skipDuplicateCheck) {
      // Create updated event object for duplicate checking
      const updatedEvent = {
        ...event.toObject(),
        ...req.body,
        organizer: event.organizer._id || event.organizer
      };

      const duplicateAnalysis = await duplicateDetector.checkForDuplicates(updatedEvent, {
        threshold: 0.8,
        excludeEventId: event._id
      });

      // Block update if very high confidence duplicates found
      const veryHighConfidenceDuplicates = duplicateAnalysis.duplicates.filter(
        d => d.confidence === 'VERY_HIGH'
      );

      if (veryHighConfidenceDuplicates.length > 0) {
        logger.warn('Event update blocked due to high confidence duplicate', {
          userId: req.user._id,
          eventId: event._id,
          eventTitle: updatedEvent.title,
          duplicateEventId: veryHighConfidenceDuplicates[0].event._id,
          probability: veryHighConfidenceDuplicates[0].probability
        });

        return res.status(409).json({
          success: false,
          message: 'The updated event would be very similar to an existing event. Please review or modify your changes.',
          code: 'DUPLICATE_DETECTED',
          duplicates: veryHighConfidenceDuplicates.map(d => ({
            ...d,
            explanation: duplicateDetector.generateExplanation(d)
          })),
          canOverride: true
        });
      }
    }

    // Update event
    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('organizer', 'firstName lastName avatar university');

    logger.info('Event updated', {
      eventId: event._id,
      title: event.title,
      updatedBy: req.user._id,
      duplicateCheckSkipped: !!req.body.skipDuplicateCheck
    });

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      event: updatedEvent
    });
  } catch (error) {
    logger.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating event'
    });
  }
});

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (Event Organizer/Admin)
router.delete('/:id', protect, eventOrganizerOrAdmin, async (req, res) => {
  try {
    const event = req.event;

    // Check if event has registrations
    const registrationCount = await Registration.countDocuments({ event: event._id });
    
    if (registrationCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete event with existing registrations. Cancel the event instead.'
      });
    }

    await Event.findByIdAndDelete(req.params.id);

    logger.info('Event deleted', {
      eventId: event._id,
      title: event.title,
      deletedBy: req.user._id
    });

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    logger.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting event'
    });
  }
});

// @desc    Register for event
// @route   POST /api/events/:id/register
// @access  Private
router.post('/:id/register', protect, [
  // Enhanced validation for student details
  body('studentDetails.firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name is required'),
  body('studentDetails.lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name is required'),
  body('studentDetails.email').isEmail().withMessage('Valid email is required'),
  body('studentDetails.phone').matches(/^\+?[\d\s-()]+$/).withMessage('Valid phone number is required'),
  body('studentDetails.dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('studentDetails.gender').isIn(['male', 'female', 'other', 'prefer-not-to-say']).withMessage('Valid gender is required'),
  body('studentDetails.university').trim().isLength({ min: 2, max: 100 }).withMessage('University is required'),
  body('studentDetails.course').trim().isLength({ min: 2, max: 100 }).withMessage('Course is required'),
  body('studentDetails.year').isIn(['1st', '2nd', '3rd', '4th', 'graduate', 'postgraduate']).withMessage('Valid academic year is required'),
  body('studentDetails.rollNumber').trim().isLength({ min: 1, max: 50 }).withMessage('Roll number is required'),
  body('studentDetails.address.street').trim().isLength({ min: 5, max: 200 }).withMessage('Street address is required'),
  body('studentDetails.address.city').trim().isLength({ min: 2, max: 50 }).withMessage('City is required'),
  body('studentDetails.address.state').trim().isLength({ min: 2, max: 50 }).withMessage('State is required'),
  body('studentDetails.address.zipCode').trim().isLength({ min: 4, max: 10 }).withMessage('ZIP code is required'),
  body('studentDetails.emergencyContact.name').trim().isLength({ min: 2, max: 100 }).withMessage('Emergency contact name is required'),
  body('studentDetails.emergencyContact.relationship').trim().isLength({ min: 2, max: 50 }).withMessage('Emergency contact relationship is required'),
  body('studentDetails.emergencyContact.phone').matches(/^\+?[\d\s-()]+$/).withMessage('Valid emergency contact phone is required'),
  body('studentDetails.dietaryRestrictions').optional().isArray(),
  body('studentDetails.medicalConditions').optional().isArray(),
  body('studentDetails.tshirtSize').optional().isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
  body('studentDetails.specialRequirements').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const event = await Event.findById(req.params.id).populate('organizer', 'firstName lastName email');
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if event allows registration
    if (!event.canRegister()) {
      return res.status(400).json({
        success: false,
        message: 'Registration is not available for this event'
      });
    }

    // Check if user is already registered
    const existingRegistration = await Registration.findOne({
      event: event._id,
      user: req.user._id
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this event'
      });
    }

    // Check capacity
    if (event.registration.currentAttendees >= event.registration.maxAttendees) {
      if (event.registration.waitingList) {
        // Add to waiting list
        const registration = await Registration.create({
          event: event._id,
          user: req.user._id,
          status: 'waitlisted',
          studentDetails: req.body.studentDetails
        });

        return res.status(200).json({
          success: true,
          message: 'Added to waiting list',
          registration
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Event is full'
        });
      }
    }

    // Create registration with enhanced student details
    const registrationData = {
      event: event._id,
      user: req.user._id,
      status: event.registration.approvalRequired ? 'pending' : 'confirmed',
      studentDetails: req.body.studentDetails
    };

    // Set payment status based on event pricing
    if (event.pricing.type === 'free') {
      registrationData.paymentStatus = 'not-required';
      registrationData.paymentDetails = {
        amount: 0,
        currency: event.pricing.currency
      };
    } else {
      registrationData.paymentStatus = 'pending';
      registrationData.paymentDetails = {
        amount: event.pricing.amount,
        currency: event.pricing.currency
      };
    }

    const registration = await Registration.create(registrationData);

    // Update event registration count
    await Event.findByIdAndUpdate(event._id, {
      $inc: { 
        'registration.currentAttendees': 1,
        'analytics.registrations': 1
      }
    });

    // Update user stats
    await req.user.updateOne({ $inc: { 'stats.eventsAttended': 1 } });

    // Send confirmation email to student
    try {
      await emailService.sendRegistrationConfirmation(req.user, event, registration);
    } catch (emailError) {
      logger.error('Failed to send registration confirmation email to student:', emailError);
    }

    // Send registration notification to event owner
    try {
      await emailService.sendRegistrationNotificationToOwner(event.organizer, event, registration, req.body.studentDetails);
    } catch (emailError) {
      logger.error('Failed to send registration notification to event owner:', emailError);
    }

    logger.info('User registered for event', {
      eventId: event._id,
      userId: req.user._id,
      registrationId: registration._id,
      paymentRequired: event.pricing.type !== 'free'
    });

    // Return response with payment information if needed
    const response = {
      success: true,
      message: 'Registration successful',
      registration,
      paymentRequired: event.pricing.type !== 'free',
      paymentAmount: event.pricing.amount,
      paymentCurrency: event.pricing.currency
    };

    if (event.pricing.type === 'free') {
      response.message = 'Registration successful - FREE event';
    } else {
      response.message = `Registration successful - Payment of ${event.pricing.currency} ${event.pricing.amount} required`;
      response.paymentInstructions = 'Please complete payment to confirm your registration';
    }

    res.status(201).json(response);
  } catch (error) {
    logger.error('Event registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @desc    Get event registrations (for organizers)
// @route   GET /api/events/:id/registrations
// @access  Private (Event Organizer/Admin)
router.get('/:id/registrations', protect, eventOrganizerOrAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { event: req.params.id };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const registrations = await Registration.find(filter)
      .populate('user', 'firstName lastName email avatar university')
      .sort({ registrationDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Registration.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: registrations.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      registrations
    });
  } catch (error) {
    logger.error('Get event registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching registrations'
    });
  }
});

// Helper function to determine registration status
function getRegistrationStatus(event) {
  const now = new Date();
  if (event.registration.deadline && now > event.registration.deadline) {
    return 'closed';
  }
  if (event.registration.currentAttendees >= event.registration.maxAttendees) {
    return event.registration.waitingList ? 'waitlist' : 'full';
  }
  return 'open';
}

module.exports = router;