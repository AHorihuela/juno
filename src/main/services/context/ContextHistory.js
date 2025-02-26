/**
 * ContextHistory - Manages the history of context items
 * 
 * This class handles the storage, retrieval, and management of context history items.
 */

const { isSimilarToExistingContext } = require('./SimilarityDetection');

class ContextHistory {
  /**
   * Creates a new ContextHistory instance
   * @param {number} maxHistoryItems - Maximum number of history items to keep
   * @param {number} similarityThreshold - Threshold for similarity detection (0-1)
   */
  constructor(maxHistoryItems = 5, similarityThreshold = 0.8) {
    this.history = [];
    this.maxHistoryItems = maxHistoryItems;
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Add an item to context history
   * @param {Object} contextItem - The context item to add
   * @returns {boolean} True if item was added, false if it was a duplicate
   */
  addItem(contextItem) {
    // Ensure the item has an ID
    if (!contextItem.id) {
      contextItem.id = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Don't add duplicates
    const isDuplicate = this.history.some(item => 
      item.type === contextItem.type && item.content === contextItem.content
    );
    
    if (!isDuplicate) {
      // Add to beginning of array
      this.history.unshift(contextItem);
      
      // Trim history to max size
      if (this.history.length > this.maxHistoryItems) {
        this.history = this.history.slice(0, this.maxHistoryItems);
      }
      
      console.log('[ContextHistory] Added item to context history, new size:', this.history.length);
      return true;
    }
    
    return false;
  }

  /**
   * Check if content is similar to existing context items
   * @param {string} content - Content to check
   * @param {string} type - Type of content (e.g., 'clipboard', 'highlight')
   * @returns {boolean} True if similar content exists
   */
  isSimilarToExisting(content, type) {
    return isSimilarToExistingContext(this.history, content, type, this.similarityThreshold);
  }

  /**
   * Get all history items
   * @returns {Array} Array of context history items
   */
  getAll() {
    return this.history;
  }

  /**
   * Get a specific number of most recent history items
   * @param {number} count - Number of items to retrieve
   * @returns {Array} Array of context history items
   */
  getRecent(count = 1) {
    return this.history.slice(0, count);
  }

  /**
   * Delete a history item by ID
   * @param {string} id - ID of the item to delete
   * @returns {boolean} True if item was deleted, false if not found
   */
  deleteItem(id) {
    const initialLength = this.history.length;
    this.history = this.history.filter(item => item.id !== id);
    return this.history.length < initialLength;
  }

  /**
   * Clear all history items
   */
  clear() {
    this.history = [];
    console.log('[ContextHistory] History cleared');
  }

  /**
   * Get the current size of the history
   * @returns {number} Number of items in history
   */
  size() {
    return this.history.length;
  }

  /**
   * Export history for persistence
   * @returns {Object} Serializable history data
   */
  export() {
    return {
      history: this.history,
      timestamp: Date.now()
    };
  }

  /**
   * Import history from persistence
   * @param {Object} data - Previously exported history data
   * @param {number} maxAgeHours - Maximum age of history items in hours
   * @returns {boolean} Success status
   */
  import(data, maxAgeHours = 24) {
    try {
      if (!data || !data.history || !Array.isArray(data.history)) {
        return false;
      }
      
      // Only import history that's not too old
      const now = Date.now();
      if (now - data.timestamp > maxAgeHours * 60 * 60 * 1000) {
        console.log('[ContextHistory] Imported history is too old, ignoring');
        return false;
      }
      
      this.history = data.history;
      console.log('[ContextHistory] Imported context history, size:', this.history.length);
      
      return true;
    } catch (error) {
      console.error('[ContextHistory] Error importing history:', error);
      return false;
    }
  }
}

module.exports = ContextHistory; 