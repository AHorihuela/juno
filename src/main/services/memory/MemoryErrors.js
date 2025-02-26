/**
 * Custom error classes for the memory system
 * 
 * This module provides specialized error classes for different types of memory-related errors,
 * allowing for more precise error handling and better debugging.
 */

/**
 * Base class for all memory-related errors
 */
class MemoryError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Object} [options] - Error options
   * @param {Error} [options.cause] - The error that caused this error
   * @param {Object} [options.context] - Additional context for the error
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'MemoryError';
    this.context = options.context || {};
    
    // Add any additional context properties directly
    Object.entries(options)
      .filter(([key]) => !['cause', 'context'].includes(key))
      .forEach(([key, value]) => {
        this.context[key] = value;
      });
      
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Get a JSON representation of the error
   * 
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      cause: this.cause ? (this.cause.toJSON ? this.cause.toJSON() : String(this.cause)) : undefined,
      stack: this.stack
    };
  }
}

/**
 * Error for memory access issues (reading, searching)
 */
class MemoryAccessError extends MemoryError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'MemoryAccessError';
  }
}

/**
 * Error for memory storage issues (writing, persistence)
 */
class MemoryStorageError extends MemoryError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'MemoryStorageError';
  }
}

/**
 * Error for memory tier management issues
 */
class MemoryTierError extends MemoryError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'MemoryTierError';
  }
}

/**
 * Error for memory scoring and relevance issues
 */
class MemoryScoringError extends MemoryError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'MemoryScoringError';
  }
}

/**
 * Error for memory statistics issues
 */
class MemoryStatsError extends MemoryError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'MemoryStatsError';
  }
}

module.exports = {
  MemoryError,
  MemoryAccessError,
  MemoryStorageError,
  MemoryTierError,
  MemoryScoringError,
  MemoryStatsError
}; 