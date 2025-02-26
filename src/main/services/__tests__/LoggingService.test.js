/**
 * Tests for LoggingService
 */
const assert = require('assert');
const LoggingService = require('../LoggingService')();
const LogManager = require('../../utils/LogManager');

// Store handlers for testing
const handlers = {};

// Mock the IPC registry
const mockIpcRegistry = {
  register: jest.fn().mockImplementation((channel, handler) => {
    console.log(`Registering handler for ${channel}`);
    handlers[channel] = handler;
    return mockIpcRegistry;
  }),
  unregister: jest.fn()
};

// Mock the service registry
const mockServiceRegistry = {
  get: jest.fn().mockImplementation((name) => {
    if (name === 'ipc') return mockIpcRegistry;
    return null;
  })
};

describe('LoggingService', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('should initialize and register IPC handlers', async () => {
      // Clear handlers before this test
      Object.keys(handlers).forEach(key => delete handlers[key]);
      
      await LoggingService.initialize(mockServiceRegistry);
      
      // Verify IPC registry was retrieved
      expect(mockServiceRegistry.get).toHaveBeenCalledWith('ipc');
      
      // Verify IPC handlers were registered
      expect(mockIpcRegistry.register).toHaveBeenCalledTimes(5);
      expect(mockIpcRegistry.register).toHaveBeenCalledWith(
        'logging:getLogFiles',
        expect.any(Function)
      );
      expect(mockIpcRegistry.register).toHaveBeenCalledWith(
        'logging:getLogContent',
        expect.any(Function)
      );
      expect(mockIpcRegistry.register).toHaveBeenCalledWith(
        'logging:setLogLevel',
        expect.any(Function)
      );
      expect(mockIpcRegistry.register).toHaveBeenCalledWith(
        'logging:getLogLevel',
        expect.any(Function)
      );
      expect(mockIpcRegistry.register).toHaveBeenCalledWith(
        'logging:getLogConfig',
        expect.any(Function)
      );
      
      // Debug: print registered handlers
      console.log('Registered handlers:', Object.keys(handlers));
    });
  });
  
  describe('shutdown', () => {
    it('should unregister IPC handlers', async () => {
      // Initialize first
      await LoggingService.initialize(mockServiceRegistry);
      
      // Then shutdown
      await LoggingService.shutdown();
      
      // Verify IPC handlers were unregistered
      expect(mockIpcRegistry.unregister).toHaveBeenCalledTimes(5);
      expect(mockIpcRegistry.unregister).toHaveBeenCalledWith('logging:getLogFiles');
      expect(mockIpcRegistry.unregister).toHaveBeenCalledWith('logging:getLogContent');
      expect(mockIpcRegistry.unregister).toHaveBeenCalledWith('logging:setLogLevel');
      expect(mockIpcRegistry.unregister).toHaveBeenCalledWith('logging:getLogLevel');
      expect(mockIpcRegistry.unregister).toHaveBeenCalledWith('logging:getLogConfig');
    });
  });
  
  describe('IPC handlers', () => {
    // Initialize once for all tests in this describe block
    beforeAll(async () => {
      // Clear handlers before initialization
      Object.keys(handlers).forEach(key => delete handlers[key]);
      
      // Initialize service
      await LoggingService.initialize(mockServiceRegistry);
      console.log('Handlers after initialization in beforeAll:', Object.keys(handlers));
    });
    
    it('should handle getLogFiles request', async () => {
      // Mock LogManager.getLogFiles
      const mockFiles = [{ name: 'test.log', size: 1024 }];
      jest.spyOn(LogManager, 'getLogFiles').mockReturnValue(mockFiles);
      
      // Get the handler function
      const handler = handlers['logging:getLogFiles'];
      console.log('getLogFiles handler:', handler ? 'defined' : 'undefined');
      expect(handler).toBeDefined();
      
      // Call the handler
      const result = await handler();
      
      // Verify result
      assert.deepStrictEqual(result, mockFiles);
      expect(LogManager.getLogFiles).toHaveBeenCalled();
    });
    
    it('should handle getLogContent request', async () => {
      // Mock LogManager.getLogFileContent
      const mockContent = 'test log content';
      jest.spyOn(LogManager, 'getLogFileContent').mockReturnValue(mockContent);
      
      // Get the handler function
      const handler = handlers['logging:getLogContent'];
      console.log('getLogContent handler:', handler ? 'defined' : 'undefined');
      expect(handler).toBeDefined();
      
      // Call the handler
      const result = await handler({}, 'test.log');
      
      // Verify result
      assert.strictEqual(result, mockContent);
      expect(LogManager.getLogFileContent).toHaveBeenCalledWith('test.log');
    });
    
    it('should handle setLogLevel request', async () => {
      // Mock LogManager.setLogLevel
      jest.spyOn(LogManager, 'setLogLevel').mockImplementation(() => {});
      
      // Get the handler function
      const handler = handlers['logging:setLogLevel'];
      console.log('setLogLevel handler:', handler ? 'defined' : 'undefined');
      expect(handler).toBeDefined();
      
      // Call the handler
      const result = await handler({}, 'DEBUG');
      
      // Verify result
      assert.deepStrictEqual(result, { success: true, level: 'DEBUG' });
      expect(LogManager.setLogLevel).toHaveBeenCalledWith('DEBUG');
    });
    
    it('should handle getLogLevel request', async () => {
      // Mock LogManager.getLogLevel
      jest.spyOn(LogManager, 'getLogLevel').mockReturnValue('INFO');
      
      // Get the handler function
      const handler = handlers['logging:getLogLevel'];
      console.log('getLogLevel handler:', handler ? 'defined' : 'undefined');
      expect(handler).toBeDefined();
      
      // Call the handler
      const result = await handler();
      
      // Verify result
      assert.deepStrictEqual(result, { level: 'INFO' });
      expect(LogManager.getLogLevel).toHaveBeenCalled();
    });
    
    it('should handle getLogConfig request', async () => {
      // Mock LogManager.getConfig
      const mockConfig = { logLevel: 'INFO', maxLogFiles: 10 };
      jest.spyOn(LogManager, 'getConfig').mockReturnValue(mockConfig);
      
      // Get the handler function
      const handler = handlers['logging:getLogConfig'];
      console.log('getLogConfig handler:', handler ? 'defined' : 'undefined');
      expect(handler).toBeDefined();
      
      // Call the handler
      const result = await handler();
      
      // Verify result
      assert.deepStrictEqual(result, mockConfig);
      expect(LogManager.getConfig).toHaveBeenCalled();
    });
    
    // Clean up after all tests in this describe block
    afterAll(async () => {
      await LoggingService.shutdown();
    });
  });
  
  describe('service methods', () => {
    it('should provide access to LogManager methods', () => {
      // Mock LogManager methods
      jest.spyOn(LogManager, 'getLogFiles').mockReturnValue([]);
      jest.spyOn(LogManager, 'getLogFileContent').mockReturnValue('content');
      jest.spyOn(LogManager, 'setLogLevel').mockImplementation(() => {});
      jest.spyOn(LogManager, 'getLogLevel').mockReturnValue('INFO');
      jest.spyOn(LogManager, 'getConfig').mockReturnValue({});
      
      // Call service methods
      LoggingService.getLogFiles();
      LoggingService.getLogFileContent('test.log');
      LoggingService.setLogLevel('DEBUG');
      LoggingService.getLogLevel();
      LoggingService.getLogConfig();
      
      // Verify LogManager methods were called
      expect(LogManager.getLogFiles).toHaveBeenCalled();
      expect(LogManager.getLogFileContent).toHaveBeenCalledWith('test.log');
      expect(LogManager.setLogLevel).toHaveBeenCalledWith('DEBUG');
      expect(LogManager.getLogLevel).toHaveBeenCalled();
      expect(LogManager.getConfig).toHaveBeenCalled();
    });
  });
}); 