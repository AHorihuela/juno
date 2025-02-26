/**
 * Base class for selection strategies
 * Each strategy implements a different method for retrieving selected text
 */
class SelectionStrategy {
  constructor(name) {
    this.name = name;
  }

  /**
   * Get selected text using this strategy
   * @param {string} appName - Name of the active application
   * @returns {Promise<{text: string, success: boolean}>} Selected text and success status
   */
  async getSelection(appName) {
    throw new Error('SelectionStrategy.getSelection must be implemented by subclasses');
  }

  /**
   * Check if this strategy is applicable for the given app
   * @param {string} appName - Name of the active application
   * @returns {boolean} True if this strategy can be used for the given app
   */
  isApplicable(appName) {
    return true; // Default implementation assumes strategy is always applicable
  }

  /**
   * Log a message with the strategy name prefix
   * @param {string} message - Message to log
   * @param {Object} [data] - Optional data to log
   */
  log(message, data) {
    if (data) {
      console.log(`[${this.name}Strategy] ${message}`, data);
    } else {
      console.log(`[${this.name}Strategy] ${message}`);
    }
  }

  /**
   * Log an error with the strategy name prefix
   * @param {string} message - Error message
   * @param {Error} [error] - Optional error object
   */
  logError(message, error) {
    if (error) {
      console.error(`[${this.name}Strategy] ${message}`, error);
    } else {
      console.error(`[${this.name}Strategy] ${message}`);
    }
  }
}

module.exports = SelectionStrategy; 