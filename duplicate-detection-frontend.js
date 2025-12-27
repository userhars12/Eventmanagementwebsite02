/**
 * Frontend integration for AI-powered duplicate event detection
 * This code should be integrated into the main index.html file
 */

// Duplicate detection functionality
let duplicateCheckInProgress = false;
let lastDuplicateCheck = null;

/**
 * Check for duplicate events before creating/updating
 */
async function checkForDuplicates(eventData, excludeEventId = null) {
  if (duplicateCheckInProgress) {
    return lastDuplicateCheck;
  }

  try {
    duplicateCheckInProgress = true;
    showDuplicateCheckLoading(true);

    const response = await fetch('/api/events/check-duplicates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        ...eventData,
        excludeEventId
      })
    });

    const result = await response.json();
    lastDuplicateCheck = result;

    if (!response.ok) {
      throw new Error(result.message || 'Failed to check for duplicates');
    }

    return result;
  } catch (error) {
    console.error('Duplicate check error:', error);
    showNotification('Failed to check for duplicates. You can still create the event.', 'warning');
    return { isDuplicate: false, duplicates: [], suggestions: [] };
  } finally {
    duplicateCheckInProgress = false;
    showDuplicateCheckLoading(false);
  }
}

/**
 * Show/hide duplicate check loading indicator
 */
function showDuplicateCheckLoading(show) {
  const loadingElement = document.getElementById('duplicateCheckLoading');
  if (loadingElement) {
    loadingElement.style.display = show ? 'block' : 'none';
  }
}

/**
 * Display duplicate detection results
 */
function showDuplicateResults(results) {
  const { isDuplicate, duplicates, suggestions, recommendations } = results;
  
  // Remove existing duplicate warnings
  const existingWarnings = document.querySelectorAll('.duplicate-warning');
  existingWarnings.forEach(warning => warning.remove());

  if (!isDuplicate && suggestions.length === 0) {
    showNotification('✅ No similar events found. You can proceed with creating this event.', 'success');
    return { canProceed: true, shouldWarn: false };
  }

  // Create duplicate warning modal
  const modal = createDuplicateWarningModal(duplicates, suggestions, recommendations);
  document.body.appendChild(modal);
  modal.style.display = 'flex';

  return new Promise((resolve) => {
    // Handle user decision
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('proceed-anyway')) {
        modal.remove();
        resolve({ canProceed: true, shouldWarn: true, skipDuplicateCheck: true });
      } else if (e.target.classList.contains('cancel-creation')) {
        modal.remove();
        resolve({ canProceed: false, shouldWarn: true });
      } else if (e.target.classList.contains('view-duplicate')) {
        const eventId = e.target.dataset.eventId;
        viewEventDetails(eventId);
      }
    });
  });
}

/**
 * Create duplicate warning modal
 */
