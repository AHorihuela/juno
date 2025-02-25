const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Define log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Default log level
let currentLogLevel = LOG_LEVELS.INFO;

// Get user data path for logs
const getUserDataPath = () => {
  return app ? app.getPath('userData') : path.join(process.cwd(), 'userData');
};

// Create logs directory if it doesn't exist
const ensureLogDirectory = () => {
  const logDir = path.join(getUserDataPath(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
};

// Get log file path
const getLogFilePath = () => {
  const logDir = ensureLogDirectory();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logDir, `juno-${date}.log`);
};

// Format log message
const formatLogMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaString}\n`;
};

// Write to log file
const writeToLogFile = (message) => {
  try {
    const logFilePath = getLogFilePath();
    fs.appendFileSync(logFilePath, message);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
};

// Log methods
const logger = {
  setLogLevel: (level) => {
    if (LOG_LEVELS[level] !== undefined) {
      currentLogLevel = LOG_LEVELS[level];
    }
  },

  error: (message, meta = {}) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      const formattedMessage = formatLogMessage('ERROR', message, meta);
      console.error(formattedMessage.trim());
      writeToLogFile(formattedMessage);
    }
  },

  warn: (message, meta = {}) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      const formattedMessage = formatLogMessage('WARN', message, meta);
      console.warn(formattedMessage.trim());
      writeToLogFile(formattedMessage);
    }
  },

  info: (message, meta = {}) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      const formattedMessage = formatLogMessage('INFO', message, meta);
      console.log(formattedMessage.trim());
      writeToLogFile(formattedMessage);
    }
  },

  debug: (message, meta = {}) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      const formattedMessage = formatLogMessage('DEBUG', message, meta);
      console.log(formattedMessage.trim());
      writeToLogFile(formattedMessage);
    }
  }
};

module.exports = logger; 