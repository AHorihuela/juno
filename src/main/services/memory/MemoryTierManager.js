/**
 * MemoryTierManager - Manages the different memory tiers
 * 
 * This class is responsible for:
 * - Managing items in different memory tiers (working, short-term, long-term)
 * - Moving items between tiers based on relevance and usage
 * - Providing access to memory items across tiers
 */

const { v4: uuidv4 } = require('uuid');
const { MemoryTierError, MemoryAccessError } = require('./MemoryErrors');
const logger = require('../../utils/logger');

// Constants for memory tier configuration
const MEMORY_TIERS = {
  WORKING: 'working',
  SHORT_TERM: 'short-term',
  LONG_TERM: 'long-term'
};

// Default expiration times (in milliseconds)
const DEFAULT_EXPIRATION = {
  [MEMORY_TIERS.WORKING]: 5 * 60 * 1000, // 5 minutes
  [MEMORY_TIERS.SHORT_TERM]: 24 * 60 * 60 * 1000, // 24 hours
  [MEMORY_TIERS.LONG_TERM]: null // No expiration
};

// Maximum items per tier
const MAX_ITEMS = {
  [MEMORY_TIERS.WORKING]: 50,
  [MEMORY_TIERS.SHORT_TERM]: 100,
  [MEMORY_TIERS.LONG_TERM]: 500
};

class MemoryTierManager {
  constructor() {
    // Initialize memory tiers
    this.memory = {
      [MEMORY_TIERS.WORKING]: [],
      [MEMORY_TIERS.SHORT_TERM]: [],
      [MEMORY_TIERS.LONG_TERM]: []
    };
    
    this.initialized = false;
    this.scoring = null;
  }
  
