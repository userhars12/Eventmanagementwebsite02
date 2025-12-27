const express = require('express');
const { body, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @desc    Create Stripe payment intent
// @route   POST /api/payments/stripe/create-intent
// @access  Private
router.post('/stripe/create-intent', protect, [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('amount').isFloat({ min: 0.5 }).withMessage('Amount must be at least $0.50')
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

    const { eventId, amount } = req.body;

    // Verify event exists and user can register
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is already registered
    const existingRegistration = await Registration.findOne({
      event: eventId,
      user: req.user._id
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this event'
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        eventId: eventId,
        userId: req.user._id.toString(),
        eventTitle: event.title
      }
    });

    logger.info('Stripe payment intent created', {
      paymentIntentId: paymentIntent.id,
      eventId,
      userId: req.user._id,
      amount
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    logger.error('Stripe payment intent creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment intent'
    });
  }
});

// @desc    Create Razorpay order
// @route   POST /api/payments/razorpay/create-order
// @access  Private
router.post('/razorpay/create-order', protect, [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least ₹1')
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

    const { eventId, amount } = req.body;

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `event_${eventId}_${Date.now()}`,
      notes: {
        eventId: eventId,
        userId: req.user._id.toString(),
        eventTitle: event.title
      }
    });

    logger.info('Razorpay order created', {
      orderId: order.id,
      eventId,
      userId: req.user._id,
      amount
    });

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    logger.error('Razorpay order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment order'
    });
  }
});

// @desc    Confirm payment and create registration
// @route   POST /api/payments/confirm
// @access  Private
router.post('/confirm', protect, [
  body('eventId').isMongoId().withMessage('Valid event ID is required'),
  body('paymentMethod').isIn(['stripe', 'razorpay']).withMessage('Invalid payment method'),
  body('paymentId').notEmpty().withMessage('Payment ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required')
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

    const { eventId, paymentMethod, paymentId, amount } = req.body;

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is already registered
    const existingRegistration = await Registration.findOne({
      event: eventId,
      user: req.user._id
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this event'
      });
    }

    // Verify payment based on method
    let paymentVerified = false;
    let transactionDetails = {};

    if (paymentMethod === 'stripe') {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
        paymentVerified = paymentIntent.status === 'succeeded';
        transactionDetails = {
          transactionId: paymentIntent.id,
          paymentMethod: 'stripe',
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase()
        };
      } catch (stripeError) {
        logger.error('Stripe payment verification error:', stripeError);
      }
    } else if (paymentMethod === 'razorpay') {
      // For Razorpay, you would typically verify the payment signature
      // This is a simplified version
      paymentVerified = true; // In production, verify the signature
      transactionDetails = {
        transactionId: paymentId,
        paymentMethod: 'razorpay',
        amount: amount,
        currency: 'INR'
      };
    }

    if (!paymentVerified) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Create registration
    const registration = await Registration.create({
      event: eventId,
      user: req.user._id,
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentDetails: {
        ...transactionDetails,
        paidAt: new Date()
      },
      attendeeInfo: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        phone: req.user.phone
      }
    });

    // Update event registration count
    await Event.findByIdAndUpdate(eventId, {
      $inc: { 
        'registration.currentAttendees': 1,
        'analytics.registrations': 1
      }
    });

    // Update user stats
    await req.user.updateOne({ $inc: { 'stats.eventsAttended': 1 } });

    logger.info('Payment confirmed and registration created', {
      registrationId: registration._id,
      eventId,
      userId: req.user._id,
      paymentMethod,
      amount
    });

    res.status(201).json({
      success: true,
      message: 'Payment confirmed and registration successful',
      registration: {
        id: registration._id,
        event: event.title,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        qrCode: registration.qrCode.code
      }
    });
  } catch (error) {
    logger.error('Payment confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming payment'
    });
  }
});

// @desc    Get payment history
// @route   GET /api/payments/history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const registrations = await Registration.find({
      user: req.user._id,
      paymentStatus: 'completed'
    })
    .populate('event', 'title dateTime venue pricing')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await Registration.countDocuments({
      user: req.user._id,
      paymentStatus: 'completed'
    });

    res.status(200).json({
      success: true,
      count: registrations.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      payments: registrations.map(reg => ({
        id: reg._id,
        event: {
          id: reg.event._id,
          title: reg.event.title,
          date: reg.event.dateTime.start,
          venue: reg.event.venue.name
        },
        amount: reg.paymentDetails.amount,
        currency: reg.paymentDetails.currency,
        paymentMethod: reg.paymentDetails.paymentMethod,
        transactionId: reg.paymentDetails.transactionId,
        paidAt: reg.paymentDetails.paidAt,
        status: reg.paymentStatus
      }))
    });
  } catch (error) {
    logger.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment history'
    });
  }
});

module.exports = router;