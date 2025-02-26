/**
 * ErrorManager - Centralized error handling and custom error classes
 * 
 * This module provides a set of custom error classes and utilities for
 * consistent error handling throughout the application.
 */

const LogManager = require('./LogManager');
const logger = LogManager.getLogger('ErrorManager');

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
 * Database errors
 */
class DatabaseError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_DATABASE',
      metadata: options.metadata || {}
    });
  }
}

/**
 * Validation errors
 */
class ValidationError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'ERR_VALIDATION',
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
   * @param {boolean} [rethrow=false] - Whether to rethrow the error after handling
   * @returns {Object} Processed error information
   */
  static handleError(error, context = {}, rethrow = false) {
    // Convert standard errors to AppError
    let appError;
    if (!(error instanceof AppError)) {
      appError = new AppError(error.message, {
        code: error.code || 'ERR_UNKNOWN',
        metadata: { originalError: error, ...context }
      });
    } else {
      appError = error;
      
      // Add context to metadata if provided
      if (context && Object.keys(context).length > 0) {
        appError.metadata = { ...appError.metadata, ...context };
      }
    }

    // Log the error using LogManager
    logger.error(appError.toString(), {
      metadata: {
        error: appError.toJSON(),
        context
      }
    });

    // Return processed error information
    const result = {
      error: appError.toJSON(),
      handled: true,
      timestamp: new Date()
    };
    
    // Rethrow if requested
    if (rethrow) {
      throw appError;
    }
    
    return result;
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
      case 'database':
        return new DatabaseError(message, options);
      case 'validation':
        return new ValidationError(message, options);
      default:
        return new AppError(message, options);
    }
  }
  
  /**
   * Log an error without throwing it
   * @param {string} type - Error type
   * @param {string} message - Error message
   * @param {Object} options - Error options
   * @returns {AppError} Created error instance
   */
  static logError(type, message, options = {}) {
    const error = this.createError(type, message, options);
    this.handleError(error);
    return error;
  }
  
  /**
   * Wrap a function with error handling
   * @param {Function} fn - Function to wrap
   * @param {Object} context - Error context
   * @param {boolean} [rethrow=false] - Whether to rethrow errors
   * @returns {Function} Wrapped function
   */
  static wrapWithErrorHandler(fn, context = {}, rethrow = false) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        return this.handleError(error, context, rethrow);
      }
    };
  }
}

module.exports = {
  ErrorManager,
  AppError,
  APIError,
  FileSystemError,
  ConfigError,
  IPCError,
  DatabaseError,
  ValidationError
}; 