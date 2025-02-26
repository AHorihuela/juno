const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const os = require('os');

/**
 * @typedef {Object} LogOptions
 * @property {string} [module] - Module name for the log entry
 * @property {Object} [metadata] - Additional metadata to include in the log
 * @property {boolean} [consoleOnly=false] - Whether to log only to console and not to file
 * @property {boolean} [fileOnly=false] - Whether to log only to file and not to console
 */

/**
 * Log levels enum
 * @enum {number}
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Map log level names to colors for console output
const LEVEL_COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m',  // Yellow
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[32m', // Green
  TRACE: '\x1b[35m'  // Magenta
};

const RESET_COLOR = '\x1b[0m';

// Default configuration
const DEFAULT_CONFIG = {
  logLevel: 'INFO',
  maxLogFiles: 10,
  maxLogSize: 10 * 1024 * 1024, // 10MB
  logToConsole: true,
  logToFile: true,
  includeTimestamp: true,
  prettyPrint: true,
  includeSystemInfo: true
};

// Current configuration
let config = { ...DEFAULT_CONFIG };

// Current log level
let currentLogLevel = LOG_LEVELS[config.logLevel];

// Current log file info
let currentLogFile = {
  path: '',
  size: 0
};

/**
 * Get user data path for logs
 * @returns {string} Path to user data directory
 */
const getUserDataPath = () => {
  return app ? app.getPath('userData') : path.join(process.cwd(), 'userData');
};

/**
 * Create logs directory if it doesn't exist
 * @returns {string} Path to log directory
 */
