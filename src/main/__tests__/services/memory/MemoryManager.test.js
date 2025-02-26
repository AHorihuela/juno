/**
 * Tests for the MemoryManager module
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const MemoryManager = require('../../../main/services/memory/MemoryManager');
const MemoryTierManager = require('../../../main/services/memory/MemoryTierManager');
const MemoryPersistence = require('../../../main/services/memory/MemoryPersistence');
const MemoryScoring = require('../../../main/services/memory/MemoryScoring');
const MemoryStats = require('../../../main/services/memory/MemoryStats');
const AIUsageTracker = require('../../../main/services/memory/AIUsageTracker');
const { MemoryError } = require('../../../main/services/memory/MemoryErrors');

// Mock dependencies
jest.mock('uuid');
jest.mock('fs');
jest.mock('path');
jest.mock('../../../main/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

// Mock the sub-modules
jest.mock('../../../main/services/memory/MemoryTierManager');
jest.mock('../../../main/services/memory/MemoryPersistence');
jest.mock('../../../main/services/memory/MemoryScoring');
jest.mock('../../../main/services/memory/MemoryStats');
jest.mock('../../../main/services/memory/AIUsageTracker');

describe('MemoryManager', () => {
  let memoryManager;
  let mockConfigService;
  let mockContextService;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock UUID generation
    uuidv4.mockImplementation(() => 'mock-uuid-123');
    
    // Create mock services
    mockConfigService = {
      getAppDataPath: jest.fn().mockReturnValue('/mock/app/data/path')
    };
    
    mockContextService = {
      deleteMemoryItem: jest.fn().mockResolvedValue(true),
      clearMemory: jest.fn().mockResolvedValue(true)
    };
    
    // Reset mock implementations for sub-modules
    MemoryTierManager.mockImplementation(() => ({
      initialize: jest.fn(),
      addToMemory: jest.fn().mockReturnValue({ id: 'mock-item-1', content: { text: 'Test' } }),
      findMemoryItemById: jest.fn().mockReturnValue({ id: 'mock-item-1', content: { text: 'Test' } }),
      accessMemoryItem: jest.fn().mockReturnValue({ id: 'mock-item-1', content: { text: 'Test' } }),
      deleteMemoryItem: jest.fn().mockReturnValue(true),
      getAllMemoryItems: jest.fn().mockReturnValue([{ id: 'mock-item-1' }, { id: 'mock-item-2' }]),
      getMemoryTier: jest.fn().mockReturnValue([{ id: 'mock-item-1' }]),
      promoteMemoryItem: jest.fn().mockReturnValue({ id: 'mock-item-1' }),
      demoteMemoryItem: jest.fn().mockReturnValue({ id: 'mock-item-1' }),
      clearMemoryTier: jest.fn(),
      clearAllMemory: jest.fn(),
      setMemoryTiers: jest.fn()
    }));
    
    MemoryPersistence.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      loadLongTermMemory: jest.fn().mockResolvedValue([{ id: 'mock-item-1' }]),
      saveLongTermMemory: jest.fn().mockResolvedValue(true)
    }));
    
    MemoryScoring.mockImplementation(() => ({
      calculateRelevanceToCommand: jest.fn().mockReturnValue(0.85)
    }));
    
    MemoryStats.mockImplementation(() => ({
      initialize: jest.fn(),
      getStats: jest.fn().mockReturnValue({ itemCount: { total: 10 } })
    }));
    
    AIUsageTracker.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      trackUsage: jest.fn().mockResolvedValue(true),
      getStats: jest.fn().mockReturnValue({ totalTokens: 1000 })
    }));
    
    // Create a new instance for each test
    memoryManager = MemoryManager();
  });
  
  describe('initialization', () => {
    it('should initialize successfully with valid services', async () => {
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      expect(memoryManager.initialized).toBe(true);
      expect(memoryManager.configService).toBe(mockConfigService);
      expect(memoryManager.contextService).toBe(mockContextService);
      
      // Verify sub-modules were initialized
      expect(memoryManager.persistence.initialize).toHaveBeenCalled();
      expect(memoryManager.stats.initialize).toHaveBeenCalled();
      expect(memoryManager.aiUsageTracker.initialize).toHaveBeenCalled();
      expect(memoryManager.tierManager.initialize).toHaveBeenCalled();
      expect(memoryManager.tierManager.setMemoryTiers).toHaveBeenCalled();
    });
    
    it('should throw an error if config service is missing', async () => {
      await expect(memoryManager.initialize({
        context: mockContextService
      })).rejects.toThrow(MemoryError);
    });
    
    it('should throw an error if context service is missing', async () => {
      await expect(memoryManager.initialize({
        config: mockConfigService
      })).rejects.toThrow(MemoryError);
    });
    
    it('should not re-initialize if already initialized', async () => {
      // Initialize once
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      // Reset mocks to check if they're called again
      jest.clearAllMocks();
      
      // Initialize again
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
      
      // Verify sub-modules were not initialized again
      expect(memoryManager.persistence.initialize).not.toHaveBeenCalled();
      expect(memoryManager.stats.initialize).not.toHaveBeenCalled();
      expect(memoryManager.aiUsageTracker.initialize).not.toHaveBeenCalled();
      expect(memoryManager.tierManager.initialize).not.toHaveBeenCalled();
    });
  });
  
  describe('memory operations', () => {
    beforeEach(async () => {
      // Initialize the memory manager before each test
      await memoryManager.initialize({
        config: mockConfigService,
        context: mockContextService
      });
    });
    
    describe('addMemoryItem', () => {
      it('should add a memory item', async () => {
        const content = { text: 'Test memory item' };
        const metadata = { usefulness: 8 };
        
        const result = await memoryManager.addMemoryItem(content, metadata);
        
        expect(result).toEqual({ id: 'mock-item-1', content: { text: 'Test' } });
        expect(memoryManager.tierManager.addToMemory).toHaveBeenCalledWith(content, metadata);
      });
      
      it('should throw an error if not initialized', async () => {
        // Create a new instance without initializing
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.addMemoryItem({ text: 'Test' }))
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('getMemoryItemById', () => {
      it('should get a memory item by ID', async () => {
        const result = await memoryManager.getMemoryItemById('mock-item-1');
        
        expect(result).toEqual({ id: 'mock-item-1', content: { text: 'Test' } });
        expect(memoryManager.tierManager.findMemoryItemById).toHaveBeenCalledWith('mock-item-1');
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.getMemoryItemById('mock-item-1'))
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('accessMemoryItem', () => {
      it('should access a memory item', async () => {
        const result = await memoryManager.accessMemoryItem('mock-item-1');
        
        expect(result).toEqual({ id: 'mock-item-1', content: { text: 'Test' } });
        expect(memoryManager.tierManager.accessMemoryItem).toHaveBeenCalledWith('mock-item-1');
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.accessMemoryItem('mock-item-1'))
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('deleteMemoryItem', () => {
      it('should delete a memory item', async () => {
        const result = await memoryManager.deleteMemoryItem('mock-item-1');
        
        expect(result).toBe(true);
        expect(memoryManager.tierManager.deleteMemoryItem).toHaveBeenCalledWith('mock-item-1');
        expect(mockContextService.deleteMemoryItem).toHaveBeenCalledWith('mock-item-1');
      });
      
      it('should not call context service if item not found', async () => {
        // Mock deleteMemoryItem to return false (item not found)
        memoryManager.tierManager.deleteMemoryItem.mockReturnValueOnce(false);
        
        const result = await memoryManager.deleteMemoryItem('non-existent');
        
        expect(result).toBe(false);
        expect(mockContextService.deleteMemoryItem).not.toHaveBeenCalled();
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.deleteMemoryItem('mock-item-1'))
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('getAllMemoryItems', () => {
      it('should get all memory items', async () => {
        const result = await memoryManager.getAllMemoryItems();
        
        expect(result).toEqual([{ id: 'mock-item-1' }, { id: 'mock-item-2' }]);
        expect(memoryManager.tierManager.getAllMemoryItems).toHaveBeenCalled();
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.getAllMemoryItems())
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('getMemoryByTier', () => {
      it('should get memory items by tier', async () => {
        const result = await memoryManager.getMemoryByTier('working');
        
        expect(result).toEqual([{ id: 'mock-item-1' }]);
        expect(memoryManager.tierManager.getMemoryTier).toHaveBeenCalledWith('working');
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.getMemoryByTier('working'))
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('findRelevantMemories', () => {
      it('should find memories relevant to a command', async () => {
        const command = 'test command';
        
        const result = await memoryManager.findRelevantMemories(command, 2);
        
        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('relevance');
        expect(memoryManager.tierManager.getAllMemoryItems).toHaveBeenCalled();
        expect(memoryManager.scoring.calculateRelevanceToCommand).toHaveBeenCalledTimes(2);
      });
      
      it('should return empty array if no memory items', async () => {
        // Mock getAllMemoryItems to return empty array
        memoryManager.tierManager.getAllMemoryItems.mockReturnValueOnce([]);
        
        const result = await memoryManager.findRelevantMemories('test command');
        
        expect(result).toEqual([]);
        expect(memoryManager.scoring.calculateRelevanceToCommand).not.toHaveBeenCalled();
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.findRelevantMemories('test command'))
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('promoteMemoryItem', () => {
      it('should promote a memory item', async () => {
        const result = await memoryManager.promoteMemoryItem('mock-item-1');
        
        expect(result).toEqual({ id: 'mock-item-1' });
        expect(memoryManager.tierManager.promoteMemoryItem).toHaveBeenCalledWith('mock-item-1');
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.promoteMemoryItem('mock-item-1'))
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('demoteMemoryItem', () => {
      it('should demote a memory item', async () => {
        const result = await memoryManager.demoteMemoryItem('mock-item-1');
        
        expect(result).toEqual({ id: 'mock-item-1' });
        expect(memoryManager.tierManager.demoteMemoryItem).toHaveBeenCalledWith('mock-item-1');
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.demoteMemoryItem('mock-item-1'))
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('clearMemoryTier', () => {
      it('should clear a memory tier', async () => {
        await memoryManager.clearMemoryTier('working');
        
        expect(memoryManager.tierManager.clearMemoryTier).toHaveBeenCalledWith('working');
        expect(mockContextService.clearMemory).toHaveBeenCalledWith('working');
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.clearMemoryTier('working'))
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('clearAllMemory', () => {
      it('should clear all memory', async () => {
        await memoryManager.clearAllMemory();
        
        expect(memoryManager.tierManager.clearAllMemory).toHaveBeenCalled();
        expect(mockContextService.clearMemory).toHaveBeenCalledWith('all');
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.clearAllMemory())
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('saveMemory', () => {
      it('should save memory to disk', async () => {
        const result = await memoryManager.saveMemory();
        
        expect(result).toBe(true);
        expect(memoryManager.tierManager.getMemoryTier).toHaveBeenCalledWith('longTerm');
        expect(memoryManager.persistence.saveLongTermMemory).toHaveBeenCalledWith([{ id: 'mock-item-1' }]);
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.saveMemory())
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('getMemoryStats', () => {
      it('should get memory statistics', async () => {
        const result = await memoryManager.getMemoryStats();
        
        expect(result).toEqual({ itemCount: { total: 10 } });
        expect(memoryManager.stats.getStats).toHaveBeenCalled();
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.getMemoryStats())
          .rejects.toThrow(MemoryError);
      });
    });
    
    describe('trackAIUsage', () => {
      it('should track AI usage', async () => {
        const usageData = {
          promptTokens: 100,
          completionTokens: 200,
          model: 'gpt-4'
        };
        
        await memoryManager.trackAIUsage(usageData);
        
        expect(memoryManager.aiUsageTracker.trackUsage).toHaveBeenCalledWith(usageData);
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.trackAIUsage({
          promptTokens: 100,
          completionTokens: 200,
          model: 'gpt-4'
        })).rejects.toThrow(MemoryError);
      });
    });
    
    describe('getAIUsageStats', () => {
      it('should get AI usage statistics', async () => {
        const result = await memoryManager.getAIUsageStats();
        
        expect(result).toEqual({ totalTokens: 1000 });
        expect(memoryManager.aiUsageTracker.getStats).toHaveBeenCalled();
      });
      
      it('should throw an error if not initialized', async () => {
        const uninitializedManager = MemoryManager();
        
        await expect(uninitializedManager.getAIUsageStats())
          .rejects.toThrow(MemoryError);
      });
    });
  });
}); 