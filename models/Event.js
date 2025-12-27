const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Event category is required'],
    enum: ['technology', 'cultural', 'sports', 'academic', 'social', 'arts', 'music', 'business'],
    lowercase: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Event organizer is required']
  },
  coOrganizers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  venue: {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'India'
      }
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    capacity: {
      type: Number,
      required: [true, 'Venue capacity is required'],
      min: [1, 'Capacity must be at least 1']
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    onlineLink: {
      type: String,
      validate: {
        validator: function(v) {
          return !this.venue.isOnline || (v && v.length > 0);
        },
        message: 'Online link is required for online events'
      }
    }
  },
  dateTime: {
    start: {
      type: Date,
      required: [true, 'Event start date is required'],
      validate: {
        validator: function(v) {
          return v > new Date();
        },
        message: 'Event start date must be in the future'
      }
    },
    end: {
      type: Date,
      required: [true, 'Event end date is required'],
      validate: {
        validator: function(v) {
          return v > this.dateTime.start;
        },
        message: 'Event end date must be after start date'
      }
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },
  registration: {
    isRequired: {
      type: Boolean,
      default: true
    },
    deadline: {
      type: Date,
      validate: {
        validator: function(v) {
          return !v || v <= this.dateTime.start;
        },
        message: 'Registration deadline must be before event start'
      }
    },
    maxAttendees: {
      type: Number,
      default: function() {
        return this.venue.capacity;
      }
    },
    expectedAttendees: {
      type: Number,
      required: false // Made optional as requested
    },
    currentAttendees: {
      type: Number,
      default: 0
    },
    waitingList: {
      type: Boolean,
      default: false
    },
    approvalRequired: {
      type: Boolean,
      default: false
    }
  },
  pricing: {
    type: {
      type: String,
      enum: ['free', 'paid', 'donation'],
      default: 'free'
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR'
    },
    earlyBird: {
      enabled: {
        type: Boolean,
        default: false
      },
      discount: {
        type: Number,
        min: 0,
        max: 100
      },
      deadline: Date
    }
  },
  images: {
    banner: {
      public_id: String,
      url: {
        type: String,
        default: 'https://res.cloudinary.com/campusevents/image/upload/v1/defaults/event_banner_default.jpg'
      }
    },
    gallery: [{
      public_id: String,
      url: String,
      caption: String
    }]
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed', 'postponed'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'university-only'],
    default: 'public'
  },
  requirements: {
    ageLimit: {
      min: Number,
      max: Number
    },
    prerequisites: [String],
    materials: [String]
  },
  speakers: [{
    name: {
      type: String,
      required: true
    },
    bio: String,
    designation: String,
    company: String,
    image: {
      public_id: String,
      url: String
    },
    socialLinks: {
      linkedin: String,
      twitter: String,
      website: String
    }
  }],
  agenda: [{
    time: String,
    title: String,
    description: String,
    speaker: String,
    duration: Number // in minutes
  }],
  sponsors: [{
    name: String,
    logo: {
      public_id: String,
      url: String
    },
    website: String,
    tier: {
      type: String,
      enum: ['platinum', 'gold', 'silver', 'bronze', 'partner']
    }
  }],
  contact: {
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    phone: String,
    website: String,
    socialMedia: {
      facebook: String,
      twitter: String,
      instagram: String,
      linkedin: String
    }
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    registrations: {
      type: Number,
      default: 0
    },
    attendance: {
      type: Number,
      default: 0
    }
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    },
    breakdown: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 }
    }
  },
  certificates: {
    enabled: {
      type: Boolean,
      default: false
    },
    template: {
      public_id: String,
      url: String
    },
    criteria: {
      attendanceRequired: {
        type: Boolean,
        default: true
      },
      minimumRating: {
        type: Number,
        min: 1,
        max: 5
      }
    }
  },
  notifications: {
    reminders: {
      enabled: {
        type: Boolean,
        default: true
      },
      schedule: [{
        type: String,
        enum: ['1week', '3days', '1day', '2hours', '30minutes']
      }]
    },
    updates: {
      enabled: {
        type: Boolean,
        default: true
      }
    }
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: Number,
    endDate: Date,
    occurrences: Number
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for event duration
eventSchema.virtual('duration').get(function() {
  if (this.dateTime.start && this.dateTime.end) {
    return Math.ceil((this.dateTime.end - this.dateTime.start) / (1000 * 60 * 60)); // hours
  }
  return 0;
});

// Virtual for registration status
eventSchema.virtual('registrationStatus').get(function() {
  const now = new Date();
  if (this.registration.deadline && now > this.registration.deadline) {
    return 'closed';
  }
  if (this.registration.currentAttendees >= this.registration.maxAttendees) {
    return this.registration.waitingList ? 'waitlist' : 'full';
  }
  return 'open';
});

// Virtual for event status based on dates
eventSchema.virtual('eventStatus').get(function() {
  const now = new Date();
  if (this.status === 'cancelled' || this.status === 'postponed') {
    return this.status;
  }
  if (now < this.dateTime.start) {
    return 'upcoming';
  }
  if (now >= this.dateTime.start && now <= this.dateTime.end) {
    return 'ongoing';
  }
  return 'completed';
});

// Virtual for available spots
eventSchema.virtual('availableSpots').get(function() {
  return Math.max(0, this.registration.maxAttendees - this.registration.currentAttendees);
});

// Indexes for performance
eventSchema.index({ 'dateTime.start': 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ isFeatured: -1 });
eventSchema.index({ createdAt: -1 });
eventSchema.index({ 'venue.coordinates': '2dsphere' });

// Text index for search
eventSchema.index({
  title: 'text',
  description: 'text',
  'venue.name': 'text',
  tags: 'text'
});

// Pre-save middleware
eventSchema.pre('save', function(next) {
  // Auto-generate short description if not provided
  if (!this.shortDescription && this.description) {
    this.shortDescription = this.description.substring(0, 197) + '...';
  }
  
  // Set registration deadline if not provided
  if (!this.registration.deadline) {
    this.registration.deadline = new Date(this.dateTime.start.getTime() - 24 * 60 * 60 * 1000); // 1 day before
  }
  
  next();
});

// Method to increment view count
eventSchema.methods.incrementViews = function() {
  return this.updateOne({ $inc: { 'analytics.views': 1 } });
};

// Method to add rating
eventSchema.methods.addRating = function(rating) {
  const newCount = this.ratings.count + 1;
  const newAverage = ((this.ratings.average * this.ratings.count) + rating) / newCount;
  
  return this.updateOne({
    $set: {
      'ratings.average': Math.round(newAverage * 10) / 10,
      'ratings.count': newCount
    },
    $inc: {
      [`ratings.breakdown.${rating}`]: 1
    }
  });
};

// Method to check if user can register
eventSchema.methods.canRegister = function() {
  const now = new Date();
  return (
    this.status === 'published' &&
    this.registrationStatus === 'open' &&
    (!this.registration.deadline || now <= this.registration.deadline)
  );
};

// Static method to find events by location
eventSchema.statics.findByLocation = function(lat, lng, maxDistance = 10000) {
  return this.find({
    'venue.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

// Static method to find upcoming events
eventSchema.statics.findUpcoming = function(limit = 10) {
  return this.find({
    'dateTime.start': { $gte: new Date() },
    status: 'published'
  })
  .sort({ 'dateTime.start': 1 })
  .limit(limit)
  .populate('organizer', 'firstName lastName avatar');
};

module.exports = mongoose.model('Event', eventSchema);