function createDuplicateWarningModal(duplicates, suggestions, recommendations) {
  const modal = document.createElement('div');
  modal.className = 'duplicate-warning modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  
  const content = document.createElement('div');
  content.className = 'bg-white rounded-lg p-6 max-w-4xl max-h-90vh overflow-y-auto m-4';
  
  let html = `
    <div class="duplicate-warning-header mb-4">
      <h2 class="text-2xl font-bold text-orange-600 mb-2">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        Similar Events Detected
      </h2>
      <p class="text-gray-600">${recommendations.message}</p>
    </div>
  `;

  // Show high-confidence duplicates
  if (duplicates.length > 0) {
    html += `
      <div class="duplicates-section mb-6">
        <h3 class="text-lg font-semibold text-red-600 mb-3">
          <i class="fas fa-copy mr-2"></i>
          Potential Duplicates (${duplicates.length})
        </h3>
        <div class="space-y-3">
    `;
    
    duplicates.forEach(duplicate => {
      const confidence = getConfidenceColor(duplicate.confidence);
      html += `
        <div class="duplicate-item border border-red-200 rounded-lg p-4 bg-red-50">
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-semibold text-gray-800">${duplicate.event.title}</h4>
            <span class="px-2 py-1 rounded text-xs font-medium ${confidence.class}">
              ${Math.round(duplicate.probability * 100)}% Match
            </span>
          </div>
          <p class="text-sm text-gray-600 mb-2">${duplicate.event.description.substring(0, 150)}...</p>
          <div class="text-xs text-gray-500 mb-2">
            <i class="fas fa-calendar mr-1"></i>
            ${new Date(duplicate.event.dateTime.start).toLocaleDateString()}
            <i class="fas fa-map-marker-alt ml-3 mr-1"></i>
            ${duplicate.event.venue.name}
          </div>
          <p class="text-sm text-orange-600 mb-3">
            <i class="fas fa-info-circle mr-1"></i>
            ${duplicate.explanation}
          </p>
          <button class="view-duplicate text-blue-600 hover:text-blue-800 text-sm font-medium" 
                  data-event-id="${duplicate.event._id}">
            <i class="fas fa-eye mr-1"></i>View Event Details
          </button>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }

  // Show suggestions
  if (suggestions.length > 0) {
    html += `
      <div class="suggestions-section mb-6">
        <h3 class="text-lg font-semibold text-yellow-600 mb-3">
          <i class="fas fa-lightbulb mr-2"></i>
          Similar Events You Might Want to Review (${suggestions.length})
        </h3>
        <div class="space-y-3">
    `;
    
    suggestions.forEach(suggestion => {
      const confidence = getConfidenceColor(suggestion.confidence);
      html += `
        <div class="suggestion-item border border-yellow-200 rounded-lg p-4 bg-yellow-50">
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-semibold text-gray-800">${suggestion.event.title}</h4>
            <span class="px-2 py-1 rounded text-xs font-medium ${confidence.class}">
              ${Math.round(suggestion.probability * 100)}% Similar
            </span>
          </div>
          <p class="text-sm text-gray-600 mb-2">${suggestion.event.description.substring(0, 150)}...</p>
          <div class="text-xs text-gray-500 mb-2">
            <i class="fas fa-calendar mr-1"></i>
            ${new Date(suggestion.event.dateTime.start).toLocaleDateString()}
            <i class="fas fa-map-marker-alt ml-3 mr-1"></i>
            ${suggestion.event.venue.name}
          </div>
          <p class="text-sm text-yellow-600 mb-3">
            <i class="fas fa-info-circle mr-1"></i>
            ${suggestion.explanation}
          </p>
          <button class="view-duplicate text-blue-600 hover:text-blue-800 text-sm font-medium" 
                  data-event-id="${suggestion.event._id}">
            <i class="fas fa-eye mr-1"></i>View Event Details
          </button>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }

  // Action buttons
  html += `
    <div class="actions-section border-t pt-4">
      <div class="flex justify-end space-x-3">
        <button class="cancel-creation px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
          <i class="fas fa-times mr-2"></i>Cancel
        </button>
        ${recommendations.shouldBlock ? `
          <button class="proceed-anyway px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700">
            <i class="fas fa-exclamation-triangle mr-2"></i>Create Anyway
          </button>
        ` : `
          <button class="proceed-anyway px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            <i class="fas fa-check mr-2"></i>Proceed with Creation
          </button>
        `}
      </div>
      <p class="text-xs text-gray-500 mt-2">
        <i class="fas fa-robot mr-1"></i>
        AI-powered duplicate detection helps maintain event quality and avoid confusion.
      </p>
    </div>
  `;

  content.innerHTML = html;
  modal.appendChild(content);
  
  return modal;
}

/**
 * Get confidence level styling
 */
function getConfidenceColor(confidence) {
  switch (confidence) {
    case 'VERY_HIGH':
      return { class: 'bg-red-100 text-red-800', label: 'Very High' };
    case 'HIGH':
      return { class: 'bg-red-100 text-red-700', label: 'High' };
    case 'MEDIUM':
      return { class: 'bg-yellow-100 text-yellow-700', label: 'Medium' };
    case 'LOW':
      return { class: 'bg-blue-100 text-blue-700', label: 'Low' };
    default:
      return { class: 'bg-gray-100 text-gray-700', label: 'Very Low' };
  }
}

/**
 * Enhanced event creation with duplicate checking
 */
async function createEventWithDuplicateCheck(eventData) {
  try {
    // First, check for duplicates
    const duplicateResults = await checkForDuplicates(eventData);
    
    // Show results and get user decision
    const userDecision = await showDuplicateResults(duplicateResults);
    
    if (!userDecision.canProceed) {
      return { success: false, message: 'Event creation cancelled by user' };
    }

    // Add skipDuplicateCheck flag if user chose to proceed anyway
    if (userDecision.skipDuplicateCheck) {
      eventData.skipDuplicateCheck = true;
    }

    // Create the event
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(eventData)
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle duplicate detection error from server
      if (result.code === 'DUPLICATE_DETECTED') {
        const serverDecision = await showDuplicateResults({
          isDuplicate: true,
          duplicates: result.duplicates,
          suggestions: [],
          recommendations: { shouldBlock: true, message: result.message }
        });

        if (serverDecision.canProceed && serverDecision.skipDuplicateCheck) {
          // Retry with skip flag
          eventData.skipDuplicateCheck = true;
          return createEventWithDuplicateCheck(eventData);
        }
        
        return { success: false, message: 'Event creation cancelled due to duplicates' };
      }
      
      throw new Error(result.message || 'Failed to create event');
    }

    return { success: true, event: result.event };
  } catch (error) {
    console.error('Event creation error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Add duplicate check loading indicator to the form
 */
function addDuplicateCheckIndicator() {
  const createForm = document.getElementById('createEventForm');
  if (createForm && !document.getElementById('duplicateCheckLoading')) {
    const indicator = document.createElement('div');
    indicator.id = 'duplicateCheckLoading';
    indicator.className = 'duplicate-check-loading hidden flex items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4';
    indicator.innerHTML = `
      <div class="flex items-center">
        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
        <span class="text-blue-700">
          <i class="fas fa-robot mr-2"></i>
          AI is checking for similar events...
        </span>
      </div>
    `;
    createForm.insertBefore(indicator, createForm.firstChild);
  }
}

/**
 * Initialize duplicate detection on page load
 */
document.addEventListener('DOMContentLoaded', function() {
  addDuplicateCheckIndicator();
  
  // Override the original createEvent function
  if (typeof window.createEvent === 'function') {
    window.originalCreateEvent = window.createEvent;
    window.createEvent = createEventWithDuplicateCheck;
  }
});

// CSS for duplicate detection (add to styles.css)
const duplicateDetectionCSS = `
.duplicate-warning .modal {
  animation: fadeIn 0.3s ease-out;
}

.duplicate-item, .suggestion-item {
  transition: all 0.2s ease;
}

.duplicate-item:hover, .suggestion-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.duplicate-check-loading {
  animation: slideDown 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideDown {
  from { 
    opacity: 0;
    transform: translateY(-10px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

.confidence-badge {
  font-weight: 600;
  letter-spacing: 0.025em;
}
`;

// Add CSS to the page
const style = document.createElement('style');
style.textContent = duplicateDetectionCSS;
document.head.appendChild(style);