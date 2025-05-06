/**
 * Tests for the ServiceRegistry
 */

const ServiceRegistryClass = require('../ServiceRegistry');
const BaseService = require('../BaseService');

// Mock service class
class MockService extends BaseService {
  constructor(name, initFn = jest.fn(), shutdownFn = jest.fn()) {
    super(name);
    this._initializeMock = initFn;
    this._shutdownMock = shutdownFn;
  }

  async _initialize() {
    return this._initializeMock();
  }

  async _shutdown() {
    return this._shutdownMock();
  }
}

describe('ServiceRegistry', () => {
  let registry;

  beforeEach(() => {
    jest.resetModules();
    registry = new ServiceRegistryClass();
  });

  test('should register a service', () => {
    const service = new MockService('Test');
    registry.register('test', service);
    
    expect(registry.services.has('test')).toBe(true);
    expect(registry.services.get('test')).toBe(service);
  });

  test('should throw when registering a duplicate service', () => {
    const service1 = new MockService('Test1');
    const service2 = new MockService('Test2');
    
    registry.register('test', service1);
    
    expect(() => {
      registry.register('test', service2);
    }).toThrow('Service test is already registered');
  });

  test('should get a registered service', () => {
    const service = new MockService('Test');
    registry.register('test', service);
    
    expect(registry.get('test')).toBe(service);
  });

  test('should throw when getting an unregistered service', () => {
    expect(() => {
      registry.get('nonexistent');
    }).toThrow('Service nonexistent not found');
  });

  test('should get all services', () => {
    const service1 = new MockService('Test1');
    const service2 = new MockService('Test2');
    
    registry.register('test1', service1);
    registry.register('test2', service2);
    
    const allServices = registry.getAll();
    
    expect(allServices).toEqual({
      test1: service1,
      test2: service2
    });
  });

  test('should initialize all services in the correct order', async () => {
    // Create mock services with tracking for initialization order
    const initOrder = [];
    
    const mockInit1 = jest.fn(() => {
      initOrder.push('config');
    });
    
    const mockInit2 = jest.fn(() => {
      initOrder.push('resource');
    });
    
    const mockInit3 = jest.fn(() => {
      initOrder.push('notification');
    });
    
    const service1 = new MockService('Config', mockInit1);
    const service2 = new MockService('Resource', mockInit2);
    const service3 = new MockService('Notification', mockInit3);
    
    // Register services
    registry.register('config', service1);
    registry.register('resource', service2);
    registry.register('notification', service3);
    
    // Initialize
    await registry.initialize();
    
    // Check that all services were initialized
    expect(mockInit1).toHaveBeenCalled();
    expect(mockInit2).toHaveBeenCalled();
    expect(mockInit3).toHaveBeenCalled();
    
    // Check initialization order
    expect(initOrder).toEqual(['config', 'resource', 'notification']);
    
    // Check initialized flag
    expect(registry.initialized).toBe(true);
  });

  test('should skip already initialized services', async () => {
    const mockInit = jest.fn();
    const service = new MockService('Test', mockInit);
    
    registry.register('test', service);
    
    // Initialize once
    await registry.initialize();
    expect(mockInit).toHaveBeenCalledTimes(1);
    
    // Initialize again
    await registry.initialize();
    // Should not call initialize again
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  test('should shutdown services in reverse order', async () => {
    // Create mock services with tracking for shutdown order
    const shutdownOrder = [];
    
    const mockShutdown1 = jest.fn(() => {
      shutdownOrder.push('config');
    });
    
    const mockShutdown2 = jest.fn(() => {
      shutdownOrder.push('resource');
    });
    
    const mockShutdown3 = jest.fn(() => {
      shutdownOrder.push('notification');
    });
    
    const service1 = new MockService('Config', jest.fn(), mockShutdown1);
    const service2 = new MockService('Resource', jest.fn(), mockShutdown2);
    const service3 = new MockService('Notification', jest.fn(), mockShutdown3);
    
    // Register services
    registry.register('config', service1);
    registry.register('resource', service2);
    registry.register('notification', service3);
    
    // Initialize
    await registry.initialize();
    
    // Shutdown
    await registry.shutdown();
    
    // Check that all services were shut down
    expect(mockShutdown1).toHaveBeenCalled();
    expect(mockShutdown2).toHaveBeenCalled();
    expect(mockShutdown3).toHaveBeenCalled();
    
    // Check shutdown order (reverse of initialization order)
    expect(shutdownOrder).toEqual(['notification', 'resource', 'config']);
    
    // Check initialized flag
    expect(registry.initialized).toBe(false);
  });

  test('should handle initialization errors', async () => {
    const mockInit = jest.fn(() => {
      throw new Error('Initialization error');
    });
    
    const service = new MockService('Test', mockInit);
    
    registry.register('test', service);
    
    // Initialize should throw
    await expect(registry.initialize()).rejects.toThrow('Initialization error');
    
    // Should not be marked as initialized
    expect(registry.initialized).toBe(false);
  });

  test('should handle shutdown errors', async () => {
    const mockShutdown = jest.fn(() => {
      throw new Error('Shutdown error');
    });
    
    const service = new MockService('Test', jest.fn(), mockShutdown);
    
    registry.register('test', service);
    
    // Initialize
    await registry.initialize();
    
    // Shutdown should not throw despite service throwing
    await expect(registry.shutdown()).resolves.not.toThrow();
    
    // Should be marked as not initialized
    expect(registry.initialized).toBe(false);
  });
}); 