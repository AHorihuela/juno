/**
 * Tests for LoggingService
 */
const assert = require('assert');
const LoggingService = require('../LoggingService')();
const LogManager = require('../../utils/LogManager');

// Mock the IPC registry
const mockIpcRegistry = {
  registerHandler: jest.fn(),
  removeHandler: jest.fn()
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
      await LoggingService.initialize(mockServiceRegistry);
      
      // Verify IPC registry was retrieved
      expect(mockServiceRegistry.get).toHaveBeenCalledWith('ipc');
      
      // Verify IPC handlers were registered
      expect(mockIpcRegistry.registerHandler).toHaveBeenCalledTimes(5);
      expect(mockIpcRegistry.registerHandler).toHaveBeenCalledWith(
        'logging:getLogFiles',
        expect.any(Function)
      );
      expect(mockIpcRegistry.registerHandler).toHaveBeenCalledWith(
        'logging:getLogContent',
        expect.any(Function)
      );
      expect(mockIpcRegistry.registerHandler).toHaveBeenCalledWith(
        'logging:setLogLevel',
        expect.any(Function)
      );
      expect(mockIpcRegistry.registerHandler).toHaveBeenCalledWith(
        'logging:getLogLevel',
        expect.any(Function)
      );
      expect(mockIpcRegistry.registerHandler).toHaveBeenCalledWith(
        'logging:getLogConfig',
        expect.any(Function)
      );
    });
  });
  
  describe('shutdown', () => {
    it('should unregister IPC handlers', async () => {
      // Initialize first
      await LoggingService.initialize(mockServiceRegistry);
      
      // Then shutdown
      await LoggingService.shutdown();
      
      // Verify IPC handlers were unregistered
      expect(mockIpcRegistry.removeHandler).toHaveBeenCalledTimes(5);
      expect(mockIpcRegistry.removeHandler).toHaveBeenCalledWith('logging:getLogFiles');
      expect(mockIpcRegistry.removeHandler).toHaveBeenCalledWith('logging:getLogContent');
      expect(mockIpcRegistry.removeHandler).toHaveBeenCalledWith('logging:setLogLevel');
      expect(mockIpcRegistry.removeHandler).toHaveBeenCalledWith('logging:getLogLevel');
      expect(mockIpcRegistry.removeHandler).toHaveBeenCalledWith('logging:getLogConfig');
    });
  });
  
  describe('IPC handlers', () => {
    beforeEach(async () => {
      // Initialize service before each test
      await LoggingService.initialize(mockServiceRegistry);
    });
    
    it('should handle getLogFiles request', async () => {
      // Mock LogManager.getLogFiles
      const mockFiles = [{ name: 'test.log', size: 1024 }];
      jest.spyOn(LogManager, 'getLogFiles').mockReturnValue(mockFiles);
      
      // Get the handler function
      const handler = mockIpcRegistry.registerHandler.mock.calls.find(
        call => call[0] === 'logging:getLogFiles'
      )[1];
      
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
      const handler = mockIpcRegistry.registerHandler.mock.calls.find(
        call => call[0] === 'logging:getLogContent'
      )[1];
      
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
      const handler = mockIpcRegistry.registerHandler.mock.calls.find(
        call => call[0] === 'logging:setLogLevel'
      )[1];
      
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
      const handler = mockIpcRegistry.registerHandler.mock.calls.find(
        call => call[0] === 'logging:getLogLevel'
      )[1];
      
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
      const handler = mockIpcRegistry.registerHandler.mock.calls.find(
        call => call[0] === 'logging:getLogConfig'
      )[1];
      
      // Call the handler
      const result = await handler();
      
      // Verify result
      assert.deepStrictEqual(result, mockConfig);
      expect(LogManager.getConfig).toHaveBeenCalled();
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