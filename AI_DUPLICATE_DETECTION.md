# AI-Powered Duplicate Event Detection System

## Overview

The CampusEvents platform now includes an advanced AI-powered duplicate detection system that prevents users from creating similar or duplicate events. This system uses multiple algorithms and factors to intelligently identify potential duplicates and provide smart recommendations.

## 🤖 How It Works

### 1. **Multi-Factor Analysis**
The AI system analyzes multiple aspects of events:

- **Title Similarity** (35% weight) - Uses Levenshtein distance and Jaccard similarity
- **Description Similarity** (20% weight) - Content analysis and keyword matching
- **Date Proximity** (15% weight) - Events within 7 days are considered close
- **Venue Proximity** (15% weight) - Location name, address, and GPS coordinates
- **Category Match** (10% weight) - Same event category
- **Organizer Match** (5% weight) - Same event organizer

### 2. **Advanced Text Similarity Algorithms**

#### Levenshtein Distance
- Calculates character-level differences between texts
- Normalized to provide similarity percentage
- Handles typos and minor variations

#### Jaccard Similarity
- Compares word sets between texts
- Filters out common words (< 3 characters)
- Effective for content-based matching

### 3. **Geographic Analysis**
- Venue name matching with fuzzy logic
- Address comparison for similar locations
- GPS coordinate analysis using Haversine formula
- Configurable proximity threshold (default: 5km)

### 4. **Temporal Analysis**
- Date proximity calculation
- Configurable time window (default: 7 days)
- Considers event duration and scheduling conflicts

## 🎯 Detection Levels

### Confidence Levels
- **VERY_HIGH** (90%+) - Almost certainly a duplicate
- **HIGH** (80-89%) - Very likely a duplicate
- **MEDIUM** (60-79%) - Possibly similar
- **LOW** (40-59%) - Some similarities
- **VERY_LOW** (<40%) - Minimal similarities

### Action Thresholds
- **Block Creation**: VERY_HIGH confidence duplicates
- **Show Warning**: HIGH and MEDIUM confidence duplicates
- **Show Suggestions**: All detected similarities above 50%

## 🔧 API Endpoints

### Check for Duplicates
```http
POST /api/events/check-duplicates
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "AI Workshop 2024",
  "description": "Learn about artificial intelligence...",
  "category": "technology",
  "venue": {
    "name": "Tech Auditorium",
    "address": { ... }
  },
  "dateTime": {
    "start": "2024-12-30T10:00:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "isDuplicate": true,
  "duplicates": [
    {
      "event": { ... },
      "probability": 0.92,
      "confidence": "VERY_HIGH",
      "explanation": "Event titles are 95% similar, same venue, same date",
      "factors": {
        "titleSimilarity": 0.95,
        "descriptionSimilarity": 0.78,
        "dateProximity": 1.0,
        "venueProximity": 0.98,
        "categoryMatch": 1,
        "organizerMatch": 0
      }
    }
  ],
  "suggestions": [...],
  "recommendations": {
    "shouldBlock": true,
    "shouldWarn": true,
    "message": "Similar events found. Please review before creating."
  }
}
```

### Create Event with Duplicate Check
```http
POST /api/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "New Event",
  "description": "Event description...",
  "skipDuplicateCheck": false,  // Optional: bypass duplicate check
  ...
}
```

## 🎨 Frontend Integration

### Automatic Duplicate Checking
The system automatically checks for duplicates when:
- Creating new events
- Updating existing events (significant changes)
- User requests manual duplicate check

### User Experience Flow
1. **User fills event form** → System validates input
2. **AI analyzes for duplicates** → Shows loading indicator
3. **Results displayed** → Interactive modal with options
4. **User decides** → Proceed, cancel, or view similar events
5. **Event created/updated** → With appropriate logging

