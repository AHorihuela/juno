/**
 * ErrorManager - Centralized error handling and custom error classes
 * 
 * This module provides a set of custom error classes and utilities for
 * consistent error handling throughout the application.
 */

/**
 * Base application error class
 */
class AppError extends Error {
  /**
   * Create a new AppError
   * @param {string} message - Error message
   * @param {Object} options - Error options
   * @param {string} options.code - Error code
   * @param {Object} options.metadata - Additional error metadata
   */
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'ERR_UNKNOWN';
    this.metadata = options.metadata || {};
    this.timestamp = new Date();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON-serializable object
   * @returns {Object} Serialized error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Get a formatted string representation of the error
   * @returns {string} Formatted error string
   */
  toString() {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

/**
 * API-related errors
 */
class APIError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_API',
      metadata: options.metadata || {}
    });
  }
}

/**
 * File system errors
 */
class FileSystemError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_FILESYSTEM',
      metadata: options.metadata || {}
    });
  }
}

/**
 * Configuration errors
 */
class ConfigError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_CONFIG',
      metadata: options.metadata || {}
    });
  }
}

/**
 * IPC communication errors
 */
class IPCError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_IPC',
      metadata: options.metadata || {}
    });
  }
}

/**
 * Centralized error handler
 */
class ErrorManager {
  /**
   * Handle an error
   * @param {Error} error - Error to handle
   * @param {Object} context - Error context
   * @returns {Object} Processed error information
   */
  static handleError(error, context = {}) {
    // Convert standard errors to AppError
    if (!(error instanceof AppError)) {
      error = new AppError(error.message, {
        code: error.code || 'ERR_UNKNOWN',
        metadata: { originalError: error, ...context }
      });
    }

    // Log the error
    console.error(`[ErrorManager] ${error.toString()}`);
    if (error.metadata && Object.keys(error.metadata).length > 0) {
      console.error('[ErrorManager] Error metadata:', error.metadata);
    }

    // Return processed error information
    return {
      error: error.toJSON(),
      handled: true,
      timestamp: new Date()
    };
  }

  /**
   * Create an appropriate error instance based on error type
   * @param {string} type - Error type
   * @param {string} message - Error message
   * @param {Object} options - Error options
   * @returns {AppError} Error instance
   */
  static createError(type, message, options = {}) {
    switch (type.toLowerCase()) {
      case 'api':
        return new APIError(message, options);
      case 'filesystem':
        return new FileSystemError(message, options);
      case 'config':
        return new ConfigError(message, options);
      case 'ipc':
        return new IPCError(message, options);
      default:
        return new AppError(message, options);
    }
  }
}

module.exports = {
  ErrorManager,
  AppError,
  APIError,
  FileSystemError,
  ConfigError,
  IPCError
}; 