/**
 * LogManager - Centralized logging configuration and management
 * 
 * This module provides a centralized way to configure logging across the application
 * and creates module-specific loggers with consistent formatting.
 */

const logger = require('./logger');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * @typedef {Object} LogConfig
 * @property {string} [logLevel] - Default log level (ERROR, WARN, INFO, DEBUG, TRACE)
 * @property {number} [maxLogFiles] - Maximum number of log files to keep
 * @property {number} [maxLogSize] - Maximum size of log files in bytes
 * @property {boolean} [logToConsole] - Whether to log to console
 * @property {boolean} [logToFile] - Whether to log to file
 * @property {boolean} [includeTimestamp] - Whether to include timestamp in logs
 * @property {boolean} [prettyPrint] - Whether to pretty print metadata
 * @property {boolean} [includeSystemInfo] - Whether to include system info in error logs
 */

/**
 * Default environment-specific configurations
 */
const ENV_CONFIGS = {
  development: {
    logLevel: 'DEBUG',
    prettyPrint: true,
    includeSystemInfo: true
  },
  test: {
    logLevel: 'ERROR',
    logToFile: false,
    prettyPrint: false
  },
  production: {
    logLevel: 'INFO',
    prettyPrint: false,
    maxLogFiles: 5
  }
};

/**
 * Module registry to keep track of created loggers
 * @type {Map<string, Object>}
 */
const moduleLoggers = new Map();

/**
 * LogManager class for centralized logging configuration
 */
class LogManager {
  /**
   * Initialize the LogManager
   */
  constructor() {
    this.initialized = false;
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Initialize the LogManager with configuration
   * @param {LogConfig} [config={}] - Custom configuration
   */
  initialize(config = {}) {
    if (this.initialized) {
      return;
    }

    // Load environment-specific config
    const envConfig = ENV_CONFIGS[this.environment] || ENV_CONFIGS.development;
    
    // Apply configuration
    logger.configure({
      ...envConfig,
      ...config
    });

    // Log initialization
    logger.info(`LogManager initialized in ${this.environment} environment`, {
      module: 'LogManager',
      metadata: {
        config: logger.getConfig()
      }
    });

    this.initialized = true;
    
    // Log application info
    if (app) {
      logger.info('Application info', {
        module: 'LogManager',
        metadata: {
          name: app.getName(),
          version: app.getVersion(),
          electronVersion: process.versions.electron,
          nodeVersion: process.versions.node,
          platform: process.platform,
          arch: process.arch
        }
      });
    }
    
    return this;
  }

  /**
   * Get a logger for a specific module
   * @param {string} moduleName - Name of the module
   * @returns {Object} Logger instance for the module
   */
  getLogger(moduleName) {
    // Ensure LogManager is initialized
    if (!this.initialized) {
      this.initialize();
    }

    // Check if logger already exists for this module
    if (moduleLoggers.has(moduleName)) {
      return moduleLoggers.get(moduleName);
    }

    // Create a new logger for this module
    const moduleLogger = logger.createModuleLogger(moduleName);
    moduleLoggers.set(moduleName, moduleLogger);
    
    return moduleLogger;
  }

  /**
   * Set the global log level
   * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG, TRACE)
   */
  setLogLevel(level) {
    logger.setLogLevel(level);
    logger.info(`Log level set to ${level}`, { module: 'LogManager' });
  }

  /**
   * Get the current log level
   * @returns {string} Current log level
   */
  getLogLevel() {
    return logger.getLogLevel();
  }

  /**
   * Get the current logger configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return logger.getConfig();
  }

  /**
   * Update the logger configuration
   * @param {LogConfig} config - New configuration
   */
  updateConfig(config) {
    logger.configure({
      ...logger.getConfig(),
      ...config
    });
    
    logger.info('Logger configuration updated', {
      module: 'LogManager',
      metadata: { config: logger.getConfig() }
    });
  }

  /**
   * Get a list of available log files
   * @returns {Array<Object>} List of log files with metadata
   */
  getLogFiles() {
    try {
      const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), 'userData');
      const logDir = path.join(userDataPath, 'logs');
      
      if (!fs.existsSync(logDir)) {
        return [];
      }
      
      return fs.readdirSync(logDir)
        .filter(file => file.startsWith('juno-') && file.endsWith('.log'))
        .map(file => {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.modified.getTime() - a.modified.getTime());
    } catch (error) {
      logger.error('Failed to get log files', {
        module: 'LogManager',
        metadata: { error }
      });
      return [];
    }
  }

  /**
   * Get the content of a log file
   * @param {string} fileName - Name of the log file
   * @returns {string|null} Content of the log file or null if not found
   */
  getLogFileContent(fileName) {
    try {
      const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), 'userData');
      const logDir = path.join(userDataPath, 'logs');
      const filePath = path.join(logDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      logger.error('Failed to read log file', {
        module: 'LogManager',
        metadata: { fileName, error }
      });
      return null;
    }
  }
}

// Create and export a singleton instance
const logManager = new LogManager();
module.exports = logManager; 