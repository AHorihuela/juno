/**
 * Dictionary Service - Main Entry Point
 * This file has been refactored to use a modular approach for better maintainability
 */

// Import the modular implementation
const dictionaryServiceFactory = require('./dictionary');

// Export the factory function
module.exports = dictionaryServiceFactory; 