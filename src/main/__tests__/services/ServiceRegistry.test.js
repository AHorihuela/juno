/**
 * Tests for the ServiceRegistry
 */

// Mock LogManager
jest.mock('../../../main/utils/LogManager', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock services
const mockWindowManager = {
  name: 'windowManager',
  initialize: jest.fn().mockResolvedValue(),
  shutdown: jest.fn().mockResolvedValue()
};

const mockConfigService = {
  name: 'config',
  initialize: jest.fn().mockResolvedValue(),
  shutdown: jest.fn().mockResolvedValue()
};

// Mock service constructors
jest.mock('../../../main/services/WindowManager', () => jest.fn(() => mockWindowManager));

// Import the module under test
const ServiceRegistry = require('../../../main/services/ServiceRegistry');

describe('ServiceRegistry', () => {
  let registry;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a new instance for each test
    registry = new ServiceRegistry();
  });
  
  test('should register a service', () => {
    const service = { name: 'testService' };
    registry.register('testService', service);
    
    expect(registry.get('testService')).toBe(service);
  });
  
  test('should throw an error when registering a duplicate service', () => {
    const service = { name: 'testService' };
    registry.register('testService', service);
    
    expect(() => {
      registry.register('testService', service);
    }).toThrow('Service testService is already registered');
  });
  
  test('should get all registered services', () => {
    const service1 = { name: 'service1' };
    const service2 = { name: 'service2' };
    
    registry.register('service1', service1);
    registry.register('service2', service2);
    
    const services = registry.getAll();
    
    expect(services).toHaveProperty('service1', service1);
    expect(services).toHaveProperty('service2', service2);
  });
  
  test('should throw an error when trying to get a non-existent service', () => {
    expect(() => {
      registry.get('nonExistentService');
    }).toThrow('Service nonExistentService not found');
  });
  
  test('should initialize services in the correct order', async () => {
    const initOrder = [];
    
    const mockService1 = {
      name: 'config',
      initialize: jest.fn().mockImplementation(() => {
        initOrder.push('config');
        return Promise.resolve();
      }),
      shutdown: jest.fn()
    };
    
    const mockService2 = {
      name: 'windowManager',
      initialize: jest.fn().mockImplementation(() => {
        initOrder.push('windowManager');
        return Promise.resolve();
      }),
      shutdown: jest.fn()
    };
    
    registry.register('config', mockService1);
    registry.register('windowManager', mockService2);
    
    await registry.initialize();
    
    expect(initOrder).toEqual(['config', 'windowManager']);
    expect(mockService1.initialize).toHaveBeenCalledWith(registry);
    expect(mockService2.initialize).toHaveBeenCalledWith(registry);
  });
  
  test('should handle initialization errors', async () => {
    const mockService = {
      name: 'errorService',
      initialize: jest.fn().mockRejectedValue(new Error('Initialization error')),
      shutdown: jest.fn()
    };
    
    registry.register('errorService', mockService);
    registry.initOrder = ['errorService'];
    
    await expect(registry.initialize()).rejects.toThrow('Failed to initialize service "errorService": Initialization error');
  });
  
  test('should shut down services in reverse order', async () => {
    const shutdownOrder = [];
    
    const mockService1 = {
      name: 'config',
      initialize: jest.fn(),
      shutdown: jest.fn().mockImplementation(() => {
        shutdownOrder.push('config');
        return Promise.resolve();
      })
    };
    
    const mockService2 = {
      name: 'windowManager',
      initialize: jest.fn(),
      shutdown: jest.fn().mockImplementation(() => {
        shutdownOrder.push('windowManager');
        return Promise.resolve();
      })
    };
    
    registry.register('config', mockService1);
    registry.register('windowManager', mockService2);
    registry.initOrder = ['config', 'windowManager'];
    registry.initialized = true;
    
    await registry.shutdown();
    
    expect(shutdownOrder).toEqual(['windowManager', 'config']);
  });
  
  test('should continue shutdown even if a service fails', async () => {
    const mockService1 = {
      name: 'failingService',
      initialize: jest.fn(),
      shutdown: jest.fn().mockRejectedValue(new Error('Shutdown error'))
    };
    
    const mockService2 = {
      name: 'workingService',
      initialize: jest.fn(),
      shutdown: jest.fn().mockResolvedValue()
    };
    
    registry.register('failingService', mockService1);
    registry.register('workingService', mockService2);
    registry.initOrder = ['failingService', 'workingService'];
    registry.initialized = true;
    
    await registry.shutdown();
    
    expect(mockService1.shutdown).toHaveBeenCalled();
    expect(mockService2.shutdown).toHaveBeenCalled();
  });
}); 