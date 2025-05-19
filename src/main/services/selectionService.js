/**
 * This file is a compatibility layer for the new modular SelectionService implementation.
 * It exports the same factory function as before, but uses the new implementation.
 * 
 * IMPORTANT: All compatibility methods have been added directly to the SelectionService class,
 * so this file simply re-exports the factory function.
 */
const SelectionServiceImpl = require('./selection/SelectionService');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('selectionServiceCompat');

// Get the singleton instance
function getSelectionServiceInstance() {
  return global.selectionService;
}

/**
 * Gets the selection by trying all applicable strategies in parallel
 * Returns the first non-empty result from any strategy
 * @returns {Promise<string>} The selected text
 */
async function getSelectionInParallel() {
  const selectionService = getSelectionServiceInstance();
  if (!selectionService) {
    logger.error('SelectionService not initialized');
    return '';
  }

  logger.debug('Getting selection in parallel');
  return selectionService.getSelectionInParallel();
}

// Export a factory function that returns a new SelectionService instance
module.exports = function() {
  return SelectionServiceImpl();
};

// Add additional exports to the factory function
module.exports.getSelectionInParallel = getSelectionInParallel; 