/**
 * MemoryManager Service
 * 
 * This is the main entry point for the memory system.
 * It delegates to the modular implementation in the memory/ directory.
 */

const memoryManagerFactory = require('./memory/MemoryManager');
const logger = require('../utils/logger');

// Export the factory function that creates a new MemoryManager instance
module.exports = memoryManagerFactory; 