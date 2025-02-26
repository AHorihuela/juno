/**
 * MemoryStats - Tracks memory statistics
 * 
 * This class is responsible for:
 * - Tracking memory usage statistics
 * - Providing insights into memory performance
 * - Monitoring memory health
 */

const { MemoryStatsError } = require('./MemoryErrors');
const logger = require('../../utils/logger');

class MemoryStats {
  constructor() {
    this.initialized = false;
    this.tierManager = null;
    this.stats = {
      totalItems: 0,
      itemsByTier: {
        working: 0,
        shortTerm: 0,
        longTerm: 0
      },
      operations: {
        adds: 0,
        accesses: 0,
        deletions: 0,
        promotions: 0,
        demotions: 0,
        expirations: 0
      },
      averageScores: {
        working: 0,
        shortTerm: 0,
        longTerm: 0
      },
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Initialize the memory stats service
   * 
   * @async
   * @param {Object} options - Initialization options
   * @param {Object} options.tierManager - Reference to the tier manager
   * @param {Object} options.services - Service container for dependency injection
   * @returns {Promise<void>}
   * @throws {MemoryStatsError} If initialization fails
   */
  async initialize(options = {}) {
    try {
      if (this.initialized) return;
      
      logger.info('[MemoryStats] Initializing');
      
      if (!options.tierManager) {
        throw new MemoryStatsError('Tier manager is required');
      }
      
      this.tierManager = options.tierManager;
      
      // Update stats initially
      await this.updateMemoryStats();
      
      this.initialized = true;
      logger.info('[MemoryStats] Initialized successfully');
    } catch (error) {
      const wrappedError = new MemoryStatsError('Failed to initialize memory stats', { cause: error });
      logger.error('[MemoryStats] Initialization error:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Update memory statistics
   * 
   * @async
   * @returns {Promise<Object>} Updated stats
   * @throws {MemoryStatsError} If update fails
   */
  async updateMemoryStats() {
    try {
      if (!this.initialized) {
        throw new MemoryStatsError('Memory stats not initialized');
      }
      
      // Get all memory items from tier manager
      const allItems = await this.tierManager.getAllMemoryItems();
      
      // Update item counts
      this.stats.itemsByTier.working = allItems.working.length;
      this.stats.itemsByTier.shortTerm = allItems.shortTerm.length;
      this.stats.itemsByTier.longTerm = allItems.longTerm.length;
      this.stats.totalItems = 
        this.stats.itemsByTier.working + 
        this.stats.itemsByTier.shortTerm + 
        this.stats.itemsByTier.longTerm;
      
      // Calculate average scores
      this.stats.averageScores.working = this.calculateAverageScore(allItems.working);
      this.stats.averageScores.shortTerm = this.calculateAverageScore(allItems.shortTerm);
      this.stats.averageScores.longTerm = this.calculateAverageScore(allItems.longTerm);
      
      // Update timestamp
      this.stats.lastUpdated = Date.now();
      
      return this.stats;
    } catch (error) {
      const wrappedError = new MemoryStatsError('Failed to update memory stats', { cause: error });
      logger.error('[MemoryStats] Error updating stats:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Calculate average relevance score for a list of items
   * 
   * @param {Array} items - List of memory items
   * @returns {number} Average score
   */
  calculateAverageScore(items) {
    if (!items || items.length === 0) {
      return 0;
    }
    
    const sum = items.reduce((total, item) => total + (item.relevanceScore || 0), 0);
    return sum / items.length;
  }
  
  /**
   * Update stats after adding a new item
   * 
   * @async
   * @param {Object} item - The item that was added
   * @returns {Promise<void>}
   */
  async updateAfterAddingItem(item) {
    try {
      if (!this.initialized) return;
      
      // Increment add count
      this.stats.operations.adds++;
      
      // Update item counts
      this.stats.itemsByTier.working++;
      this.stats.totalItems++;
      
      // Update timestamp
      this.stats.lastUpdated = Date.now();
    } catch (error) {
      logger.error('[MemoryStats] Error updating stats after adding item:', error);
      // Don't throw, as this is non-critical functionality
    }
  }
  
  /**
   * Update stats after accessing an item
   * 
   * @async
   * @param {string} itemId - ID of the accessed item
   * @param {number} usefulness - How useful the item was
   * @returns {Promise<void>}
   */
  async updateAfterItemUsage(itemId, usefulness) {
    try {
      if (!this.initialized) return;
      
      // Increment access count
      this.stats.operations.accesses++;
      
      // Update timestamp
      this.stats.lastUpdated = Date.now();
    } catch (error) {
      logger.error('[MemoryStats] Error updating stats after item usage:', error);
      // Don't throw, as this is non-critical functionality
    }
  }
  
  /**
   * Update stats after deleting an item
   * 
   * @async
   * @param {string} itemId - ID of the deleted item
   * @returns {Promise<void>}
   */
  async updateAfterItemDeletion(itemId) {
    try {
      if (!this.initialized) return;
      
      // Increment deletion count
      this.stats.operations.deletions++;
      
      // We don't know which tier the item was in, so we'll update all stats
      await this.updateMemoryStats();
    } catch (error) {
      logger.error('[MemoryStats] Error updating stats after item deletion:', error);
      // Don't throw, as this is non-critical functionality
    }
  }
  
  /**
   * Update stats after memory management
   * 
   * @async
   * @param {Object} changes - Changes made during memory management
   * @returns {Promise<void>}
   */
  async updateAfterMemoryManagement(changes = {}) {
    try {
      if (!this.initialized) return;
      
      // Update promotion and demotion counts
      this.stats.operations.promotions += 
        (changes.promotedToShortTerm || 0) + 
        (changes.promotedToLongTerm || 0);
      
      this.stats.operations.demotions += 
        (changes.demotedFromShortTerm || 0) + 
        (changes.demotedFromLongTerm || 0);
      
      // Update expiration count
      this.stats.operations.expirations += (changes.expired || 0);
      
      // Update all stats
      await this.updateMemoryStats();
    } catch (error) {
      logger.error('[MemoryStats] Error updating stats after memory management:', error);
      // Don't throw, as this is non-critical functionality
    }
  }
  
  /**
   * Update stats after clearing memory
   * 
   * @async
   * @param {string} tier - Tier that was cleared, or null if all tiers
   * @returns {Promise<void>}
   */
  async updateAfterMemoryClear(tier) {
    try {
      if (!this.initialized) return;
      
      if (tier) {
        // Clear specific tier
        switch (tier) {
          case 'working':
            this.stats.itemsByTier.working = 0;
            break;
          case 'short-term':
            this.stats.itemsByTier.shortTerm = 0;
            break;
          case 'long-term':
            this.stats.itemsByTier.longTerm = 0;
            break;
        }
      } else {
        // Clear all tiers
        this.stats.itemsByTier.working = 0;
        this.stats.itemsByTier.shortTerm = 0;
        this.stats.itemsByTier.longTerm = 0;
      }
      
      // Update total count
      this.stats.totalItems = 
        this.stats.itemsByTier.working + 
        this.stats.itemsByTier.shortTerm + 
        this.stats.itemsByTier.longTerm;
      
      // Update timestamp
      this.stats.lastUpdated = Date.now();
    } catch (error) {
      logger.error('[MemoryStats] Error updating stats after memory clear:', error);
      // Don't throw, as this is non-critical functionality
    }
  }
  
  /**
   * Update stats after retrieving context
   * 
   * @async
   * @param {Object} context - The retrieved context
   * @returns {Promise<void>}
   */
  async updateAfterContextRetrieval(context) {
    try {
      if (!this.initialized) return;
      
      // Increment access count for each item
      if (context && Array.isArray(context.items)) {
        this.stats.operations.accesses += context.items.length;
      }
      
      // Update timestamp
      this.stats.lastUpdated = Date.now();
    } catch (error) {
      logger.error('[MemoryStats] Error updating stats after context retrieval:', error);
      // Don't throw, as this is non-critical functionality
    }
  }
  
  /**
   * Get current memory statistics
   * 
   * @returns {Object} Memory statistics
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = MemoryStats; 