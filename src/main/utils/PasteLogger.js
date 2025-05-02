/**
 * PasteLogger - A dedicated logger for paste operations
 * 
 * This utility provides detailed logging for text insertion operations,
 * helping to diagnose paste-related issues.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const LogManager = require('./LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('PasteLogger');

class PasteLogger {
  constructor() {
    this.enabled = process.env.NODE_ENV === 'development';
    this.logPath = path.join(os.tmpdir(), 'juno-paste-log.txt');
    this.operations = [];
    
    if (this.enabled) {
      this._initializeLog();
    }
  }
  
  /**
   * Initialize the log file
   * @private
   */
  _initializeLog() {
    try {
      const header = `=== Juno Paste Operations Log ===\nStarted at: ${new Date().toISOString()}\n\n`;
      fs.writeFileSync(this.logPath, header);
      logger.debug(`Paste logger initialized, logging to: ${this.logPath}`);
    } catch (error) {
      logger.error('Failed to initialize paste log:', error);
      this.enabled = false;
    }
  }
  
  /**
   * Log a paste operation
   * @param {string} operation - The operation being performed
   * @param {Object} details - Additional details about the operation
   */
  logOperation(operation, details = {}) {
    if (!this.enabled) return;
    
    try {
      const timestamp = new Date().toISOString();
      const entry = {
        timestamp,
        operation,
        ...details
      };
      
      this.operations.push(entry);
      
      // Format the entry for the log file
      const formattedEntry = `[${timestamp}] ${operation}\n` + 
        Object.entries(details)
          .map(([key, value]) => `  ${key}: ${this._formatValue(value)}`)
          .join('\n') + 
        '\n\n';
      
      // Append to log file
      fs.appendFileSync(this.logPath, formattedEntry);
      
      logger.debug(`Paste operation logged: ${operation}`);
    } catch (error) {
      logger.error('Failed to log paste operation:', error);
    }
  }
  
  /**
   * Format a value for logging
   * @param {any} value - The value to format
   * @returns {string} The formatted value
   * @private
   */
  _formatValue(value) {
    if (typeof value === 'string') {
      // If string is too long, truncate it
      if (value.length > 100) {
        return `"${value.substring(0, 100)}..." (${value.length} chars)`;
      }
      return `"${value}"`;
    } else if (value instanceof Error) {
      return `Error: ${value.message}`;
    } else if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return `[Object: ${Object.keys(value).join(', ')}]`;
      }
    }
    return String(value);
  }
  
  /**
   * Get the path to the log file
   * @returns {string} Path to the log file
   */
  getLogPath() {
    return this.logPath;
  }
  
  /**
   * Get all logged operations
   * @returns {Array} Array of logged operations
   */
  getOperations() {
    return [...this.operations];
  }
  
  /**
   * Clear the log
   */
  clearLog() {
    if (!this.enabled) return;
    
    try {
      this.operations = [];
      this._initializeLog();
      logger.debug('Paste log cleared');
    } catch (error) {
      logger.error('Failed to clear paste log:', error);
    }
  }
}

// Export a singleton instance
module.exports = new PasteLogger(); 