### Interactive Duplicate Warning Modal
- **Visual similarity indicators** - Color-coded confidence levels
- **Detailed explanations** - Why events are considered similar
- **Quick actions** - View existing events, proceed anyway, or cancel
- **Smart recommendations** - Context-aware suggestions

## ⚙️ Configuration Options

### Detection Thresholds
```javascript
// In utils/duplicateDetection.js
{
  similarityThreshold: 0.8,     // 80% similarity threshold
  dateProximityDays: 7,         // Events within 7 days
  venueProximityKm: 5,          // Events within 5km
}
```

### Weights Configuration
```javascript
const weights = {
  title: 0.35,        // Title similarity weight
  description: 0.20,  // Description similarity weight
  date: 0.15,         // Date proximity weight
  venue: 0.15,        // Venue proximity weight
  category: 0.10,     // Category match weight
  organizer: 0.05     // Organizer match weight
};
```

## 📊 Analytics and Logging

### Duplicate Detection Metrics
- Number of duplicates prevented
- False positive rates
- User override frequency
- Most common similarity factors

### Logging Events
```javascript
// Successful duplicate detection
logger.info('Duplicate detection analysis', {
  eventTitle: 'AI Workshop',
  duplicatesFound: 2,
  suggestionsFound: 1,
  highestProbability: 0.92
});

// Event creation blocked
logger.warn('Event creation blocked due to high confidence duplicate', {
  userId: 'user123',
  eventTitle: 'AI Workshop',
  duplicateEventId: 'event456',
  probability: 0.95
});
```

## 🛡️ Security and Performance

### Performance Optimizations
- **Efficient querying** - Pre-filters by category and date range
- **Limited scope** - Checks only recent events (configurable)
- **Caching** - Results cached for repeated checks
- **Async processing** - Non-blocking duplicate detection

### Security Measures
- **Input validation** - All inputs sanitized and validated
- **Rate limiting** - Prevents abuse of duplicate check API
- **User permissions** - Only authenticated users can check duplicates
- **Data privacy** - No sensitive information in similarity analysis

## 🔄 Override Mechanism

### When Users Can Override
- **Medium/High confidence** - Show warning but allow creation
- **Very High confidence** - Require explicit override
- **Admin users** - Can always override with proper logging

### Override Process
1. User sees duplicate warning
2. Reviews similar events
3. Chooses "Create Anyway" option
4. System adds `skipDuplicateCheck: true` flag
5. Event created with override logged

## 📈 Future Enhancements

### Planned Improvements
- **Machine Learning** - Train on user feedback to improve accuracy
- **Image Analysis** - Compare event banners and images
- **Speaker Recognition** - Detect events with same speakers
- **Semantic Analysis** - Better understanding of event content
- **User Behavior** - Learn from user preferences and decisions

### Integration Possibilities
- **External APIs** - Check against other event platforms
- **Social Media** - Scan for similar events on social platforms
- **Calendar Integration** - Check against popular calendar services
- **University Systems** - Integration with academic calendars

## 🚀 Getting Started

### Backend Setup
1. The duplicate detection utility is automatically loaded
2. Routes are integrated into `/api/events`
3. No additional configuration required

### Frontend Integration
1. Include `duplicate-detection-frontend.js` in your HTML
2. The system automatically enhances event creation forms
3. Customize styling and behavior as needed

### Testing
```javascript
// Test duplicate detection
const testEvent = {
  title: "Test Event",
  description: "This is a test event",
  category: "technology",
  venue: { name: "Test Venue" },
  dateTime: { start: new Date() }
};

const results = await duplicateDetector.checkForDuplicates(testEvent);
console.log('Duplicate analysis:', results);
```

## 📞 Support

For questions or issues with the duplicate detection system:
- Check the logs in `/logs/` directory
- Review API responses for detailed error messages
- Adjust thresholds in `utils/duplicateDetection.js`
- Contact the development team for advanced configuration

---

**Note**: This AI system continuously learns and improves. User feedback and override decisions help refine the detection algorithms for better accuracy over time.