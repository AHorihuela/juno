/**
 * Tests for the MemoryStats module
 */

// Mock logger
jest.mock('../../../../main/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const MemoryStats = require('../../../../main/services/memory/MemoryStats');
const { MemoryStatsError } = require('../../../../main/services/memory/MemoryErrors');

describe('MemoryStats', () => {
  let memoryStats;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a new instance for each test
    memoryStats = new MemoryStats();
  });
  
  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(memoryStats.initialized).toBe(false);
      expect(memoryStats.stats).toEqual({
        totalItems: 0,
        itemsByTier: {
          working: 0,
          shortTerm: 0,
          longTerm: 0
        },
        operations: {
          additions: 0,
          accesses: 0,
          deletions: 0,
          promotions: 0,
          demotions: 0,
          expirations: 0
        },
        averageRelevanceScore: 0,
        lastUpdated: null
      });
    });
    
    it('should initialize successfully', () => {
      memoryStats.initialize();
      
      expect(memoryStats.initialized).toBe(true);
      expect(memoryStats.stats.lastUpdated).toBeInstanceOf(Date);
    });
    
    it('should not initialize twice', () => {
      // First initialization
      memoryStats.initialize();
      
      // Store the initial lastUpdated value
      const initialLastUpdated = memoryStats.stats.lastUpdated;
      
      // Wait a bit to ensure a different timestamp
      jest.advanceTimersByTime(1000);
      
      // Second initialization
      memoryStats.initialize();
      
      // lastUpdated should not have changed
      expect(memoryStats.stats.lastUpdated).toBe(initialLastUpdated);
    });
  });
  
  describe('updateItemCount', () => {
    it('should update item count for a tier', () => {
      memoryStats.initialize();
      
      memoryStats.updateItemCount('working', 5);
      
      expect(memoryStats.stats.itemsByTier.working).toBe(5);
      expect(memoryStats.stats.totalItems).toBe(5);
    });
    
    it('should update total item count when updating multiple tiers', () => {
      memoryStats.initialize();
      
      memoryStats.updateItemCount('working', 3);
      memoryStats.updateItemCount('shortTerm', 7);
      memoryStats.updateItemCount('longTerm', 10);
      
      expect(memoryStats.stats.itemsByTier.working).toBe(3);
      expect(memoryStats.stats.itemsByTier.shortTerm).toBe(7);
      expect(memoryStats.stats.itemsByTier.longTerm).toBe(10);
      expect(memoryStats.stats.totalItems).toBe(20);
    });
    
    it('should throw error for invalid tier', () => {
      memoryStats.initialize();
      
      expect(() => memoryStats.updateItemCount('invalidTier', 5))
        .toThrow(MemoryStatsError);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => memoryStats.updateItemCount('working', 5))
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('trackItemAdded', () => {
    it('should increment additions counter', () => {
      memoryStats.initialize();
      
      memoryStats.trackItemAdded('working');
      
      expect(memoryStats.stats.operations.additions).toBe(1);
      expect(memoryStats.stats.itemsByTier.working).toBe(1);
      expect(memoryStats.stats.totalItems).toBe(1);
    });
    
    it('should throw error for invalid tier', () => {
      memoryStats.initialize();
      
      expect(() => memoryStats.trackItemAdded('invalidTier'))
        .toThrow(MemoryStatsError);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => memoryStats.trackItemAdded('working'))
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('trackItemAccessed', () => {
    it('should increment accesses counter', () => {
      memoryStats.initialize();
      
      memoryStats.trackItemAccessed();
      
      expect(memoryStats.stats.operations.accesses).toBe(1);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => memoryStats.trackItemAccessed())
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('trackItemDeleted', () => {
    it('should increment deletions counter and decrement item count', () => {
      memoryStats.initialize();
      
      // First add an item
      memoryStats.trackItemAdded('working');
      
      // Then delete it
      memoryStats.trackItemDeleted('working');
      
      expect(memoryStats.stats.operations.deletions).toBe(1);
      expect(memoryStats.stats.itemsByTier.working).toBe(0);
      expect(memoryStats.stats.totalItems).toBe(0);
    });
    
    it('should not allow item count to go below zero', () => {
      memoryStats.initialize();
      
      // Delete without adding first
      memoryStats.trackItemDeleted('working');
      
      expect(memoryStats.stats.operations.deletions).toBe(1);
      expect(memoryStats.stats.itemsByTier.working).toBe(0);
      expect(memoryStats.stats.totalItems).toBe(0);
    });
    
    it('should throw error for invalid tier', () => {
      memoryStats.initialize();
      
      expect(() => memoryStats.trackItemDeleted('invalidTier'))
        .toThrow(MemoryStatsError);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => memoryStats.trackItemDeleted('working'))
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('trackItemPromoted', () => {
    it('should increment promotions counter and update tier counts', () => {
      memoryStats.initialize();
      
      // First add an item to working memory
      memoryStats.trackItemAdded('working');
      
      // Then promote it to short-term
      memoryStats.trackItemPromoted('working', 'shortTerm');
      
      expect(memoryStats.stats.operations.promotions).toBe(1);
      expect(memoryStats.stats.itemsByTier.working).toBe(0);
      expect(memoryStats.stats.itemsByTier.shortTerm).toBe(1);
      expect(memoryStats.stats.totalItems).toBe(1);
    });
    
    it('should throw error for invalid source tier', () => {
      memoryStats.initialize();
      
      expect(() => memoryStats.trackItemPromoted('invalidTier', 'shortTerm'))
        .toThrow(MemoryStatsError);
    });
    
    it('should throw error for invalid target tier', () => {
      memoryStats.initialize();
      
      expect(() => memoryStats.trackItemPromoted('working', 'invalidTier'))
        .toThrow(MemoryStatsError);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => memoryStats.trackItemPromoted('working', 'shortTerm'))
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('trackItemDemoted', () => {
    it('should increment demotions counter and update tier counts', () => {
      memoryStats.initialize();
      
      // First add an item to short-term memory
      memoryStats.trackItemAdded('shortTerm');
      
      // Then demote it to working
      memoryStats.trackItemDemoted('shortTerm', 'working');
      
      expect(memoryStats.stats.operations.demotions).toBe(1);
      expect(memoryStats.stats.itemsByTier.shortTerm).toBe(0);
      expect(memoryStats.stats.itemsByTier.working).toBe(1);
      expect(memoryStats.stats.totalItems).toBe(1);
    });
    
    it('should throw error for invalid source tier', () => {
      memoryStats.initialize();
      
      expect(() => memoryStats.trackItemDemoted('invalidTier', 'working'))
        .toThrow(MemoryStatsError);
    });
    
    it('should throw error for invalid target tier', () => {
      memoryStats.initialize();
      
      expect(() => memoryStats.trackItemDemoted('shortTerm', 'invalidTier'))
        .toThrow(MemoryStatsError);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => memoryStats.trackItemDemoted('shortTerm', 'working'))
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('trackItemExpired', () => {
    it('should increment expirations counter and decrement item count', () => {
      memoryStats.initialize();
      
      // First add an item
      memoryStats.trackItemAdded('working');
      
      // Then expire it
      memoryStats.trackItemExpired('working');
      
      expect(memoryStats.stats.operations.expirations).toBe(1);
      expect(memoryStats.stats.itemsByTier.working).toBe(0);
      expect(memoryStats.stats.totalItems).toBe(0);
    });
    
    it('should throw error for invalid tier', () => {
      memoryStats.initialize();
      
      expect(() => memoryStats.trackItemExpired('invalidTier'))
        .toThrow(MemoryStatsError);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => memoryStats.trackItemExpired('working'))
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('calculateAverageScore', () => {
    it('should calculate average score for items', () => {
      memoryStats.initialize();
      
      const items = [
        { relevanceScore: 0.5 },
        { relevanceScore: 0.7 },
        { relevanceScore: 0.9 }
      ];
      
      memoryStats.calculateAverageScore(items);
      
      // Average should be (0.5 + 0.7 + 0.9) / 3 = 0.7
      expect(memoryStats.stats.averageRelevanceScore).toBe(0.7);
    });
    
    it('should handle empty items array', () => {
      memoryStats.initialize();
      
      memoryStats.calculateAverageScore([]);
      
      expect(memoryStats.stats.averageRelevanceScore).toBe(0);
    });
    
    it('should handle items without relevanceScore', () => {
      memoryStats.initialize();
      
      const items = [
        { relevanceScore: 0.5 },
        { }, // No relevanceScore
        { relevanceScore: 0.9 }
      ];
      
      memoryStats.calculateAverageScore(items);
      
      // Average should be (0.5 + 0 + 0.9) / 3 = 0.4667
      expect(memoryStats.stats.averageRelevanceScore).toBeCloseTo(0.4667, 4);
    });
    
    it('should throw error if not initialized', () => {
      const items = [{ relevanceScore: 0.5 }];
      
      expect(() => memoryStats.calculateAverageScore(items))
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('resetStats', () => {
    it('should reset all stats to default values', () => {
      memoryStats.initialize();
      
      // Add some stats
      memoryStats.trackItemAdded('working');
      memoryStats.trackItemAdded('shortTerm');
      memoryStats.trackItemAccessed();
      
      // Reset stats
      memoryStats.resetStats();
      
      // Check that stats are reset
      expect(memoryStats.stats).toEqual({
        totalItems: 0,
        itemsByTier: {
          working: 0,
          shortTerm: 0,
          longTerm: 0
        },
        operations: {
          additions: 0,
          accesses: 0,
          deletions: 0,
          promotions: 0,
          demotions: 0,
          expirations: 0
        },
        averageRelevanceScore: 0,
        lastUpdated: expect.any(Date)
      });
    });
    
    it('should throw error if not initialized', () => {
      expect(() => memoryStats.resetStats())
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('getStats', () => {
    it('should return a copy of the stats', () => {
      memoryStats.initialize();
      
      const stats = memoryStats.getStats();
      
      // Should be a copy, not a reference
      expect(stats).not.toBe(memoryStats.stats);
      expect(stats).toEqual(memoryStats.stats);
      
      // Modifying the returned stats should not affect the original
      stats.totalItems = 100;
      expect(memoryStats.stats.totalItems).toBe(0);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => memoryStats.getStats())
        .toThrow(MemoryStatsError);
    });
  });
}); 