/**
 * Tests for the MemoryTierManager module
 */

const { v4: uuidv4 } = require('uuid');
const MemoryTierManager = require('../../../main/services/memory/MemoryTierManager');
const { MemoryTierError } = require('../../../main/services/memory/MemoryErrors');

// Mock dependencies
jest.mock('uuid');
jest.mock('../../../main/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

describe('MemoryTierManager', () => {
  let tierManager;
  let mockMemoryStats;
  let mockMemoryScoring;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock UUID generation
    uuidv4.mockImplementation(() => 'mock-uuid-123');
    
    // Create mock dependencies
    mockMemoryStats = {
      updateItemCount: jest.fn(),
      trackItemAddition: jest.fn(),
      trackItemAccess: jest.fn(),
      trackItemDeletion: jest.fn(),
      trackItemPromotion: jest.fn(),
      trackItemDemotion: jest.fn(),
      trackItemExpiration: jest.fn()
    };
    
    mockMemoryScoring = {
      calculateInitialScore: jest.fn().mockReturnValue(0.75),
      calculateScore: jest.fn().mockReturnValue(0.85)
    };
    
    // Create a new instance for each test
    tierManager = new MemoryTierManager();
  });
  
  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(tierManager.initialized).toBe(false);
      expect(tierManager.workingMemory).toEqual([]);
      expect(tierManager.shortTermMemory).toEqual([]);
      expect(tierManager.longTermMemory).toEqual([]);
      expect(tierManager.memoryStats).toBeNull();
      expect(tierManager.memoryScoring).toBeNull();
    });
    
    it('should initialize with provided dependencies', () => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
      
      expect(tierManager.initialized).toBe(true);
      expect(tierManager.memoryStats).toBe(mockMemoryStats);
      expect(tierManager.memoryScoring).toBe(mockMemoryScoring);
    });
    
    it('should throw an error if memoryStats is missing', () => {
      expect(() => {
        tierManager.initialize({
          memoryScoring: mockMemoryScoring
        });
      }).toThrow(MemoryTierError);
    });
    
    it('should throw an error if memoryScoring is missing', () => {
      expect(() => {
        tierManager.initialize({
          memoryStats: mockMemoryStats
        });
      }).toThrow(MemoryTierError);
    });
  });
  
  describe('addToMemory', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
    });
    
    it('should add an item to working memory with default metadata', () => {
      const content = { text: 'Test memory item' };
      const item = tierManager.addToMemory(content);
      
      expect(item).toEqual({
        id: 'mock-uuid-123',
        content: { text: 'Test memory item' },
        metadata: {
          createdAt: expect.any(Number),
          lastAccessed: expect.any(Number),
          accessCount: 1,
          score: 0.75,
          usefulness: 5
        }
      });
      
      expect(tierManager.workingMemory).toHaveLength(1);
      expect(tierManager.workingMemory[0]).toBe(item);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('working', 1);
      expect(mockMemoryStats.trackItemAddition).toHaveBeenCalledWith('working');
    });
    
    it('should add an item with custom metadata', () => {
      const content = { text: 'Test memory item' };
      const metadata = {
        usefulness: 8,
        customField: 'custom value'
      };
      
      const item = tierManager.addToMemory(content, metadata);
      
      expect(item.metadata.usefulness).toBe(8);
      expect(item.metadata.customField).toBe('custom value');
      expect(item.metadata.accessCount).toBe(1);
    });
    
    it('should throw an error if not initialized', () => {
      // Create a new instance without initializing
      const uninitializedManager = new MemoryTierManager();
      
      expect(() => {
        uninitializedManager.addToMemory({ text: 'Test' });
      }).toThrow(MemoryTierError);
    });
  });
  
  describe('getMemoryTier', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
    });
    
    it('should return the working memory tier', () => {
      tierManager.workingMemory = [{ id: '1' }, { id: '2' }];
      const result = tierManager.getMemoryTier('working');
      expect(result).toEqual([{ id: '1' }, { id: '2' }]);
    });
    
    it('should return the short-term memory tier', () => {
      tierManager.shortTermMemory = [{ id: '3' }, { id: '4' }];
      const result = tierManager.getMemoryTier('shortTerm');
      expect(result).toEqual([{ id: '3' }, { id: '4' }]);
    });
    
    it('should return the long-term memory tier', () => {
      tierManager.longTermMemory = [{ id: '5' }, { id: '6' }];
      const result = tierManager.getMemoryTier('longTerm');
      expect(result).toEqual([{ id: '5' }, { id: '6' }]);
    });
    
    it('should throw an error for an invalid tier', () => {
      expect(() => {
        tierManager.getMemoryTier('invalidTier');
      }).toThrow(MemoryTierError);
    });
    
    it('should throw an error if not initialized', () => {
      const uninitializedManager = new MemoryTierManager();
      expect(() => {
        uninitializedManager.getMemoryTier('working');
      }).toThrow(MemoryTierError);
    });
  });
  
  describe('getAllMemoryItems', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
    });
    
    it('should return all memory items from all tiers', () => {
      tierManager.workingMemory = [{ id: '1' }];
      tierManager.shortTermMemory = [{ id: '2' }];
      tierManager.longTermMemory = [{ id: '3' }];
      
      const result = tierManager.getAllMemoryItems();
      
      expect(result).toHaveLength(3);
      expect(result).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    });
    
    it('should return an empty array if all tiers are empty', () => {
      const result = tierManager.getAllMemoryItems();
      expect(result).toEqual([]);
    });
  });
  
  describe('findMemoryItemById', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
      
      tierManager.workingMemory = [{ id: 'work-1' }, { id: 'work-2' }];
      tierManager.shortTermMemory = [{ id: 'short-1' }, { id: 'short-2' }];
      tierManager.longTermMemory = [{ id: 'long-1' }, { id: 'long-2' }];
    });
    
    it('should find an item in working memory', () => {
      const result = tierManager.findMemoryItemById('work-1');
      expect(result).toEqual({ id: 'work-1' });
    });
    
    it('should find an item in short-term memory', () => {
      const result = tierManager.findMemoryItemById('short-2');
      expect(result).toEqual({ id: 'short-2' });
    });
    
    it('should find an item in long-term memory', () => {
      const result = tierManager.findMemoryItemById('long-1');
      expect(result).toEqual({ id: 'long-1' });
    });
    
    it('should return null if item is not found', () => {
      const result = tierManager.findMemoryItemById('non-existent');
      expect(result).toBeNull();
    });
  });
  
  describe('accessMemoryItem', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
      
      const now = Date.now();
      
      tierManager.workingMemory = [{
        id: 'work-1',
        content: { text: 'Working memory item' },
        metadata: {
          createdAt: now - 1000,
          lastAccessed: now - 1000,
          accessCount: 1,
          score: 0.5
        }
      }];
    });
    
    it('should update access metadata when accessing an item', () => {
      const beforeAccess = Date.now();
      const item = tierManager.accessMemoryItem('work-1');
      const afterAccess = Date.now();
      
      expect(item.metadata.lastAccessed).toBeGreaterThanOrEqual(beforeAccess);
      expect(item.metadata.lastAccessed).toBeLessThanOrEqual(afterAccess);
      expect(item.metadata.accessCount).toBe(2);
      expect(mockMemoryStats.trackItemAccess).toHaveBeenCalledWith('working');
    });
    
    it('should return null if item is not found', () => {
      const result = tierManager.accessMemoryItem('non-existent');
      expect(result).toBeNull();
      expect(mockMemoryStats.trackItemAccess).not.toHaveBeenCalled();
    });
  });
  
  describe('deleteMemoryItem', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
      
      tierManager.workingMemory = [{ id: 'work-1' }, { id: 'work-2' }];
      tierManager.shortTermMemory = [{ id: 'short-1' }];
      tierManager.longTermMemory = [{ id: 'long-1' }];
    });
    
    it('should delete an item from working memory', () => {
      const result = tierManager.deleteMemoryItem('work-1');
      
      expect(result).toBe(true);
      expect(tierManager.workingMemory).toEqual([{ id: 'work-2' }]);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('working', 1);
      expect(mockMemoryStats.trackItemDeletion).toHaveBeenCalledWith('working');
    });
    
    it('should delete an item from short-term memory', () => {
      const result = tierManager.deleteMemoryItem('short-1');
      
      expect(result).toBe(true);
      expect(tierManager.shortTermMemory).toEqual([]);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('shortTerm', 0);
      expect(mockMemoryStats.trackItemDeletion).toHaveBeenCalledWith('shortTerm');
    });
    
    it('should delete an item from long-term memory', () => {
      const result = tierManager.deleteMemoryItem('long-1');
      
      expect(result).toBe(true);
      expect(tierManager.longTermMemory).toEqual([]);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('longTerm', 0);
      expect(mockMemoryStats.trackItemDeletion).toHaveBeenCalledWith('longTerm');
    });
    
    it('should return false if item is not found', () => {
      const result = tierManager.deleteMemoryItem('non-existent');
      
      expect(result).toBe(false);
      expect(mockMemoryStats.updateItemCount).not.toHaveBeenCalled();
      expect(mockMemoryStats.trackItemDeletion).not.toHaveBeenCalled();
    });
  });
  
  describe('promoteMemoryItem', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
      
      tierManager.workingMemory = [{ id: 'work-1', content: { text: 'Working item' } }];
      tierManager.shortTermMemory = [{ id: 'short-1', content: { text: 'Short-term item' } }];
    });
    
    it('should promote an item from working to short-term memory', () => {
      const result = tierManager.promoteMemoryItem('work-1');
      
      expect(result).toEqual({ id: 'work-1', content: { text: 'Working item' } });
      expect(tierManager.workingMemory).toEqual([]);
      expect(tierManager.shortTermMemory).toEqual([
        { id: 'short-1', content: { text: 'Short-term item' } },
        { id: 'work-1', content: { text: 'Working item' } }
      ]);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('working', 0);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('shortTerm', 2);
      expect(mockMemoryStats.trackItemPromotion).toHaveBeenCalledWith('working', 'shortTerm');
    });
    
    it('should promote an item from short-term to long-term memory', () => {
      const result = tierManager.promoteMemoryItem('short-1');
      
      expect(result).toEqual({ id: 'short-1', content: { text: 'Short-term item' } });
      expect(tierManager.shortTermMemory).toEqual([]);
      expect(tierManager.longTermMemory).toEqual([
        { id: 'short-1', content: { text: 'Short-term item' } }
      ]);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('shortTerm', 0);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('longTerm', 1);
      expect(mockMemoryStats.trackItemPromotion).toHaveBeenCalledWith('shortTerm', 'longTerm');
    });
    
    it('should not promote an item from long-term memory', () => {
      tierManager.longTermMemory = [{ id: 'long-1', content: { text: 'Long-term item' } }];
      
      const result = tierManager.promoteMemoryItem('long-1');
      
      expect(result).toEqual({ id: 'long-1', content: { text: 'Long-term item' } });
      expect(tierManager.longTermMemory).toEqual([
        { id: 'long-1', content: { text: 'Long-term item' } }
      ]);
      
      expect(mockMemoryStats.trackItemPromotion).not.toHaveBeenCalled();
    });
    
    it('should return null if item is not found', () => {
      const result = tierManager.promoteMemoryItem('non-existent');
      
      expect(result).toBeNull();
      expect(mockMemoryStats.trackItemPromotion).not.toHaveBeenCalled();
    });
  });
  
  describe('demoteMemoryItem', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
      
      tierManager.shortTermMemory = [{ id: 'short-1', content: { text: 'Short-term item' } }];
      tierManager.longTermMemory = [{ id: 'long-1', content: { text: 'Long-term item' } }];
    });
    
    it('should demote an item from long-term to short-term memory', () => {
      const result = tierManager.demoteMemoryItem('long-1');
      
      expect(result).toEqual({ id: 'long-1', content: { text: 'Long-term item' } });
      expect(tierManager.longTermMemory).toEqual([]);
      expect(tierManager.shortTermMemory).toEqual([
        { id: 'short-1', content: { text: 'Short-term item' } },
        { id: 'long-1', content: { text: 'Long-term item' } }
      ]);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('longTerm', 0);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('shortTerm', 2);
      expect(mockMemoryStats.trackItemDemotion).toHaveBeenCalledWith('longTerm', 'shortTerm');
    });
    
    it('should demote an item from short-term to working memory', () => {
      const result = tierManager.demoteMemoryItem('short-1');
      
      expect(result).toEqual({ id: 'short-1', content: { text: 'Short-term item' } });
      expect(tierManager.shortTermMemory).toEqual([]);
      expect(tierManager.workingMemory).toEqual([
        { id: 'short-1', content: { text: 'Short-term item' } }
      ]);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('shortTerm', 0);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('working', 1);
      expect(mockMemoryStats.trackItemDemotion).toHaveBeenCalledWith('shortTerm', 'working');
    });
    
    it('should not demote an item from working memory', () => {
      tierManager.workingMemory = [{ id: 'work-1', content: { text: 'Working item' } }];
      
      const result = tierManager.demoteMemoryItem('work-1');
      
      expect(result).toEqual({ id: 'work-1', content: { text: 'Working item' } });
      expect(tierManager.workingMemory).toEqual([
        { id: 'work-1', content: { text: 'Working item' } }
      ]);
      
      expect(mockMemoryStats.trackItemDemotion).not.toHaveBeenCalled();
    });
    
    it('should return null if item is not found', () => {
      const result = tierManager.demoteMemoryItem('non-existent');
      
      expect(result).toBeNull();
      expect(mockMemoryStats.trackItemDemotion).not.toHaveBeenCalled();
    });
  });
  
  describe('clearMemoryTier', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
      
      tierManager.workingMemory = [{ id: 'work-1' }, { id: 'work-2' }];
      tierManager.shortTermMemory = [{ id: 'short-1' }];
      tierManager.longTermMemory = [{ id: 'long-1' }];
    });
    
    it('should clear working memory', () => {
      tierManager.clearMemoryTier('working');
      
      expect(tierManager.workingMemory).toEqual([]);
      expect(tierManager.shortTermMemory).toEqual([{ id: 'short-1' }]);
      expect(tierManager.longTermMemory).toEqual([{ id: 'long-1' }]);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('working', 0);
    });
    
    it('should clear short-term memory', () => {
      tierManager.clearMemoryTier('shortTerm');
      
      expect(tierManager.workingMemory).toEqual([{ id: 'work-1' }, { id: 'work-2' }]);
      expect(tierManager.shortTermMemory).toEqual([]);
      expect(tierManager.longTermMemory).toEqual([{ id: 'long-1' }]);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('shortTerm', 0);
    });
    
    it('should clear long-term memory', () => {
      tierManager.clearMemoryTier('longTerm');
      
      expect(tierManager.workingMemory).toEqual([{ id: 'work-1' }, { id: 'work-2' }]);
      expect(tierManager.shortTermMemory).toEqual([{ id: 'short-1' }]);
      expect(tierManager.longTermMemory).toEqual([]);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('longTerm', 0);
    });
    
    it('should throw an error for an invalid tier', () => {
      expect(() => {
        tierManager.clearMemoryTier('invalidTier');
      }).toThrow(MemoryTierError);
    });
  });
  
  describe('clearAllMemory', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
      
      tierManager.workingMemory = [{ id: 'work-1' }];
      tierManager.shortTermMemory = [{ id: 'short-1' }];
      tierManager.longTermMemory = [{ id: 'long-1' }];
    });
    
    it('should clear all memory tiers', () => {
      tierManager.clearAllMemory();
      
      expect(tierManager.workingMemory).toEqual([]);
      expect(tierManager.shortTermMemory).toEqual([]);
      expect(tierManager.longTermMemory).toEqual([]);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('working', 0);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('shortTerm', 0);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('longTerm', 0);
    });
  });
  
  describe('setMemoryTiers', () => {
    beforeEach(() => {
      tierManager.initialize({
        memoryStats: mockMemoryStats,
        memoryScoring: mockMemoryScoring
      });
    });
    
    it('should set all memory tiers', () => {
      const working = [{ id: 'new-work-1' }];
      const shortTerm = [{ id: 'new-short-1' }, { id: 'new-short-2' }];
      const longTerm = [{ id: 'new-long-1' }];
      
      tierManager.setMemoryTiers(working, shortTerm, longTerm);
      
      expect(tierManager.workingMemory).toEqual(working);
      expect(tierManager.shortTermMemory).toEqual(shortTerm);
      expect(tierManager.longTermMemory).toEqual(longTerm);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('working', 1);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('shortTerm', 2);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('longTerm', 1);
    });
    
    it('should handle empty arrays', () => {
      tierManager.workingMemory = [{ id: 'work-1' }];
      tierManager.shortTermMemory = [{ id: 'short-1' }];
      tierManager.longTermMemory = [{ id: 'long-1' }];
      
      tierManager.setMemoryTiers([], [], []);
      
      expect(tierManager.workingMemory).toEqual([]);
      expect(tierManager.shortTermMemory).toEqual([]);
      expect(tierManager.longTermMemory).toEqual([]);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('working', 0);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('shortTerm', 0);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('longTerm', 0);
    });
    
    it('should handle undefined values', () => {
      tierManager.workingMemory = [{ id: 'work-1' }];
      tierManager.shortTermMemory = [{ id: 'short-1' }];
      tierManager.longTermMemory = [{ id: 'long-1' }];
      
      tierManager.setMemoryTiers();
      
      expect(tierManager.workingMemory).toEqual([]);
      expect(tierManager.shortTermMemory).toEqual([]);
      expect(tierManager.longTermMemory).toEqual([]);
      
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('working', 0);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('shortTerm', 0);
      expect(mockMemoryStats.updateItemCount).toHaveBeenCalledWith('longTerm', 0);
    });
  });
}); 