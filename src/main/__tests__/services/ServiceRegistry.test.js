/**
 * Tests for the ServiceRegistry
 */

// Mock services
const mockWindowManager = {
  name: 'windowManager',
  initialize: jest.fn().mockResolvedValue(),
  shutdown: jest.fn().mockResolvedValue()
};

const mockMemoryManager = {
  name: 'memory',
  initialize: jest.fn().mockResolvedValue(),
  shutdown: jest.fn().mockResolvedValue()
};

// Mock service constructors
jest.mock('../../../main/services/WindowManager', () => jest.fn(() => mockWindowManager));
jest.mock('../../../main/services/MemoryManager', () => jest.fn(() => mockMemoryManager));

// Import the module under test
const ServiceRegistry = require('../../../main/services/ServiceRegistry');

describe('ServiceRegistry', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset the registry
    ServiceRegistry._reset();
  });
  
  describe('Registration', () => {
    it('registers a service', () => {
      ServiceRegistry.register('windowManager', mockWindowManager);
      
      expect(ServiceRegistry.get('windowManager')).toBe(mockWindowManager);
    });
    
    it('throws an error when registering a duplicate service', () => {
      ServiceRegistry.register('windowManager', mockWindowManager);
      
      expect(() => {
        ServiceRegistry.register('windowManager', mockWindowManager);
      }).toThrow('Service windowManager is already registered');
    });
    
    it('registers multiple services', () => {
      ServiceRegistry.register('windowManager', mockWindowManager);
      ServiceRegistry.register('memory', mockMemoryManager);
      
      expect(ServiceRegistry.get('windowManager')).toBe(mockWindowManager);
      expect(ServiceRegistry.get('memory')).toBe(mockMemoryManager);
    });
  });
  
  describe('Retrieval', () => {
    it('gets a registered service', () => {
      ServiceRegistry.register('windowManager', mockWindowManager);
      
      const service = ServiceRegistry.get('windowManager');
      
      expect(service).toBe(mockWindowManager);
    });
    
    it('returns null for an unregistered service', () => {
      const service = ServiceRegistry.get('nonExistentService');
      
      expect(service).toBeNull();
    });
    
    it('gets all registered services', () => {
      ServiceRegistry.register('windowManager', mockWindowManager);
      ServiceRegistry.register('memory', mockMemoryManager);
      
      const services = ServiceRegistry.getAll();
      
      expect(services).toHaveLength(2);
      expect(services).toContain(mockWindowManager);
      expect(services).toContain(mockMemoryManager);
    });
  });
  
  describe('Initialization', () => {
    it('initializes all services', async () => {
      ServiceRegistry.register('windowManager', mockWindowManager);
      ServiceRegistry.register('memory', mockMemoryManager);
      
      await ServiceRegistry.initializeAll();
      
      expect(mockWindowManager.initialize).toHaveBeenCalled();
      expect(mockMemoryManager.initialize).toHaveBeenCalled();
    });
    
    it('initializes services in the correct order', async () => {
      // Add initialization order tracking
      const initOrder = [];
      mockWindowManager.initialize.mockImplementation(() => {
        initOrder.push('windowManager');
        return Promise.resolve();
      });
      
      mockMemoryManager.initialize.mockImplementation(() => {
        initOrder.push('memory');
        return Promise.resolve();
      });
      
      // Register services in reverse order
      ServiceRegistry.register('memory', mockMemoryManager);
      ServiceRegistry.register('windowManager', mockWindowManager);
      
      // Set initialization order
      ServiceRegistry.setInitializationOrder(['windowManager', 'memory']);
      
      await ServiceRegistry.initializeAll();
      
      // Check that services were initialized in the correct order
      expect(initOrder).toEqual(['windowManager', 'memory']);
    });
    
    it('handles initialization errors', async () => {
      mockWindowManager.initialize.mockRejectedValueOnce(new Error('Initialization error'));
      
      ServiceRegistry.register('windowManager', mockWindowManager);
      
      await expect(ServiceRegistry.initializeAll()).rejects.toThrow('Initialization error');
    });
  });
  
  describe('Shutdown', () => {
    it('shuts down all services', async () => {
      ServiceRegistry.register('windowManager', mockWindowManager);
      ServiceRegistry.register('memory', mockMemoryManager);
      
      await ServiceRegistry.shutdownAll();
      
      expect(mockWindowManager.shutdown).toHaveBeenCalled();
      expect(mockMemoryManager.shutdown).toHaveBeenCalled();
    });
    
    it('shuts down services in reverse initialization order', async () => {
      // Add shutdown order tracking
      const shutdownOrder = [];
      mockWindowManager.shutdown.mockImplementation(() => {
        shutdownOrder.push('windowManager');
        return Promise.resolve();
      });
      
      mockMemoryManager.shutdown.mockImplementation(() => {
        shutdownOrder.push('memory');
        return Promise.resolve();
      });
      
      // Register services
      ServiceRegistry.register('windowManager', mockWindowManager);
      ServiceRegistry.register('memory', mockMemoryManager);
      
      // Set initialization order
      ServiceRegistry.setInitializationOrder(['windowManager', 'memory']);
      
      await ServiceRegistry.shutdownAll();
      
      // Check that services were shut down in reverse order
      expect(shutdownOrder).toEqual(['memory', 'windowManager']);
    });
    
    it('continues shutdown even if a service fails', async () => {
      mockWindowManager.shutdown.mockRejectedValueOnce(new Error('Shutdown error'));
      
      ServiceRegistry.register('windowManager', mockWindowManager);
      ServiceRegistry.register('memory', mockMemoryManager);
      
      await ServiceRegistry.shutdownAll();
      
      // Both services should have shutdown called
      expect(mockWindowManager.shutdown).toHaveBeenCalled();
      expect(mockMemoryManager.shutdown).toHaveBeenCalled();
    });
  });
  
  describe('Service Dependencies', () => {
    it('injects service dependencies', () => {
      // Create a service with dependencies
      const serviceWithDeps = {
        name: 'serviceWithDeps',
        dependencies: ['windowManager', 'memory'],
        initialize: jest.fn().mockResolvedValue(),
        shutdown: jest.fn().mockResolvedValue()
      };
      
      // Register dependencies first
      ServiceRegistry.register('windowManager', mockWindowManager);
      ServiceRegistry.register('memory', mockMemoryManager);
      
      // Register the service with dependencies
      ServiceRegistry.register('serviceWithDeps', serviceWithDeps);
      
      // Initialize all services
      ServiceRegistry.initializeAll();
      
      // Check that dependencies were injected
      expect(serviceWithDeps.windowManager).toBe(mockWindowManager);
      expect(serviceWithDeps.memory).toBe(mockMemoryManager);
    });
    
    it('throws an error for missing dependencies', () => {
      // Create a service with a missing dependency
      const serviceWithMissingDep = {
        name: 'serviceWithMissingDep',
        dependencies: ['nonExistentService'],
        initialize: jest.fn().mockResolvedValue(),
        shutdown: jest.fn().mockResolvedValue()
      };
      
      // Register the service
      ServiceRegistry.register('serviceWithMissingDep', serviceWithMissingDep);
      
      // Try to initialize all services
      expect(() => {
        ServiceRegistry.initializeAll();
      }).toThrow('Service serviceWithMissingDep depends on nonExistentService, which is not registered');
    });
  });
  
  describe('Service Factory', () => {
    it('creates a service using a factory function', () => {
      // Register a service factory
      ServiceRegistry.registerFactory('dynamicService', () => ({
        name: 'dynamicService',
        initialize: jest.fn().mockResolvedValue(),
        shutdown: jest.fn().mockResolvedValue(),
        dynamicProperty: 'dynamic value'
      }));
      
      // Get the service
      const service = ServiceRegistry.get('dynamicService');
      
      // Check that the service was created correctly
      expect(service).toBeDefined();
      expect(service.name).toBe('dynamicService');
      expect(service.dynamicProperty).toBe('dynamic value');
    });
    
    it('creates a service with dependencies using a factory function', () => {
      // Register dependencies
      ServiceRegistry.register('windowManager', mockWindowManager);
      
      // Register a service factory with dependencies
      ServiceRegistry.registerFactory('dynamicService', (deps) => ({
        name: 'dynamicService',
        initialize: jest.fn().mockResolvedValue(),
        shutdown: jest.fn().mockResolvedValue(),
        windowManager: deps.windowManager
      }), ['windowManager']);
      
      // Get the service
      const service = ServiceRegistry.get('dynamicService');
      
      // Check that the service was created with dependencies
      expect(service).toBeDefined();
      expect(service.windowManager).toBe(mockWindowManager);
    });
  });
}); 