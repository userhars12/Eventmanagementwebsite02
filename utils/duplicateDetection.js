const logger = require('./logger');
const Event = require('../models/Event');

/**
 * AI-powered duplicate event detection utility
 * Uses text similarity, date proximity, and venue matching to detect duplicates
 */
class DuplicateEventDetector {
  constructor() {
    this.similarityThreshold = 0.8; // 80% similarity threshold
    this.dateProximityDays = 7; // Events within 7 days are considered close
    this.venueProximityKm = 5; // Events within 5km are considered close
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate text similarity using normalized Levenshtein distance
   */
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    // Normalize texts
    const normalized1 = text1.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const normalized2 = text2.toLowerCase().trim().replace(/[^\w\s]/g, '');
    
    if (normalized1 === normalized2) return 1;
    
    const maxLength = Math.max(normalized1.length, normalized2.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(normalized1, normalized2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Jaccard similarity for sets of words
   */
  calculateJaccardSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(word => word.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(word => word.length > 2));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Calculate combined text similarity score
   */
  calculateCombinedSimilarity(text1, text2) {
    const levenshtein = this.calculateTextSimilarity(text1, text2);
    const jaccard = this.calculateJaccardSimilarity(text1, text2);
    
    // Weighted combination: 60% Levenshtein, 40% Jaccard
    return (levenshtein * 0.6) + (jaccard * 0.4);
  }

  /**
   * Calculate date proximity score
   */
  calculateDateProximity(date1, date2) {
    const diffTime = Math.abs(new Date(date1) - new Date(date2));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 1; // Same day
    if (diffDays > this.dateProximityDays) return 0; // Too far apart
    
    return 1 - (diffDays / this.dateProximityDays);
  }

  /**
   * Calculate venue proximity score
   */
  calculateVenueProximity(venue1, venue2) {
    // Text similarity for venue names
    const nameSimilarity = this.calculateCombinedSimilarity(venue1.name, venue2.name);
    
    // Geographic proximity if coordinates are available
    let geoProximity = 0;
    if (venue1.coordinates && venue2.coordinates && 
        venue1.coordinates.latitude && venue1.coordinates.longitude &&
        venue2.coordinates.latitude && venue2.coordinates.longitude) {
      
      const distance = this.calculateDistance(
        venue1.coordinates.latitude, venue1.coordinates.longitude,
        venue2.coordinates.latitude, venue2.coordinates.longitude
      );
      
      geoProximity = distance <= this.venueProximityKm ? 1 - (distance / this.venueProximityKm) : 0;
    }
    
    // Address similarity
    const addressSimilarity = venue1.address && venue2.address ? 
      this.calculateCombinedSimilarity(
        `${venue1.address.street} ${venue1.address.city}`,
        `${venue2.address.street} ${venue2.address.city}`
      ) : 0;
    
    // Combined venue score: 50% name, 30% geo, 20% address
    return (nameSimilarity * 0.5) + (geoProximity * 0.3) + (addressSimilarity * 0.2);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate overall duplicate probability
   */
  calculateDuplicateProbability(event1, event2) {
    // Title similarity (most important)
    const titleSimilarity = this.calculateCombinedSimilarity(event1.title, event2.title);
    
    // Description similarity
    const descriptionSimilarity = this.calculateCombinedSimilarity(
      event1.description, event2.description
    );
    
    // Date proximity
    const dateProximity = this.calculateDateProximity(
      event1.dateTime.start, event2.dateTime.start
    );
    
    // Venue proximity
    const venueProximity = this.calculateVenueProximity(event1.venue, event2.venue);
    
    // Category match
    const categoryMatch = event1.category === event2.category ? 1 : 0;
    
    // Organizer match
    const organizerMatch = event1.organizer.toString() === event2.organizer.toString() ? 1 : 0;
    
    // Weighted combination
    const weights = {
      title: 0.35,
      description: 0.20,
      date: 0.15,
      venue: 0.15,
      category: 0.10,
      organizer: 0.05
    };
    
    const probability = 
      (titleSimilarity * weights.title) +
      (descriptionSimilarity * weights.description) +
      (dateProximity * weights.date) +
      (venueProximity * weights.venue) +
      (categoryMatch * weights.category) +
      (organizerMatch * weights.organizer);
    
    return {
      probability,
      factors: {
        titleSimilarity,
        descriptionSimilarity,
        dateProximity,
        venueProximity,
        categoryMatch,
        organizerMatch
      }
    };
  }

  /**
   * Check for duplicate events
   */
  async checkForDuplicates(newEvent, options = {}) {
    try {
      const {
        threshold = this.similarityThreshold,
        limit = 50,
        excludeEventId = null
      } = options;

      // Build query to find potentially similar events
      const query = {
        status: { $in: ['draft', 'published'] },
        category: newEvent.category,
        'dateTime.start': {
          $gte: new Date(new Date(newEvent.dateTime.start).getTime() - (this.dateProximityDays * 24 * 60 * 60 * 1000)),
          $lte: new Date(new Date(newEvent.dateTime.start).getTime() + (this.dateProximityDays * 24 * 60 * 60 * 1000))
        }
      };

      if (excludeEventId) {
        query._id = { $ne: excludeEventId };
      }

      // Find potentially similar events
      const existingEvents = await Event.find(query)
        .populate('organizer', 'firstName lastName')
        .limit(limit)
        .lean();

      const duplicates = [];
      const suggestions = [];

      for (const existingEvent of existingEvents) {
        const analysis = this.calculateDuplicateProbability(newEvent, existingEvent);
        
        if (analysis.probability >= threshold) {
          duplicates.push({
            event: existingEvent,
            probability: analysis.probability,
            factors: analysis.factors,
            confidence: this.getConfidenceLevel(analysis.probability)
          });
        } else if (analysis.probability >= 0.5) {
          suggestions.push({
            event: existingEvent,
            probability: analysis.probability,
            factors: analysis.factors,
            confidence: this.getConfidenceLevel(analysis.probability)
          });
        }
      }

      // Sort by probability (highest first)
      duplicates.sort((a, b) => b.probability - a.probability);
      suggestions.sort((a, b) => b.probability - a.probability);

      const result = {
        isDuplicate: duplicates.length > 0,
        duplicates: duplicates.slice(0, 5), // Top 5 duplicates
        suggestions: suggestions.slice(0, 3), // Top 3 suggestions
        analysis: {
          totalChecked: existingEvents.length,
          threshold,
          highConfidenceDuplicates: duplicates.filter(d => d.confidence === 'HIGH').length,
          mediumConfidenceDuplicates: duplicates.filter(d => d.confidence === 'MEDIUM').length
        }
      };

      // Log the analysis
      logger.info('Duplicate detection analysis', {
        eventTitle: newEvent.title,
        duplicatesFound: duplicates.length,
        suggestionsFound: suggestions.length,
        highestProbability: duplicates.length > 0 ? duplicates[0].probability : 0
      });

      return result;
    } catch (error) {
      logger.error('Error in duplicate detection:', error);
      throw new Error('Failed to check for duplicate events');
    }
  }

  /**
   * Get confidence level based on probability
   */
  getConfidenceLevel(probability) {
    if (probability >= 0.9) return 'VERY_HIGH';
    if (probability >= 0.8) return 'HIGH';
    if (probability >= 0.6) return 'MEDIUM';
    if (probability >= 0.4) return 'LOW';
    return 'VERY_LOW';
  }

  /**
   * Generate human-readable explanation
   */
  generateExplanation(analysis) {
    const { factors } = analysis;
    const explanations = [];

    if (factors.titleSimilarity > 0.8) {
      explanations.push(`Event titles are ${Math.round(factors.titleSimilarity * 100)}% similar`);
    }
    
    if (factors.descriptionSimilarity > 0.7) {
      explanations.push(`Event descriptions are ${Math.round(factors.descriptionSimilarity * 100)}% similar`);
    }
    
    if (factors.dateProximity > 0.8) {
      explanations.push('Events are scheduled very close in time');
    }
    
    if (factors.venueProximity > 0.8) {
      explanations.push('Events are at the same or very similar venue');
    }
    
    if (factors.categoryMatch === 1) {
      explanations.push('Events are in the same category');
    }
    
    if (factors.organizerMatch === 1) {
      explanations.push('Events have the same organizer');
    }

    return explanations.length > 0 ? explanations.join(', ') : 'General similarity detected';
  }
}

module.exports = new DuplicateEventDetector();