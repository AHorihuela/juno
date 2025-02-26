/**
 * Tests for the MemoryManager module
 */

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue('[]'),
    mkdir: jest.fn().mockResolvedValue(),
    access: jest.fn().mockResolvedValue(),
    stat: jest.fn().mockResolvedValue({ isFile: () => true }),
    copyFile: jest.fn().mockResolvedValue()
  }
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

// Mock logger
jest.mock('../../../../main/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const memoryManagerFactory = require('../../../../main/services/memory/MemoryManager');
const MemoryTierManager = require('../../../../main/services/memory/MemoryTierManager');
const MemoryPersistence = require('../../../../main/services/memory/MemoryPersistence');
const MemoryScoring = require('../../../../main/services/memory/MemoryScoring');
const MemoryStats = require('../../../../main/services/memory/MemoryStats');
const AIUsageTracker = require('../../../../main/services/memory/AIUsageTracker');
const { MemoryError } = require('../../../../main/services/memory/MemoryErrors');

// Mock the component modules
jest.mock('../../../../main/services/memory/MemoryTierManager');
jest.mock('../../../../main/services/memory/MemoryPersistence');
jest.mock('../../../../main/services/memory/MemoryScoring');
jest.mock('../../../../main/services/memory/MemoryStats');
jest.mock('../../../../main/services/memory/AIUsageTracker');

describe('MemoryManager', () => {
  let memoryManager;
  let mockConfigService;
  let mockContextService;
  
  // Mock implementations for the component modules
  const mockTierManager = {
    initialize: jest.fn(),
    addToMemory: jest.fn().mockImplementation((content, metadata) => ({
      id: 'mock-uuid',
      content,
      metadata: { ...metadata, tier: 'working' },
      relevanceScore: 0.75
    })),
    findMemoryItemById: jest.fn(),
    accessMemoryItem: jest.fn(),
    deleteMemoryItem: jest.fn().mockReturnValue(true),
    getAllMemoryItems: jest.fn().mockReturnValue([]),
    getMemoryTier: jest.fn(),
    promoteMemoryItem: jest.fn(),
    demoteMemoryItem: jest.fn(),
    clearMemoryTier: jest.fn(),
    clearAllMemory: jest.fn(),
    setMemoryTiers: jest.fn()
  };
  
  const mockPersistence = {
    initialize: jest.fn(),
    loadLongTermMemory: jest.fn().mockResolvedValue([]),
    saveLongTermMemory: jest.fn().mockResolvedValue(true)
  };
  
  const mockScoring = {
    initialize: jest.fn(),
    calculateInitialScore: jest.fn().mockReturnValue(0.75),
    calculateScore: jest.fn().mockReturnValue(0.5),
    calculateRelevanceToCommand: jest.fn().mockReturnValue(0.6)
  };
  
  const mockStats = {
    initialize: jest.fn(),
    trackItemAdded: jest.fn(),
    trackItemAccessed: jest.fn(),
    trackItemDeleted: jest.fn(),
    trackItemPromoted: jest.fn(),
    trackItemDemoted: jest.fn(),
    trackItemExpired: jest.fn(),
    calculateAverageScore: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      totalItems: 0,
      itemsByTier: { working: 0, shortTerm: 0, longTerm: 0 },
      operations: { additions: 0, accesses: 0, deletions: 0 }
    })
  };
  
  const mockAIUsageTracker = {
    initialize: jest.fn(),
    trackUsage: jest.fn(),
    getStats: jest.fn().mockReturnValue({
      totalTokens: 0,
      sessionTokens: 0,
      dailyUsage: {},
      modelUsage: {}
    })
  };
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up mock implementations
    MemoryTierManager.mockImplementation(() => mockTierManager);
    MemoryPersistence.mockImplementation(() => mockPersistence);
    MemoryScoring.mockImplementation(() => mockScoring);
    MemoryStats.mockImplementation(() => mockStats);
    AIUsageTracker.mockImplementation(() => mockAIUsageTracker);
    
    // Create mock services
    mockConfigService = {
      getAppDataPath: jest.fn().mockReturnValue('/mock/app/data')
    };
    
    mockContextService = {
      resolveMemoryStats: jest.fn(),
      deleteMemoryItem: jest.fn(),
      clearMemory: jest.fn()
    };
    
    // Create a new instance for each test
    memoryManager = memoryManagerFactory();
  });
  
  describe('initialization', () => {
    it('should initialize successfully with valid services', async () => {
      const services = {
        config: mockConfigService,
        context: mockContextService
      };
      
      await memoryManager.initialize(services);
      
      expect(memoryManager.initialized).toBe(true);
      expect(memoryManager.configService).toBe(mockConfigService);
      expect(memoryManager.contextService).toBe(mockContextService);
      
      // Check that all components were initialized
      expect(mockTierManager.initialize).toHaveBeenCalled();
      expect(mockPersistence.initialize).toHaveBeenCalled();
      expect(mockScoring.initialize).toHaveBeenCalled();
      expect(mockStats.initialize).toHaveBeenCalled();
      expect(mockAIUsageTracker.initialize).toHaveBeenCalled();
      
      // Check that long-term memory was loaded
      expect(mockPersistence.loadLongTermMemory).toHaveBeenCalled();
    });
    
    it('should throw error if config service is missing', async () => {
      const services = {
        context: mockContextService
      };
      
      await expect(memoryManager.initialize(services))
        .rejects.toThrow(MemoryError);
      
      expect(memoryManager.initialized).toBe(false);
    });
    
    it('should throw error if context service is missing', async () => {
      const services = {
        config: mockConfigService
      };
      
      await expect(memoryManager.initialize(services))
        .rejects.toThrow(MemoryError);
      
      expect(memoryManager.initialized).toBe(false);
    });
    
    it('should not initialize twice', async () => {
      const services = {
        config: mockConfigService,
        context: mockContextService
      };
      
      // First initialization
      await memoryManager.initialize(services);
      
      // Reset mocks to check if they're called again
      mockTierManager.initialize.mockClear();
      mockPersistence.initialize.mockClear();
      
      // Second initialization
      await memoryManager.initialize(services);
      
      // Should not call these methods again
      expect(mockTierManager.initialize).not.toHaveBeenCalled();
      expect(mockPersistence.initialize).not.toHaveBeenCalled();
    });
  });
  
  describe('addMemoryItem', () => {
    it('should add memory item successfully', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const content = { text: 'Test memory item' };
      const metadata = { source: 'user', usefulness: 0.8 };
      
      const result = await memoryManager.addMemoryItem(content, metadata);
      
      // Check that the item was added
      expect(result).toEqual({
        id: 'mock-uuid',
        content: { text: 'Test memory item' },
        metadata: { source: 'user', usefulness: 0.8, tier: 'working' },
        relevanceScore: 0.75
      });
      
      // Check that the tier manager was called
      expect(mockTierManager.addToMemory).toHaveBeenCalledWith(content, metadata);
    });
    
    it('should throw error if not initialized', async () => {
      const content = { text: 'Test memory item' };
      
      await expect(memoryManager.addMemoryItem(content))
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('getMemoryItemById', () => {
    it('should retrieve memory item by ID', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const mockItem = {
        id: 'test-id',
        content: { text: 'Test content' },
        metadata: { tier: 'working' }
      };
      
      mockTierManager.findMemoryItemById.mockReturnValueOnce(mockItem);
      
      const result = await memoryManager.getMemoryItemById('test-id');
      
      // Check that the item was retrieved
      expect(result).toBe(mockItem);
      
      // Check that the tier manager was called
      expect(mockTierManager.findMemoryItemById).toHaveBeenCalledWith('test-id');
    });
    
    it('should return null if item not found', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      mockTierManager.findMemoryItemById.mockReturnValueOnce(null);
      
      const result = await memoryManager.getMemoryItemById('nonexistent');
      
      // Check that null was returned
      expect(result).toBeNull();
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.getMemoryItemById('test-id'))
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('accessMemoryItem', () => {
    it('should access memory item and update metadata', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const mockItem = {
        id: 'test-id',
        content: { text: 'Test content' },
        metadata: { tier: 'working', accessCount: 1 }
      };
      
      mockTierManager.accessMemoryItem.mockReturnValueOnce(mockItem);
      
      const result = await memoryManager.accessMemoryItem('test-id');
      
      // Check that the item was accessed
      expect(result).toBe(mockItem);
      
      // Check that the tier manager was called
      expect(mockTierManager.accessMemoryItem).toHaveBeenCalledWith('test-id');
    });
    
    it('should return null if item not found', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      mockTierManager.accessMemoryItem.mockReturnValueOnce(null);
      
      const result = await memoryManager.accessMemoryItem('nonexistent');
      
      // Check that null was returned
      expect(result).toBeNull();
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.accessMemoryItem('test-id'))
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('deleteMemoryItem', () => {
    it('should delete memory item successfully', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      mockTierManager.deleteMemoryItem.mockReturnValueOnce(true);
      
      const result = await memoryManager.deleteMemoryItem('test-id');
      
      // Check that the item was deleted
      expect(result).toBe(true);
      
      // Check that the tier manager was called
      expect(mockTierManager.deleteMemoryItem).toHaveBeenCalledWith('test-id');
      
      // Check that the context service was called
      expect(mockContextService.deleteMemoryItem).toHaveBeenCalledWith('test-id');
    });
    
    it('should return false if item not found', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      mockTierManager.deleteMemoryItem.mockReturnValueOnce(false);
      
      const result = await memoryManager.deleteMemoryItem('nonexistent');
      
      // Check that false was returned
      expect(result).toBe(false);
      
      // Check that the context service was not called
      expect(mockContextService.deleteMemoryItem).not.toHaveBeenCalled();
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.deleteMemoryItem('test-id'))
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('getAllMemoryItems', () => {
    it('should retrieve all memory items', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const mockItems = [
        { id: 'item1', content: { text: 'Item 1' } },
        { id: 'item2', content: { text: 'Item 2' } }
      ];
      
      mockTierManager.getAllMemoryItems.mockReturnValueOnce(mockItems);
      
      const result = await memoryManager.getAllMemoryItems();
      
      // Check that the items were retrieved
      expect(result).toBe(mockItems);
      
      // Check that the tier manager was called
      expect(mockTierManager.getAllMemoryItems).toHaveBeenCalled();
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.getAllMemoryItems())
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('getMemoryByTier', () => {
    it('should retrieve memory items by tier', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const mockItems = [
        { id: 'item1', content: { text: 'Item 1' } },
        { id: 'item2', content: { text: 'Item 2' } }
      ];
      
      mockTierManager.getMemoryTier.mockReturnValueOnce(mockItems);
      
      const result = await memoryManager.getMemoryByTier('working');
      
      // Check that the items were retrieved
      expect(result).toBe(mockItems);
      
      // Check that the tier manager was called
      expect(mockTierManager.getMemoryTier).toHaveBeenCalledWith('working');
    });
    
    it('should throw error for invalid tier', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      mockTierManager.getMemoryTier.mockImplementationOnce(() => {
        throw new Error('Invalid tier');
      });
      
      await expect(memoryManager.getMemoryByTier('invalidTier'))
        .rejects.toThrow();
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.getMemoryByTier('working'))
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('findRelevantMemories', () => {
    it('should find relevant memories based on command', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const mockItems = [
        { 
          id: 'item1', 
          content: { text: 'Item 1' }, 
          relevanceScore: 0.8 
        },
        { 
          id: 'item2', 
          content: { text: 'Item 2' }, 
          relevanceScore: 0.3 
        },
        { 
          id: 'item3', 
          content: { text: 'Item 3' }, 
          relevanceScore: 0.6 
        }
      ];
      
      mockTierManager.getAllMemoryItems.mockReturnValueOnce(mockItems);
      
      // Mock the scoring function to return different values for each item
      mockScoring.calculateRelevanceToCommand
        .mockReturnValueOnce(0.8)  // item1
        .mockReturnValueOnce(0.3)  // item2
        .mockReturnValueOnce(0.6); // item3
      
      const result = await memoryManager.findRelevantMemories('test command', 2);
      
      // Check that the most relevant items were returned (sorted by relevance)
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('item1'); // Highest relevance
      expect(result[1].id).toBe('item3'); // Second highest
      
      // Check that the scoring function was called for each item
      expect(mockScoring.calculateRelevanceToCommand).toHaveBeenCalledTimes(3);
    });
    
    it('should return empty array if no memories exist', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      mockTierManager.getAllMemoryItems.mockReturnValueOnce([]);
      
      const result = await memoryManager.findRelevantMemories('test command', 5);
      
      // Check that an empty array was returned
      expect(result).toEqual([]);
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.findRelevantMemories('test command', 5))
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('promoteMemoryItem', () => {
    it('should promote memory item successfully', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const mockItem = {
        id: 'test-id',
        content: { text: 'Test content' },
        metadata: { tier: 'shortTerm' }
      };
      
      mockTierManager.promoteMemoryItem.mockReturnValueOnce(mockItem);
      
      const result = await memoryManager.promoteMemoryItem('test-id');
      
      // Check that the item was promoted
      expect(result).toBe(mockItem);
      
      // Check that the tier manager was called
      expect(mockTierManager.promoteMemoryItem).toHaveBeenCalledWith('test-id');
    });
    
    it('should return null if item not found', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      mockTierManager.promoteMemoryItem.mockReturnValueOnce(null);
      
      const result = await memoryManager.promoteMemoryItem('nonexistent');
      
      // Check that null was returned
      expect(result).toBeNull();
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.promoteMemoryItem('test-id'))
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('demoteMemoryItem', () => {
    it('should demote memory item successfully', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const mockItem = {
        id: 'test-id',
        content: { text: 'Test content' },
        metadata: { tier: 'working' }
      };
      
      mockTierManager.demoteMemoryItem.mockReturnValueOnce(mockItem);
      
      const result = await memoryManager.demoteMemoryItem('test-id');
      
      // Check that the item was demoted
      expect(result).toBe(mockItem);
      
      // Check that the tier manager was called
      expect(mockTierManager.demoteMemoryItem).toHaveBeenCalledWith('test-id');
    });
    
    it('should return null if item not found', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      mockTierManager.demoteMemoryItem.mockReturnValueOnce(null);
      
      const result = await memoryManager.demoteMemoryItem('nonexistent');
      
      // Check that null was returned
      expect(result).toBeNull();
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.demoteMemoryItem('test-id'))
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('clearMemoryTier', () => {
    it('should clear memory tier successfully', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      await memoryManager.clearMemoryTier('working');
      
      // Check that the tier manager was called
      expect(mockTierManager.clearMemoryTier).toHaveBeenCalledWith('working');
      
      // Check that the context service was called
      expect(mockContextService.clearMemory).toHaveBeenCalledWith('working');
    });
    
    it('should throw error for invalid tier', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      mockTierManager.clearMemoryTier.mockImplementationOnce(() => {
        throw new Error('Invalid tier');
      });
      
      await expect(memoryManager.clearMemoryTier('invalidTier'))
        .rejects.toThrow();
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.clearMemoryTier('working'))
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('clearAllMemory', () => {
    it('should clear all memory successfully', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      await memoryManager.clearAllMemory();
      
      // Check that the tier manager was called
      expect(mockTierManager.clearAllMemory).toHaveBeenCalled();
      
      // Check that the context service was called
      expect(mockContextService.clearMemory).toHaveBeenCalledWith('all');
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.clearAllMemory())
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('saveMemory', () => {
    it('should save memory successfully', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const mockLongTermItems = [
        { id: 'item1', content: { text: 'Item 1' } },
        { id: 'item2', content: { text: 'Item 2' } }
      ];
      
      mockTierManager.getMemoryTier.mockReturnValueOnce(mockLongTermItems);
      
      const result = await memoryManager.saveMemory();
      
      // Check that the result is true
      expect(result).toBe(true);
      
      // Check that the persistence module was called
      expect(mockPersistence.saveLongTermMemory).toHaveBeenCalledWith(mockLongTermItems);
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.saveMemory())
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('getMemoryStats', () => {
    it('should return memory statistics', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const mockStats = {
        totalItems: 10,
        itemsByTier: {
          working: 3,
          shortTerm: 4,
          longTerm: 3
        },
        operations: {
          additions: 15,
          accesses: 25,
          deletions: 5
        }
      };
      
      mockStats.getStats.mockReturnValueOnce(mockStats);
      
      const result = await memoryManager.getMemoryStats();
      
      // Check that the stats were returned
      expect(result).toBe(mockStats);
      
      // Check that the stats module was called
      expect(mockStats.getStats).toHaveBeenCalled();
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.getMemoryStats())
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('getAIUsageStats', () => {
    it('should return AI usage statistics', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const mockUsageStats = {
        totalTokens: 1000,
        sessionTokens: 250,
        dailyUsage: {
          '2023-01-01': 500,
          '2023-01-02': 500
        },
        modelUsage: {
          'gpt-4': 700,
          'gpt-3.5-turbo': 300
        }
      };
      
      mockAIUsageTracker.getStats.mockReturnValueOnce(mockUsageStats);
      
      const result = await memoryManager.getAIUsageStats();
      
      // Check that the stats were returned
      expect(result).toBe(mockUsageStats);
      
      // Check that the AI usage tracker was called
      expect(mockAIUsageTracker.getStats).toHaveBeenCalled();
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryManager.getAIUsageStats())
        .rejects.toThrow(MemoryError);
    });
  });
  
  describe('trackAIUsage', () => {
    it('should track AI usage successfully', async () => {
      // Initialize
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      const usageData = {
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4'
      };
      
      await memoryManager.trackAIUsage(usageData);
      
      // Check that the AI usage tracker was called
      expect(mockAIUsageTracker.trackUsage).toHaveBeenCalledWith(usageData);
    });
    
    it('should throw error if not initialized', async () => {
      const usageData = {
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4'
      };
      
      await expect(memoryManager.trackAIUsage(usageData))
        .rejects.toThrow(MemoryError);
    });
  });
}); 