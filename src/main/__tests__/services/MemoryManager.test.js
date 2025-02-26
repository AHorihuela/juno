/**
 * Tests for the MemoryManager service
 */

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue('{"items":[],"savedAt":1234567890,"version":1}'),
    mkdir: jest.fn().mockResolvedValue()
  },
  existsSync: jest.fn().mockReturnValue(true)
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/mock/user/data')
  }
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

// Mock logger
jest.mock('../../../main/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

// Import the module under test
const MemoryManagerFactory = require('../../../main/services/MemoryManager');

describe('MemoryManager Service', () => {
  let memoryManager;
  const fs = require('fs').promises;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset timers
    jest.useFakeTimers();
    
    // Create a new instance for each test
    memoryManager = MemoryManagerFactory();
    
    // Mock services
    memoryManager.services = {
      get: jest.fn().mockImplementation((serviceName) => {
        if (serviceName === 'configService') {
          return {
            getUserDataPath: jest.fn().mockReturnValue('/mock/user/data')
          };
        }
        return null;
      })
    };
    
    // Mock context service
    memoryManager.contextService = {
      getMemoryStats: jest.fn().mockResolvedValue({
        items: [
          { id: 'item1', size: 1024 },
          { id: 'item2', size: 2048 }
        ]
      }),
      deleteMemoryItem: jest.fn().mockResolvedValue(true),
      clearMemory: jest.fn().mockResolvedValue(true)
    };
  });
  
  afterEach(() => {
    // Restore timers
    jest.useRealTimers();
    
    // Clear intervals
    if (memoryManager.memoryManagementInterval) {
      clearInterval(memoryManager.memoryManagementInterval);
    }
    if (memoryManager.statsInterval) {
      clearInterval(memoryManager.statsInterval);
    }
  });
  
  describe('Initialization', () => {
    it('should initialize with correct default values', () => {
      expect(memoryManager.workingMemory).toEqual([]);
      expect(memoryManager.shortTermMemory).toEqual([]);
      expect(memoryManager.longTermMemory).toEqual([]);
      expect(memoryManager.initialized).toBe(false);
    });
    
    it('should initialize successfully', async () => {
      await memoryManager.initialize();
      
      expect(memoryManager.initialized).toBe(true);
      expect(memoryManager.storagePath).toBe('/mock/user/data/context-memory.json');
      expect(fs.readFile).toHaveBeenCalledWith('/mock/user/data/context-memory.json', 'utf8');
    });
    
    it('should handle initialization errors', async () => {
      fs.readFile.mockRejectedValueOnce(new Error('Test error'));
      
      await memoryManager.initialize();
      
      expect(memoryManager.initialized).toBe(true); // Still marks as initialized despite error
    });
    
    it('should not initialize twice', async () => {
      memoryManager.initialized = true;
      
      await memoryManager.initialize();
      
      expect(fs.readFile).not.toHaveBeenCalled();
    });
  });
  
  describe('Memory Management', () => {
    it('should add an item to working memory', () => {
      const item = { content: 'Test content' };
      const result = memoryManager.addItem(item);
      
      expect(memoryManager.workingMemory.length).toBe(1);
      expect(memoryManager.workingMemory[0].content).toBe('Test content');
      expect(result.id).toBeDefined();
      expect(result.addedAt).toBeDefined();
      expect(result.tier).toBe('working');
    });
    
    it('should not add an item without content', () => {
      const item = { title: 'Test title' };
      const result = memoryManager.addItem(item);
      
      expect(memoryManager.workingMemory.length).toBe(0);
      expect(result).toBeUndefined();
    });
    
    it('should trim working memory when it exceeds the limit', () => {
      // Fill working memory beyond the limit
      for (let i = 0; i < memoryManager.workingMemoryLimit + 5; i++) {
        memoryManager.addItem({ content: `Item ${i}` });
      }
      
      expect(memoryManager.workingMemory.length).toBe(memoryManager.workingMemoryLimit);
    });
    
    it('should calculate item score correctly', () => {
      const item = {
        content: 'Test content with keywords',
        addedAt: Date.now(),
        accessCount: 3,
        usefulnessScore: 5
      };
      
      const score = memoryManager.calculateItemScore(item);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      
      // Test with command relevance
      const scoreWithCommand = memoryManager.calculateItemScore(item, 'keywords test');
      expect(scoreWithCommand).toBeGreaterThan(score); // Should be higher due to keyword match
    });
    
    it('should manage memory tiers', async () => {
      // Add items to working memory
      const item1 = memoryManager.addItem({ content: 'Item 1' });
      const item2 = memoryManager.addItem({ content: 'Item 2' });
      
      // Make item1 old (beyond TTL)
      item1.addedAt = Date.now() - (memoryManager.workingMemoryTTL + 1000);
      
      // Give item1 a high score
      item1.accessCount = 5;
      item1.usefulnessScore = 9;
      
      // Run memory management
      await memoryManager.manageMemory();
      
      // Item1 should be moved to short-term memory
      expect(memoryManager.workingMemory.length).toBe(1);
      expect(memoryManager.shortTermMemory.length).toBe(1);
      expect(memoryManager.shortTermMemory[0].id).toBe(item1.id);
      expect(memoryManager.shortTermMemory[0].tier).toBe('short-term');
    });
    
    it('should record item usage', () => {
      const item = memoryManager.addItem({ content: 'Test content' });
      
      memoryManager.recordItemUsage(item.id, 8);
      
      expect(memoryManager.workingMemory[0].accessCount).toBe(1);
      expect(memoryManager.workingMemory[0].usefulnessScore).toBe(8);
    });
    
    it('should get context for a command', () => {
      // Add items with varying relevance
      const item1 = memoryManager.addItem({ content: 'Test content about weather' });
      const item2 = memoryManager.addItem({ content: 'Test content about programming' });
      const item3 = memoryManager.addItem({ content: 'Test content about weather forecast' });
      
      // Make items have different scores
      item1.accessCount = 3;
      item3.accessCount = 5;
      
      const context = memoryManager.getContextForCommand('weather forecast');
      
      expect(context.primaryContext).toBeDefined();
      expect(context.primaryContext.content).toContain('weather');
      expect(context.secondaryContext).toBeDefined();
    });
  });
  
  describe('Persistence', () => {
    it('should save long-term memory to disk', async () => {
      memoryManager.storagePath = '/mock/user/data/context-memory.json';
      memoryManager.longTermMemory = [{ id: 'item1', content: 'Test content' }];
      
      await memoryManager.saveLongTermMemory();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/mock/user/data/context-memory.json',
        expect.any(String)
      );
    });
    
    it('should load long-term memory from disk', async () => {
      memoryManager.storagePath = '/mock/user/data/context-memory.json';
      fs.readFile.mockResolvedValueOnce(JSON.stringify({
        items: [{ id: 'item1', content: 'Test content' }],
        savedAt: Date.now(),
        version: 1
      }));
      
      await memoryManager.loadLongTermMemory();
      
      expect(memoryManager.longTermMemory.length).toBe(1);
      expect(memoryManager.longTermMemory[0].id).toBe('item1');
    });
    
    it('should handle file not found when loading', async () => {
      memoryManager.storagePath = '/mock/user/data/context-memory.json';
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValueOnce(error);
      
      await memoryManager.loadLongTermMemory();
      
      expect(memoryManager.longTermMemory.length).toBe(0);
    });
  });
  
  describe('Memory Operations', () => {
    it('should delete an item from memory', () => {
      const item = memoryManager.addItem({ content: 'Test content' });
      
      const result = memoryManager.deleteItem(item.id);
      
      expect(result).toBe(true);
      expect(memoryManager.workingMemory.length).toBe(0);
    });
    
    it('should clear memory', () => {
      memoryManager.addItem({ content: 'Working memory item' });
      memoryManager.shortTermMemory.push({ id: 'short1', content: 'Short-term memory item' });
      memoryManager.longTermMemory.push({ id: 'long1', content: 'Long-term memory item' });
      
      memoryManager.clearMemory();
      
      expect(memoryManager.workingMemory.length).toBe(0);
      expect(memoryManager.shortTermMemory.length).toBe(0);
      expect(memoryManager.longTermMemory.length).toBe(0);
    });
    
    it('should clear specific memory tier', () => {
      memoryManager.addItem({ content: 'Working memory item' });
      memoryManager.shortTermMemory.push({ id: 'short1', content: 'Short-term memory item' });
      memoryManager.longTermMemory.push({ id: 'long1', content: 'Long-term memory item' });
      
      memoryManager.clearMemory('working');
      
      expect(memoryManager.workingMemory.length).toBe(0);
      expect(memoryManager.shortTermMemory.length).toBe(1);
      expect(memoryManager.longTermMemory.length).toBe(1);
    });
  });
  
  describe('Statistics', () => {
    it('should update memory statistics', async () => {
      await memoryManager.updateMemoryStats();
      
      expect(memoryManager.memoryStats.totalItems).toBe(2);
      expect(memoryManager.memoryStats.totalSizeBytes).toBe(3072);
      expect(memoryManager.memoryStats.status).toBe('Good');
    });
    
    it('should track AI usage', () => {
      memoryManager.trackAIUsage({
        promptTokens: 100,
        completionTokens: 50
      });
      
      expect(memoryManager.aiStats.totalTokens).toBe(150);
      expect(memoryManager.aiStats.promptTokens).toBe(100);
      expect(memoryManager.aiStats.completionTokens).toBe(50);
      expect(memoryManager.aiStats.totalRequests).toBe(1);
    });
    
    it('should get memory statistics', () => {
      memoryManager.memoryStats = {
        totalItems: 10,
        totalSizeBytes: 10240,
        status: 'Good'
      };
      
      const stats = memoryManager.getStats();
      
      expect(stats.totalItems).toBe(10);
      expect(stats.totalSizeBytes).toBe(10240);
      expect(stats.status).toBe('Good');
    });
    
    it('should get AI statistics', () => {
      memoryManager.aiStats = {
        totalTokens: 1000,
        promptTokens: 700,
        completionTokens: 300,
        totalRequests: 10
      };
      
      const stats = memoryManager.getAIStats();
      
      expect(stats.totalTokens).toBe(1000);
      expect(stats.promptTokens).toBe(700);
      expect(stats.completionTokens).toBe(300);
      expect(stats.totalRequests).toBe(10);
    });
  });
  
  describe('Shutdown', () => {
    it('should clean up resources on shutdown', async () => {
      // Initialize first
      await memoryManager.initialize();
      
      // Mock intervals
      memoryManager.memoryManagementInterval = setInterval(() => {}, 1000);
      memoryManager.statsInterval = setInterval(() => {}, 1000);
      
      // Shutdown
      memoryManager.shutdown();
      
      expect(memoryManager.initialized).toBe(false);
    });
  });
}); 