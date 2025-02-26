/**
 * LoggingService - Provides access to application logs
 * 
 * This service exposes IPC endpoints for the renderer process to access
 * and manage application logs.
 */

const BaseService = require('./BaseService');
const LogManager = require('../utils/LogManager');
const { ErrorManager } = require('../utils/ErrorManager');

// Get a logger for this module
const logger = LogManager.getLogger('LoggingService');

class LoggingService extends BaseService {
  constructor() {
    super('Logging');
    this.ipcRegistry = null;
  }

  async _initialize() {
    logger.info('Initializing LoggingService');
    
    // Get the IPC registry
    this.ipcRegistry = this.getService('ipc');
    
    // Register IPC handlers
    this._registerIpcHandlers();
    
    logger.info('LoggingService initialized');
  }

  async _shutdown() {
    logger.info('Shutting down LoggingService');
    
    // Unregister IPC handlers
    if (this.ipcRegistry) {
      this.ipcRegistry.unregister('logging:getLogFiles');
      this.ipcRegistry.unregister('logging:getLogContent');
      this.ipcRegistry.unregister('logging:setLogLevel');
      this.ipcRegistry.unregister('logging:getLogLevel');
      this.ipcRegistry.unregister('logging:getLogConfig');
    }
  }

  /**
   * Register IPC handlers for logging-related operations
   * @private
   */
  _registerIpcHandlers() {
    if (!this.ipcRegistry) {
      logger.error('IPC Registry not available, cannot register handlers');
      return;
    }

    // Register handlers
    this.ipcRegistry.register('logging:getLogFiles', this._handleGetLogFiles.bind(this));
    this.ipcRegistry.register('logging:getLogContent', this._handleGetLogContent.bind(this));
    this.ipcRegistry.register('logging:setLogLevel', this._handleSetLogLevel.bind(this));
    this.ipcRegistry.register('logging:getLogLevel', this._handleGetLogLevel.bind(this));
    this.ipcRegistry.register('logging:getLogConfig', this._handleGetLogConfig.bind(this));
    
    logger.debug('Registered IPC handlers for logging');
  }

  /**
   * Handle IPC request to get log files
   * @private
   */
  async _handleGetLogFiles() {
    try {
      logger.debug('Handling getLogFiles request');
      const files = LogManager.getLogFiles();
      return files;
    } catch (error) {
      logger.error('Error handling getLogFiles request', { metadata: { error } });
      throw ErrorManager.createError('filesystem', 'Failed to get log files', {
        metadata: { originalError: error }
      });
    }
  }

  /**
   * Handle IPC request to get log content
   * @param {Object} event - IPC event
   * @param {string} fileName - Name of the log file to retrieve
   * @private
   */
  async _handleGetLogContent(event, fileName) {
    try {
      logger.debug('Handling getLogContent request', { metadata: { fileName } });
      
      if (!fileName) {
        throw ErrorManager.createError('validation', 'File name is required');
      }
      
      const content = LogManager.getLogFileContent(fileName);
      
      if (content === null) {
        throw ErrorManager.createError('filesystem', 'Log file not found', {
          metadata: { fileName }
        });
      }
      
      return content;
    } catch (error) {
      logger.error('Error handling getLogContent request', { 
        metadata: { error, fileName } 
      });
      
      throw error instanceof Error ? error : 
        ErrorManager.createError('filesystem', 'Failed to get log content', {
          metadata: { originalError: error, fileName }
        });
    }
  }

  /**
   * Handle IPC request to set log level
   * @param {Object} event - IPC event
   * @param {string} level - Log level to set
   * @private
   */
  async _handleSetLogLevel(event, level) {
    try {
      logger.debug('Handling setLogLevel request', { metadata: { level } });
      
      if (!level || !['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].includes(level)) {
        throw ErrorManager.createError('validation', 'Invalid log level', {
          metadata: { level, validLevels: ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'] }
        });
      }
      
      LogManager.setLogLevel(level);
      return { success: true, level };
    } catch (error) {
      logger.error('Error handling setLogLevel request', { 
        metadata: { error, level } 
      });
      
      throw error instanceof Error ? error : 
        ErrorManager.createError('config', 'Failed to set log level', {
          metadata: { originalError: error, level }
        });
    }
  }

  /**
   * Handle IPC request to get current log level
   * @private
   */
  async _handleGetLogLevel() {
    try {
      logger.debug('Handling getLogLevel request');
      const level = LogManager.getLogLevel();
      return { level };
    } catch (error) {
      logger.error('Error handling getLogLevel request', { metadata: { error } });
      throw ErrorManager.createError('config', 'Failed to get log level', {
        metadata: { originalError: error }
      });
    }
  }

  /**
   * Handle IPC request to get log configuration
   * @private
   */
  async _handleGetLogConfig() {
    try {
      logger.debug('Handling getLogConfig request');
      const config = LogManager.getConfig();
      return config;
    } catch (error) {
      logger.error('Error handling getLogConfig request', { metadata: { error } });
      throw ErrorManager.createError('config', 'Failed to get log configuration', {
        metadata: { originalError: error }
      });
    }
  }

  /**
   * Get a list of available log files
   * @returns {Array<Object>} List of log files with metadata
   */
  getLogFiles() {
    return LogManager.getLogFiles();
  }

  /**
   * Get the content of a log file
   * @param {string} fileName - Name of the log file
   * @returns {string|null} Content of the log file or null if not found
   */
  getLogFileContent(fileName) {
    return LogManager.getLogFileContent(fileName);
  }

  /**
   * Set the global log level
   * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG, TRACE)
   */
  setLogLevel(level) {
    LogManager.setLogLevel(level);
  }

  /**
   * Get the current log level
   * @returns {string} Current log level
   */
  getLogLevel() {
    return LogManager.getLogLevel();
  }

  /**
   * Get the current logger configuration
   * @returns {Object} Current configuration
   */
  getLogConfig() {
    return LogManager.getConfig();
  }
}

module.exports = () => new LoggingService(); 