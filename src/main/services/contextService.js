/**
 * Context Service
 * 
 * This service manages context for AI processing, including clipboard monitoring,
 * highlighted text, and memory management.
 * 
 * The implementation has been refactored into smaller components for better maintainability.
 * See the context/ directory for the actual implementation.
 */

const ContextService = require('./context/ContextService');

// Export a factory function that creates a new ContextService instance
module.exports = () => new ContextService(); 