const ensureLogDirectory = () => {
  const logDir = path.join(getUserDataPath(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
};

/**
 * Get log file path
 * @returns {string} Path to current log file
 */
const getLogFilePath = () => {
  const logDir = ensureLogDirectory();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logDir, `juno-${date}.log`);
};

/**
 * Rotate log files if needed
 * @param {string} logFilePath - Path to the log file
 */
const rotateLogsIfNeeded = (logFilePath) => {
  try {
    // Check if file exists
    if (!fs.existsSync(logFilePath)) {
      currentLogFile = { path: logFilePath, size: 0 };
      return;
    }

    // Get file stats
    const stats = fs.statSync(logFilePath);
    
    // Update current log file info
    currentLogFile = { path: logFilePath, size: stats.size };
    
    // Check if rotation is needed
    if (stats.size >= config.maxLogSize) {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const rotatedFilePath = `${logFilePath}.${timestamp}`;
      
      // Rename current log file
      fs.renameSync(logFilePath, rotatedFilePath);
      
      // Reset current log file info
      currentLogFile = { path: logFilePath, size: 0 };
      
      // Clean up old log files
      cleanupOldLogFiles();
    }
  } catch (error) {
    console.error('Failed to rotate log files:', error);
  }
};

/**
 * Clean up old log files
 */
const cleanupOldLogFiles = () => {
  try {
    const logDir = ensureLogDirectory();
    const files = fs.readdirSync(logDir)
      .filter(file => file.startsWith('juno-') && file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(logDir, file),
        time: fs.statSync(path.join(logDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort by modification time (newest first)
    
    // Keep only the most recent files based on maxLogFiles config
    if (files.length > config.maxLogFiles) {
      files.slice(config.maxLogFiles).forEach(file => {
        fs.unlinkSync(file.path);
      });
    }
  } catch (error) {
    console.error('Failed to clean up old log files:', error);
  }
};

/**
 * Format log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {LogOptions} [options={}] - Log options
 * @returns {string} Formatted log message
 */
const formatLogMessage = (level, message, options = {}) => {
  const { module, metadata = {} } = options;
  const timestamp = config.includeTimestamp ? new Date().toISOString() : '';
  const modulePrefix = module ? `[${module}] ` : '';
  
  // Add system info to metadata for errors
  if (level === 'ERROR' && config.includeSystemInfo) {
    metadata.system = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      cpus: os.cpus().length
    };
  }
  
  // Format metadata
  let metadataString = '';
  if (Object.keys(metadata).length > 0) {
    if (config.prettyPrint) {
      metadataString = `\n${JSON.stringify(metadata, null, 2)}`;
    } else {
      metadataString = ` ${JSON.stringify(metadata)}`;
    }
  }
  
  // Format for file
  const fileMessage = timestamp ? 
    `[${timestamp}] [${level}] ${modulePrefix}${message}${metadataString}\n` :
    `[${level}] ${modulePrefix}${message}${metadataString}\n`;
  
  // Format for console with colors
  const consoleMessage = timestamp ?
    `${LEVEL_COLORS[level]}[${timestamp}] [${level}]${RESET_COLOR} ${modulePrefix}${message}${metadataString}` :
    `${LEVEL_COLORS[level]}[${level}]${RESET_COLOR} ${modulePrefix}${message}${metadataString}`;
  
  return { fileMessage, consoleMessage };
};

/**
 * Write to log file
 * @param {string} message - Message to write to log file
 */
const writeToLogFile = (message) => {
  if (!config.logToFile) return;
  
  try {
    const logFilePath = getLogFilePath();
    
    // Check if we need to rotate logs
    if (logFilePath !== currentLogFile.path) {
      rotateLogsIfNeeded(logFilePath);
    } else if (currentLogFile.size + message.length >= config.maxLogSize) {
      rotateLogsIfNeeded(logFilePath);
    }
    
    // Append to log file
    fs.appendFileSync(logFilePath, message);
    
    // Update current log file size
    currentLogFile.size += message.length;
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
};

/**
 * Logger object with logging methods
 */
const logger = {
  /**
   * Configure the logger
   * @param {Object} newConfig - New configuration
   */
  configure: (newConfig = {}) => {
    config = { ...DEFAULT_CONFIG, ...newConfig };
    currentLogLevel = LOG_LEVELS[config.logLevel] !== undefined ? 
      LOG_LEVELS[config.logLevel] : LOG_LEVELS.INFO;
  },
  
  /**
   * Get current logger configuration
   * @returns {Object} Current configuration
   */
  getConfig: () => ({ ...config }),
  
  /**
   * Set log level
   * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG, TRACE)
   */
  setLogLevel: (level) => {
    if (LOG_LEVELS[level] !== undefined) {
      currentLogLevel = LOG_LEVELS[level];
      config.logLevel = level;
    }
  },
  
  /**
   * Get current log level
   * @returns {string} Current log level
   */
  getLogLevel: () => {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === currentLogLevel);
  },
  
  /**
   * Log error message
   * @param {string} message - Error message
   * @param {LogOptions} [options={}] - Log options
   */
  error: (message, options = {}) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      const { fileMessage, consoleMessage } = formatLogMessage('ERROR', message, options);
      
      if (config.logToConsole && !options.fileOnly) {
        console.error(consoleMessage);
      }
      
      if (!options.consoleOnly) {
        writeToLogFile(fileMessage);
      }
    }
  },
  
  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {LogOptions} [options={}] - Log options
   */
  warn: (message, options = {}) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      const { fileMessage, consoleMessage } = formatLogMessage('WARN', message, options);
      
      if (config.logToConsole && !options.fileOnly) {
        console.warn(consoleMessage);
      }
      
      if (!options.consoleOnly) {
        writeToLogFile(fileMessage);
      }
    }
  },
  
  /**
   * Log info message
   * @param {string} message - Info message
   * @param {LogOptions} [options={}] - Log options
   */
  info: (message, options = {}) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      const { fileMessage, consoleMessage } = formatLogMessage('INFO', message, options);
      
      if (config.logToConsole && !options.fileOnly) {
        console.log(consoleMessage);
      }
      
      if (!options.consoleOnly) {
        writeToLogFile(fileMessage);
      }
    }
  },
  
  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {LogOptions} [options={}] - Log options
   */
  debug: (message, options = {}) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      const { fileMessage, consoleMessage } = formatLogMessage('DEBUG', message, options);
      
      if (config.logToConsole && !options.fileOnly) {
        console.log(consoleMessage);
      }
      
      if (!options.consoleOnly) {
        writeToLogFile(fileMessage);
      }
    }
  },
  
  /**
   * Log trace message
   * @param {string} message - Trace message
   * @param {LogOptions} [options={}] - Log options
   */
  trace: (message, options = {}) => {
    if (currentLogLevel >= LOG_LEVELS.TRACE) {
      const { fileMessage, consoleMessage } = formatLogMessage('TRACE', message, options);
      
      if (config.logToConsole && !options.fileOnly) {
        console.log(consoleMessage);
      }
      
      if (!options.consoleOnly) {
        writeToLogFile(fileMessage);
      }
    }
  },
  
  /**
   * Create a logger instance for a specific module
   * @param {string} moduleName - Name of the module
   * @returns {Object} Logger instance for the module
   */
  createModuleLogger: (moduleName) => {
    return {
      error: (message, metadata = {}) => logger.error(message, { module: moduleName, metadata }),
      warn: (message, metadata = {}) => logger.warn(message, { module: moduleName, metadata }),
      info: (message, metadata = {}) => logger.info(message, { module: moduleName, metadata }),
      debug: (message, metadata = {}) => logger.debug(message, { module: moduleName, metadata }),
      trace: (message, metadata = {}) => logger.trace(message, { module: moduleName, metadata })
    };
  }
};

module.exports = logger; 