  /**
   * Initialize the memory tier manager
   * 
   * @async
   * @param {Object} options - Initialization options
   * @param {Array} [options.longTermMemory] - Pre-loaded long-term memory items
   * @param {Object} [options.scoring] - Scoring service for relevance calculations
   * @returns {Promise<void>}
   * @throws {MemoryTierError} If initialization fails
   */
  async initialize(options = {}) {
    try {
      if (this.initialized) return;
      
      logger.info('[MemoryTierManager] Initializing');
      
      // Set up scoring service
      this.scoring = options.scoring;
      
      // Load long-term memory if provided
      if (Array.isArray(options.longTermMemory)) {
        this.memory[MEMORY_TIERS.LONG_TERM] = options.longTermMemory.map(item => {
          // Ensure all items have the required fields
          return {
            ...item,
            tier: MEMORY_TIERS.LONG_TERM,
            lastAccessed: item.lastAccessed || Date.now(),
            accessCount: item.accessCount || 0,
            relevanceScore: item.relevanceScore || 0
          };
        });
        
        logger.info(`[MemoryTierManager] Loaded ${this.memory[MEMORY_TIERS.LONG_TERM].length} long-term memory items`);
      }
      
      this.initialized = true;
      logger.info('[MemoryTierManager] Initialized successfully');
    } catch (error) {
      const wrappedError = new MemoryTierError('Failed to initialize memory tier manager', { cause: error });
      logger.error('[MemoryTierManager] Initialization error:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Add a new item to memory (initially to working memory)
   * 
   * @async
   * @param {Object} item - The item to add
   * @returns {Promise<Object>} The enriched item that was added
   * @throws {MemoryTierError} If the item cannot be added
   */
  async addItem(item) {
    try {
      if (!this.initialized) {
        throw new MemoryTierError('Memory tier manager not initialized');
      }
      
      if (!item || !item.content) {
        throw new MemoryTierError('Invalid memory item: missing content');
      }
      
      // Enrich the item with metadata
      const enrichedItem = {
        ...item,
        id: item.id || uuidv4(),
        createdAt: item.createdAt || Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        usefulness: item.usefulness || 0,
        relevanceScore: 0,
        tier: MEMORY_TIERS.WORKING,
        expiresAt: Date.now() + DEFAULT_EXPIRATION[MEMORY_TIERS.WORKING]
      };
      
      // Calculate initial relevance score if scoring service is available
      if (this.scoring) {
        enrichedItem.relevanceScore = await this.scoring.calculateInitialScore(enrichedItem);
      }
      
      // Add to working memory
      this.memory[MEMORY_TIERS.WORKING].push(enrichedItem);
      
      // Enforce maximum items limit for working memory
      if (this.memory[MEMORY_TIERS.WORKING].length > MAX_ITEMS[MEMORY_TIERS.WORKING]) {
        // Sort by relevance score and remove least relevant items
        this.memory[MEMORY_TIERS.WORKING].sort((a, b) => b.relevanceScore - a.relevanceScore);
        this.memory[MEMORY_TIERS.WORKING] = this.memory[MEMORY_TIERS.WORKING].slice(
          0, 
          MAX_ITEMS[MEMORY_TIERS.WORKING]
        );
      }
      
      logger.info(`[MemoryTierManager] Added item to working memory: ${enrichedItem.id}`);
      return enrichedItem;
    } catch (error) {
      const wrappedError = new MemoryTierError('Failed to add memory item', { cause: error });
      logger.error('[MemoryTierManager] Error adding item:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Manage memory tiers - move items between tiers based on relevance
   * 
   * @async
   * @returns {Promise<Object>} Changes made during management
   * @throws {MemoryTierError} If memory management fails
   */
  async manageMemoryTiers() {
    try {
      if (!this.initialized) {
        throw new MemoryTierError('Memory tier manager not initialized');
      }
      
      logger.info('[MemoryTierManager] Managing memory tiers');
      
      const now = Date.now();
      const changes = {
        expired: 0,
        promotedToShortTerm: 0,
        promotedToLongTerm: 0,
        demotedFromShortTerm: 0,
        demotedFromLongTerm: 0,
        longTermMemoryChanged: false
      };
      
      // Process working memory
      const workingMemoryToKeep = [];
      const workingMemoryToPromote = [];
      
      for (const item of this.memory[MEMORY_TIERS.WORKING]) {
        // Check if item has expired
        if (item.expiresAt && item.expiresAt < now) {
          changes.expired++;
          continue;
        }
        
        // Update relevance score if scoring service is available
        if (this.scoring) {
          item.relevanceScore = await this.scoring.calculateScore(item);
        }
        
        // Decide whether to promote to short-term memory
        if (
          item.accessCount >= 3 || // Accessed frequently
          item.usefulness >= 7 || // Highly useful
          item.relevanceScore >= 0.7 // High relevance score
        ) {
          workingMemoryToPromote.push({
            ...item,
            tier: MEMORY_TIERS.SHORT_TERM,
            expiresAt: now + DEFAULT_EXPIRATION[MEMORY_TIERS.SHORT_TERM]
          });
          changes.promotedToShortTerm++;
        } else {
          workingMemoryToKeep.push(item);
        }
      }
      
      // Process short-term memory
      const shortTermMemoryToKeep = [];
      const shortTermMemoryToPromote = [];
      const shortTermMemoryToDemote = [];
      
      for (const item of this.memory[MEMORY_TIERS.SHORT_TERM]) {
        // Check if item has expired
        if (item.expiresAt && item.expiresAt < now) {
          // If it's still somewhat relevant, demote to working memory
          if (item.relevanceScore >= 0.3) {
            shortTermMemoryToDemote.push({
              ...item,
              tier: MEMORY_TIERS.WORKING,
              expiresAt: now + DEFAULT_EXPIRATION[MEMORY_TIERS.WORKING]
            });
            changes.demotedFromShortTerm++;
          } else {
            // Otherwise, let it expire
            changes.expired++;
          }
          continue;
        }
        
        // Update relevance score if scoring service is available
        if (this.scoring) {
          item.relevanceScore = await this.scoring.calculateScore(item);
        }
        
        // Decide whether to promote to long-term memory
        if (
          item.accessCount >= 5 || // Accessed very frequently
          item.usefulness >= 8 || // Very highly useful
          item.relevanceScore >= 0.8 // Very high relevance score
        ) {
          shortTermMemoryToPromote.push({
            ...item,
            tier: MEMORY_TIERS.LONG_TERM,
            expiresAt: null // Long-term memory doesn't expire
          });
          changes.promotedToLongTerm++;
          changes.longTermMemoryChanged = true;
        } else {
          shortTermMemoryToKeep.push(item);
        }
      }
      
      // Process long-term memory
      const longTermMemoryToKeep = [];
      const longTermMemoryToDemote = [];
      
      for (const item of this.memory[MEMORY_TIERS.LONG_TERM]) {
        // Update relevance score if scoring service is available
        if (this.scoring) {
          item.relevanceScore = await this.scoring.calculateScore(item);
        }
        
        // Decide whether to demote to short-term memory
        if (
          item.relevanceScore < 0.5 && // Low relevance score
          (now - item.lastAccessed) > (30 * 24 * 60 * 60 * 1000) // Not accessed in 30 days
        ) {
          longTermMemoryToDemote.push({
            ...item,
            tier: MEMORY_TIERS.SHORT_TERM,
            expiresAt: now + DEFAULT_EXPIRATION[MEMORY_TIERS.SHORT_TERM]
          });
          changes.demotedFromLongTerm++;
          changes.longTermMemoryChanged = true;
        } else {
          longTermMemoryToKeep.push(item);
        }
      }
      
      // Update memory tiers
      this.memory[MEMORY_TIERS.WORKING] = [
        ...workingMemoryToKeep,
        ...shortTermMemoryToDemote
      ];
      
      this.memory[MEMORY_TIERS.SHORT_TERM] = [
        ...shortTermMemoryToKeep,
        ...workingMemoryToPromote,
        ...longTermMemoryToDemote
      ];
      
      this.memory[MEMORY_TIERS.LONG_TERM] = [
        ...longTermMemoryToKeep,
        ...shortTermMemoryToPromote
      ];
      
      // Enforce maximum items limit for each tier
      for (const tier of Object.values(MEMORY_TIERS)) {
        if (this.memory[tier].length > MAX_ITEMS[tier]) {
          // Sort by relevance score and remove least relevant items
          this.memory[tier].sort((a, b) => b.relevanceScore - a.relevanceScore);
          this.memory[tier] = this.memory[tier].slice(0, MAX_ITEMS[tier]);
        }
      }
      
      logger.info('[MemoryTierManager] Memory tier management complete', changes);
      return changes;
    } catch (error) {
      const wrappedError = new MemoryTierError('Failed to manage memory tiers', { cause: error });
      logger.error('[MemoryTierManager] Error managing memory tiers:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Record that an item was accessed and found useful
   * 
   * @async
   * @param {string} itemId - ID of the item
   * @param {number} usefulness - How useful the item was (0-10)
   * @returns {Promise<boolean>} Success status
   * @throws {MemoryAccessError} If the item cannot be accessed
   */
  async recordItemUsage(itemId, usefulness = 5) {
    try {
      if (!this.initialized) {
        throw new MemoryAccessError('Memory tier manager not initialized');
      }
      
      if (!itemId) {
        throw new MemoryAccessError('Invalid item ID');
      }
      
      // Find the item in any tier
      let found = false;
      
      for (const tier of Object.values(MEMORY_TIERS)) {
        const itemIndex = this.memory[tier].findIndex(item => item.id === itemId);
        
        if (itemIndex !== -1) {
          // Update item metadata
          this.memory[tier][itemIndex] = {
            ...this.memory[tier][itemIndex],
            lastAccessed: Date.now(),
            accessCount: (this.memory[tier][itemIndex].accessCount || 0) + 1,
            usefulness: Math.max(
              this.memory[tier][itemIndex].usefulness || 0,
              usefulness
            )
          };
          
          // Update relevance score if scoring service is available
          if (this.scoring) {
            this.memory[tier][itemIndex].relevanceScore = 
              await this.scoring.calculateScore(this.memory[tier][itemIndex]);
          }
          
          found = true;
          break;
        }
      }
      
      return found;
    } catch (error) {
      const wrappedError = new MemoryAccessError('Failed to record item usage', { 
        cause: error,
        itemId
      });
      logger.error('[MemoryTierManager] Error recording item usage:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get the best context for a given command
   * 
   * @async
   * @param {string} command - The command being processed
   * @param {Object} options - Options for context selection
   * @param {number} [options.maxItems=10] - Maximum number of items to return
   * @param {number} [options.minRelevance=0.3] - Minimum relevance score for items
   * @returns {Promise<Object>} Selected context items
   * @throws {MemoryAccessError} If context cannot be retrieved
   */
  async getContextForCommand(command, options = {}) {
    try {
      if (!this.initialized) {
        throw new MemoryAccessError('Memory tier manager not initialized');
      }
      
      if (!command) {
        throw new MemoryAccessError('Command is required');
      }
      
      const maxItems = options.maxItems || 10;
      const minRelevance = options.minRelevance || 0.3;
      
      // Collect all items from all tiers
      const allItems = [
        ...this.memory[MEMORY_TIERS.WORKING],
        ...this.memory[MEMORY_TIERS.SHORT_TERM],
        ...this.memory[MEMORY_TIERS.LONG_TERM]
      ];
      
      // Calculate relevance for each item if scoring service is available
      let scoredItems = allItems;
      
      if (this.scoring) {
        scoredItems = await Promise.all(
          allItems.map(async item => {
            const commandRelevance = await this.scoring.calculateRelevanceToCommand(item, command);
            return {
              ...item,
              commandRelevance
            };
          })
        );
      }
      
      // Filter by minimum relevance
      const relevantItems = scoredItems.filter(item => 
        (item.commandRelevance || 0) >= minRelevance
      );
      
      // Sort by relevance to command
      relevantItems.sort((a, b) => (b.commandRelevance || 0) - (a.commandRelevance || 0));
      
      // Take top N items
      const selectedItems = relevantItems.slice(0, maxItems);
      
      // Record usage for selected items
      for (const item of selectedItems) {
        await this.recordItemUsage(item.id, 5); // Medium usefulness by default
      }
      
      return {
        items: selectedItems,
        totalRelevantItems: relevantItems.length
      };
    } catch (error) {
      const wrappedError = new MemoryAccessError('Failed to get context for command', { 
        cause: error,
        command
      });
      logger.error('[MemoryTierManager] Error getting context for command:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get all memory items for UI display
   * 
   * @async
   * @returns {Promise<Object>} Memory items organized by tier
   * @throws {MemoryAccessError} If items cannot be retrieved
   */
  async getAllMemoryItems() {
    try {
      if (!this.initialized) {
        throw new MemoryAccessError('Memory tier manager not initialized');
      }
      
      return {
        working: this.memory[MEMORY_TIERS.WORKING],
        shortTerm: this.memory[MEMORY_TIERS.SHORT_TERM],
        longTerm: this.memory[MEMORY_TIERS.LONG_TERM]
      };
    } catch (error) {
      const wrappedError = new MemoryAccessError('Failed to get all memory items', { cause: error });
      logger.error('[MemoryTierManager] Error getting all memory items:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Delete an item from memory
   * 
   * @async
   * @param {string} itemId - ID of the item to delete
   * @returns {Promise<boolean>} Success status
   * @throws {MemoryAccessError} If the item cannot be deleted
   */
  async deleteItem(itemId) {
    try {
      if (!this.initialized) {
        throw new MemoryAccessError('Memory tier manager not initialized');
      }
      
      if (!itemId) {
        throw new MemoryAccessError('Invalid item ID');
      }
      
      // Find and delete the item from any tier
      let deleted = false;
      let wasInLongTerm = false;
      
      for (const tier of Object.values(MEMORY_TIERS)) {
        const initialLength = this.memory[tier].length;
        this.memory[tier] = this.memory[tier].filter(item => item.id !== itemId);
        
        if (this.memory[tier].length < initialLength) {
          deleted = true;
          if (tier === MEMORY_TIERS.LONG_TERM) {
            wasInLongTerm = true;
          }
        }
      }
      
      if (deleted) {
        logger.info(`[MemoryTierManager] Deleted item: ${itemId}`);
      }
      
      return deleted;
    } catch (error) {
      const wrappedError = new MemoryAccessError('Failed to delete memory item', { 
        cause: error,
        itemId
      });
      logger.error('[MemoryTierManager] Error deleting memory item:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Clear all memory or a specific tier
   * 
   * @async
   * @param {string} [tier] - Specific tier to clear, or all if not specified
   * @returns {Promise<boolean>} Success status
   * @throws {MemoryTierError} If memory cannot be cleared
   */
  async clearMemory(tier = null) {
    try {
      if (!this.initialized) {
        throw new MemoryTierError('Memory tier manager not initialized');
      }
      
      if (tier) {
        // Clear specific tier
        if (!Object.values(MEMORY_TIERS).includes(tier)) {
          throw new MemoryTierError(`Invalid memory tier: ${tier}`);
        }
        
        this.memory[tier] = [];
        logger.info(`[MemoryTierManager] Cleared ${tier} memory`);
      } else {
        // Clear all tiers
        for (const t of Object.values(MEMORY_TIERS)) {
          this.memory[t] = [];
        }
        logger.info('[MemoryTierManager] Cleared all memory');
      }
      
      return true;
    } catch (error) {
      const wrappedError = new MemoryTierError('Failed to clear memory', { 
        cause: error,
        tier
      });
      logger.error('[MemoryTierManager] Error clearing memory:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get long-term memory items
   * 
   * @returns {Array} Long-term memory items
   */
  getLongTermMemory() {
    return this.memory[MEMORY_TIERS.LONG_TERM];
  }
}

module.exports = MemoryTierManager; 