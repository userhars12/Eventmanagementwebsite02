const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event is required']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'waitlisted', 'attended', 'no-show'],
    default: 'pending'
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'not-required'],
    default: 'not-required'
  },
  paymentDetails: {
    transactionId: String,
    paymentMethod: {
      type: String,
      enum: ['stripe', 'razorpay', 'paypal', 'bank-transfer', 'cash']
    },
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    paidAt: Date,
    refundedAt: Date,
    refundAmount: Number
  },
  // Enhanced Student Personal Details
  studentDetails: {
    firstName: {
      type: String,
      required: [true, 'First name is required']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required']
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer-not-to-say'],
      required: [true, 'Gender is required']
    },
    university: {
      type: String,
      required: [true, 'University is required']
    },
    course: {
      type: String,
      required: [true, 'Course is required']
    },
    year: {
      type: String,
      enum: ['1st', '2nd', '3rd', '4th', 'graduate', 'postgraduate'],
      required: [true, 'Academic year is required']
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required']
    },
    address: {
      street: {
        type: String,
        required: [true, 'Street address is required']
      },
      city: {
        type: String,
        required: [true, 'City is required']
      },
      state: {
        type: String,
        required: [true, 'State is required']
      },
      zipCode: {
        type: String,
        required: [true, 'ZIP code is required']
      },
      country: {
        type: String,
        default: 'India'
      }
    },
    emergencyContact: {
      name: {
        type: String,
        required: [true, 'Emergency contact name is required']
      },
      relationship: {
        type: String,
        required: [true, 'Emergency contact relationship is required']
      },
      phone: {
        type: String,
        required: [true, 'Emergency contact phone is required']
      }
    },
    dietaryRestrictions: [String],
    medicalConditions: [String],
    tshirtSize: {
      type: String,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    },
    specialRequirements: String
  },
  customFields: [{
    field: String,
    value: mongoose.Schema.Types.Mixed
  }],
  qrCode: {
    code: {
      type: String,
      unique: true
    },
    url: String,
    scannedAt: Date,
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  certificate: {
    issued: {
      type: Boolean,
      default: false
    },
    issuedAt: Date,
    certificateId: String,
    downloadUrl: String
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: Date,
    categories: {
      content: Number,
      organization: Number,
      venue: Number,
      speakers: Number,
      networking: Number
    }
  },
  notifications: {
    confirmationSent: {
      type: Boolean,
      default: false
    },
    remindersSent: [{
      type: {
        type: String,
        enum: ['1week', '3days', '1day', '2hours', '30minutes']
      },
      sentAt: Date
    }],
    followUpSent: {
      type: Boolean,
      default: false
    }
  },
  checkIn: {
    checkedIn: {
      type: Boolean,
      default: false
    },
    checkInTime: Date,
    checkInMethod: {
      type: String,
      enum: ['qr-code', 'manual', 'mobile-app']
    },
    checkInLocation: {
      latitude: Number,
      longitude: Number
    }
  },
  source: {
    type: String,
    enum: ['website', 'mobile-app', 'social-media', 'email', 'referral', 'walk-in'],
    default: 'website'
  },
  referralCode: String,
  notes: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index to ensure one registration per user per event
registrationSchema.index({ event: 1, user: 1 }, { unique: true });

// Other indexes for performance
registrationSchema.index({ status: 1 });
registrationSchema.index({ paymentStatus: 1 });
registrationSchema.index({ registrationDate: -1 });

// Virtual for full attendee name
registrationSchema.virtual('attendeeFullName').get(function() {
  if (this.attendeeInfo.firstName && this.attendeeInfo.lastName) {
    return `${this.attendeeInfo.firstName} ${this.attendeeInfo.lastName}`;
  }
  return null;
});

// Pre-save middleware to generate QR code
registrationSchema.pre('save', async function(next) {
  if (this.isNew && !this.qrCode.code) {
    // Generate unique QR code
    const crypto = require('crypto');
    this.qrCode.code = crypto.randomBytes(16).toString('hex');
  }
  next();
});

// Method to generate QR code URL
registrationSchema.methods.generateQRCodeUrl = function() {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/checkin/${this.qrCode.code}`;
};

// Method to mark as attended
registrationSchema.methods.markAttended = function(checkInData = {}) {
  return this.updateOne({
    status: 'attended',
    'checkIn.checkedIn': true,
    'checkIn.checkInTime': new Date(),
    'checkIn.checkInMethod': checkInData.method || 'manual',
    'checkIn.checkInLocation': checkInData.location || null
  });
};

// Method to process payment
registrationSchema.methods.processPayment = function(paymentData) {
  return this.updateOne({
    paymentStatus: 'completed',
    'paymentDetails.transactionId': paymentData.transactionId,
    'paymentDetails.paymentMethod': paymentData.method,
    'paymentDetails.amount': paymentData.amount,
    'paymentDetails.currency': paymentData.currency,
    'paymentDetails.paidAt': new Date(),
    status: 'confirmed'
  });
};

// Method to cancel registration
registrationSchema.methods.cancel = function(reason) {
  return this.updateOne({
    status: 'cancelled',
    notes: reason || 'Cancelled by user'
  });
};

// Method to submit feedback
registrationSchema.methods.submitFeedback = function(feedbackData) {
  return this.updateOne({
    'feedback.rating': feedbackData.rating,
    'feedback.comment': feedbackData.comment,
    'feedback.submittedAt': new Date(),
    'feedback.categories': feedbackData.categories || {}
  });
};

// Static method to get event statistics
registrationSchema.statics.getEventStats = function(eventId) {
  return this.aggregate([
    { $match: { event: new mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Static method to get registration analytics
registrationSchema.statics.getAnalytics = function(eventId, startDate, endDate) {
  const matchStage = { event: new mongoose.Types.ObjectId(eventId) };
  
  if (startDate && endDate) {
    matchStage.registrationDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$registrationDate' } }
        },
        registrations: { $sum: 1 },
        confirmed: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
        },
        attended: {
          $sum: { $cond: [{ $eq: ['$status', 'attended'] }, 1, 0] }
        },
        revenue: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'completed'] }, '$paymentDetails.amount', 0] }
        }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);
};

module.exports = mongoose.model('Registration', registrationSchema);