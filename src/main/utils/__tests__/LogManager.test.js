/**
 * Tests for LogManager
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const LogManager = require('../../utils/LogManager');
const logger = require('../../utils/logger');

// Mock the app object
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/mock/userData'),
    getName: jest.fn().mockReturnValue('Juno'),
    getVersion: jest.fn().mockReturnValue('1.0.0')
  }
}));

// Mock fs functions
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    appendFileSync: jest.fn(),
    readdirSync: jest.fn().mockReturnValue(['juno-2023-01-01.log', 'juno-2023-01-02.log']),
    statSync: jest.fn().mockReturnValue({
      size: 1024,
      birthtime: new Date('2023-01-01'),
      mtime: new Date('2023-01-02')
    }),
    readFileSync: jest.fn().mockReturnValue('mock log content')
  };
});

describe('LogManager', () => {
  // Save original console methods
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  beforeEach(() => {
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Reset LogManager
    LogManager.initialized = false;
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });
  
  describe('initialize', () => {
    it('should initialize with default configuration', () => {
      LogManager.initialize();
      
      assert(LogManager.initialized);
      assert.strictEqual(LogManager.environment, 'development');
      
      // Verify logger was configured
      const config = LogManager.getConfig();
      assert.strictEqual(config.logLevel, 'DEBUG');
      assert(config.prettyPrint);
    });
    
    it('should initialize with custom configuration', () => {
      LogManager.initialize({
        logLevel: 'ERROR',
        prettyPrint: false
      });
      
      const config = LogManager.getConfig();
      assert.strictEqual(config.logLevel, 'ERROR');
      assert.strictEqual(config.prettyPrint, false);
    });
    
    it('should not reinitialize if already initialized', () => {
      LogManager.initialize();
      const spy = jest.spyOn(logger, 'configure');
      
      LogManager.initialize();
      
      assert.strictEqual(spy.mock.calls.length, 0);
    });
  });
  
  describe('getLogger', () => {
    it('should create and return a module logger', () => {
      const moduleLogger = LogManager.getLogger('TestModule');
      
      assert(moduleLogger);
      assert(typeof moduleLogger.error === 'function');
      assert(typeof moduleLogger.warn === 'function');
      assert(typeof moduleLogger.info === 'function');
      assert(typeof moduleLogger.debug === 'function');
      assert(typeof moduleLogger.trace === 'function');
    });
    
    it('should return the same logger for the same module', () => {
      const logger1 = LogManager.getLogger('TestModule');
      const logger2 = LogManager.getLogger('TestModule');
      
      assert.strictEqual(logger1, logger2);
    });
    
    it('should initialize LogManager if not already initialized', () => {
      LogManager.initialized = false;
      const spy = jest.spyOn(LogManager, 'initialize');
      
      LogManager.getLogger('TestModule');
      
      assert.strictEqual(spy.mock.calls.length, 1);
    });
  });
  
  describe('setLogLevel', () => {
    it('should set the log level', () => {
      LogManager.initialize();
      LogManager.setLogLevel('ERROR');
      
      assert.strictEqual(LogManager.getLogLevel(), 'ERROR');
    });
  });
  
  describe('updateConfig', () => {
    it('should update the logger configuration', () => {
      LogManager.initialize();
      
      LogManager.updateConfig({
        logLevel: 'WARN',
        maxLogFiles: 20
      });
      
      const config = LogManager.getConfig();
      assert.strictEqual(config.logLevel, 'WARN');
      assert.strictEqual(config.maxLogFiles, 20);
    });
  });
  
  describe('getLogFiles', () => {
    it('should return a list of log files', () => {
      const files = LogManager.getLogFiles();
      
      assert(Array.isArray(files));
      assert.strictEqual(files.length, 2);
      assert.strictEqual(files[0].name, 'juno-2023-01-01.log');
      assert.strictEqual(files[1].name, 'juno-2023-01-02.log');
    });
    
    it('should handle errors when getting log files', () => {
      fs.readdirSync.mockImplementationOnce(() => {
        throw new Error('Mock error');
      });
      
      const files = LogManager.getLogFiles();
      
      assert(Array.isArray(files));
      assert.strictEqual(files.length, 0);
    });
  });
  
  describe('getLogFileContent', () => {
    it('should return the content of a log file', () => {
      const content = LogManager.getLogFileContent('juno-2023-01-01.log');
      
      assert.strictEqual(content, 'mock log content');
    });
    
    it('should return null if the file does not exist', () => {
      fs.existsSync.mockReturnValueOnce(false);
      
      const content = LogManager.getLogFileContent('non-existent.log');
      
      assert.strictEqual(content, null);
    });
    
    it('should handle errors when reading log files', () => {
      fs.readFileSync.mockImplementationOnce(() => {
        throw new Error('Mock error');
      });
      
      const content = LogManager.getLogFileContent('juno-2023-01-01.log');
      
      assert.strictEqual(content, null);
    });
  });
}); 