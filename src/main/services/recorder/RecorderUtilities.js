const LogManager = require('../../utils/LogManager');
const logger = LogManager.getLogger('RecorderUtilities');

/**
 * Utility functions for the recorder module
 */
class RecorderUtilities {
  /**
   * Safely calls a service method, handling errors gracefully
   * @param {Object} serviceProvider - Object with getService method
   * @param {string} serviceName - Name of the service to call
   * @param {string} methodName - Method to call on the service
   * @param {Array} args - Arguments to pass to the method
   * @param {Object} options - Additional options
   * @returns {Promise<any>} - Result of the service call or null on error
   */
  static async safeServiceCall(serviceProvider, serviceName, methodName, args = [], options = {}) {
    const { 
      errorMessage = `Error calling ${serviceName}.${methodName}`,
      logLevel = 'error',
      throwError = false
    } = options;
    
    try {
      const service = serviceProvider.getService(serviceName);
      if (!service) {
        logger.warn(`Service ${serviceName} not available`);
        return null;
      }
      
      if (typeof service[methodName] !== 'function') {
        logger.warn(`Method ${methodName} not found on service ${serviceName}`);
        return null;
      }
      
      return await service[methodName](...args);
    } catch (error) {
      // Log based on specified level
      if (logLevel === 'error') {
        logger.error(errorMessage, { metadata: { error } });
      } else if (logLevel === 'warn') {
        logger.warn(errorMessage, { metadata: { error } });
      } else {
        logger.info(errorMessage, { metadata: { error } });
      }
      
      if (throwError) {
        throw error;
      }
      
      return null;
    }
  }

  /**
   * Type-safe getter for transcription results
   * @param {any} transcription - The transcription result
   * @returns {Object} - Object with properly typed values
   */
  static getTypeSafeTranscription(transcription) {
    const isString = typeof transcription === 'string';
    const isObject = typeof transcription === 'object' && transcription !== null;
    
    return {
      isString,
      isObject,
      text: isString ? transcription : (isObject && transcription.text ? transcription.text : ''),
      preview: isString ? 
        `${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}` : 
        (isObject ? '[object result]' : '[non-string result]'),
      length: isString ? transcription.length : (isObject ? JSON.stringify(transcription).length : 0)
    };
  }

  /**
   * Runs several promises in parallel and handles exceptions gracefully
   * @param {Array<Function>} promiseFunctions - Array of functions returning promises
   * @returns {Promise<Array>} - Results array with null for failed promises
   */
  static async runParallel(promiseFunctions) {
    const promises = promiseFunctions.map(fn => 
      Promise.resolve().then(fn).catch(error => {
        logger.error('Error in parallel execution:', { metadata: { error } });
        return null;
      })
    );
    
    return await Promise.all(promises);
  }
}

module.exports = RecorderUtilities; 