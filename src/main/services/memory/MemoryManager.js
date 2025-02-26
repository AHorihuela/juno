/**
 * MemoryManager - Main orchestrator for the memory system
 * 
 * This class coordinates the different components of the memory system:
 * - Memory tier management
 * - Persistence
 * - Statistics
 * - Scoring and relevance
 * 
 * It provides a unified API for other services to interact with the memory system.
 */

const MemoryTierManager = require('./MemoryTierManager');
const MemoryPersistence = require('./MemoryPersistence');
const MemoryScoring = require('./MemoryScoring');
const MemoryStats = require('./MemoryStats');
const AIUsageTracker = require('./AIUsageTracker');
const { MemoryError, MemoryAccessError, MemoryStorageError } = require('./MemoryErrors');
const logger = require('../../utils/logger');

class MemoryManager {
  /**
   * Creates a new MemoryManager instance
   * @constructor
   */
  constructor() {
    // Initialize sub-modules
    this.tierManager = new MemoryTierManager();
    this.persistence = new MemoryPersistence();
    this.scoring = new MemoryScoring();
    this.stats = new MemoryStats();
    this.aiTracker = new AIUsageTracker();
    
    this.initialized = false;
    this.services = null;
  }
  
  /**
   * Initialize the memory manager and all its components
   * 
   * @async
   * @param {Object} services - Service container for dependency injection
   * @returns {Promise<void>}
   * @throws {MemoryError} If initialization fails
   */
  async initialize(services) {
    if (this.initialized) return;
    
    try {
      logger.info('[MemoryManager] Starting initialization');
      this.services = services;
      
      // Initialize persistence first (needed for loading data)
      await this.persistence.initialize(services);
      
      // Load long-term memory from disk
      const longTermMemory = await this.persistence.loadLongTermMemory();
      
      // Initialize tier manager with loaded data
      await this.tierManager.initialize({
        longTermMemory,
        scoring: this.scoring
      });
      
      // Initialize stats tracking
      await this.stats.initialize({
        tierManager: this.tierManager,
        services
      });
      
      // Initialize AI usage tracker
      await this.aiTracker.initialize(services);
      
      // Set up periodic memory management
      this.memoryManagementInterval = setInterval(
        () => this.manageMemory().catch(err => {
          logger.error('[MemoryManager] Error during scheduled memory management', err);
        }), 
        60000 // Every minute
      );
      
      // Set up periodic stats update
      this.statsInterval = setInterval(
        () => this.stats.updateMemoryStats().catch(err => {
          logger.error('[MemoryManager] Error during scheduled stats update', err);
        }), 
        60000 // Every minute
      );
      
      this.initialized = true;
      logger.info('[MemoryManager] Initialized successfully');
    } catch (error) {
      const wrappedError = new MemoryError('Failed to initialize memory manager', { cause: error });
      logger.error('[MemoryManager] Initialization error:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Clean up resources and save state before shutdown
   * 
   * @async
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      logger.info('[MemoryManager] Shutting down');
      
      if (this.memoryManagementInterval) {
        clearInterval(this.memoryManagementInterval);
      }
      
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
      }
      
      // Save long-term memory before shutdown
      await this.persistence.saveLongTermMemory(this.tierManager.getLongTermMemory());
      
      // Save AI stats before shutdown
      await this.aiTracker.saveStats();
      
      this.initialized = false;
      logger.info('[MemoryManager] Shutdown complete');
    } catch (error) {
      logger.error('[MemoryManager] Error during shutdown:', error);
      // We don't throw here as we're shutting down anyway
    }
  }
  
  /**
   * Add a new context item to memory
   * 
   * @param {Object} item - Context item to add
   * @param {string} item.content - The content of the memory item
   * @returns {Promise<Object>} The enriched item that was added
   * @throws {MemoryError} If the item cannot be added
   */
  async addItem(item) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      if (!item || !item.content) {
        throw new MemoryError('Invalid memory item: missing content');
      }
      
      // Add to working memory via tier manager
      const enrichedItem = await this.tierManager.addItem(item);
      
      // Update stats
      await this.stats.updateAfterAddingItem(enrichedItem);
      
      return enrichedItem;
    } catch (error) {
      const wrappedError = new MemoryError('Failed to add memory item', { cause: error });
      logger.error('[MemoryManager] Error adding item:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Manage memory tiers - move items between tiers based on relevance
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {MemoryError} If memory management fails
   */
  async manageMemory() {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      logger.info('[MemoryManager] Running memory management');
      
      // Let tier manager handle the promotion/demotion logic
      const changes = await this.tierManager.manageMemoryTiers();
      
      // If there were changes to long-term memory, save it
      if (changes.longTermMemoryChanged) {
        await this.persistence.saveLongTermMemory(this.tierManager.getLongTermMemory());
      }
      
      // Update stats
      await this.stats.updateAfterMemoryManagement();
      
      logger.info('[MemoryManager] Memory management complete', this.stats.getStats());
      return changes;
    } catch (error) {
      const wrappedError = new MemoryError('Failed to manage memory', { cause: error });
      logger.error('[MemoryManager] Error during memory management:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Record that an item was accessed and found useful
   * 
   * @param {string} itemId - ID of the item
   * @param {number} usefulness - How useful the item was (0-10)
   * @returns {Promise<boolean>} Success status
   * @throws {MemoryAccessError} If the item cannot be accessed
   */
  async recordItemUsage(itemId, usefulness = 5) {
    try {
      if (!this.initialized) {
        throw new MemoryAccessError('Memory manager not initialized');
      }
      
      if (!itemId) {
        throw new MemoryAccessError('Invalid item ID');
      }
      
      // Update item usage via tier manager
      const updated = await this.tierManager.recordItemUsage(itemId, usefulness);
      
      // Update stats if item was found and updated
      if (updated) {
        await this.stats.updateAfterItemUsage(itemId, usefulness);
      }
      
      return updated;
    } catch (error) {
      const wrappedError = new MemoryAccessError('Failed to record item usage', { 
        cause: error,
        itemId
      });
      logger.error('[MemoryManager] Error recording item usage:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get the best context for a given command
   * 
   * @param {string} command - The command being processed
   * @param {Object} options - Options for context selection
   * @returns {Promise<Object>} Selected context items
   * @throws {MemoryAccessError} If context cannot be retrieved
   */
  async getContextForCommand(command, options = {}) {
    try {
      if (!this.initialized) {
        throw new MemoryAccessError('Memory manager not initialized');
      }
      
      if (!command) {
        throw new MemoryAccessError('Command is required');
      }
      
      // Get context from tier manager
      const context = await this.tierManager.getContextForCommand(command, options);
      
      // Update stats
      await this.stats.updateAfterContextRetrieval(context);
      
      return context;
    } catch (error) {
      const wrappedError = new MemoryAccessError('Failed to get context for command', { 
        cause: error,
        command
      });
      logger.error('[MemoryManager] Error getting context for command:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get all memory items for UI display
   * 
   * @returns {Promise<Object>} Memory items organized by tier
   * @throws {MemoryAccessError} If items cannot be retrieved
   */
  async getAllMemoryItems() {
    try {
      if (!this.initialized) {
        throw new MemoryAccessError('Memory manager not initialized');
      }
      
      // Get all items from tier manager
      const items = await this.tierManager.getAllMemoryItems();
      
      // Add stats
      return {
        ...items,
        stats: this.stats.getStats()
      };
    } catch (error) {
      const wrappedError = new MemoryAccessError('Failed to get all memory items', { cause: error });
      logger.error('[MemoryManager] Error getting all memory items:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Delete an item from memory
   * 
   * @param {string} itemId - ID of the item to delete
   * @returns {Promise<boolean>} Success status
   * @throws {MemoryAccessError} If the item cannot be deleted
   */
  async deleteItem(itemId) {
    try {
      if (!this.initialized) {
        throw new MemoryAccessError('Memory manager not initialized');
      }
      
      if (!itemId) {
        throw new MemoryAccessError('Invalid item ID');
      }
      
      // Delete item via tier manager
      const deleted = await this.tierManager.deleteItem(itemId);
      
      // Update stats if item was found and deleted
      if (deleted) {
        await this.stats.updateAfterItemDeletion(itemId);
        
        // If the item might have been in long-term memory, save changes
        await this.persistence.saveLongTermMemory(this.tierManager.getLongTermMemory());
      }
      
      return deleted;
    } catch (error) {
      const wrappedError = new MemoryAccessError('Failed to delete memory item', { 
        cause: error,
        itemId
      });
      logger.error('[MemoryManager] Error deleting memory item:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Clear all memory or a specific tier
   * 
   * @param {string} [tier] - Specific tier to clear, or all if not specified
   * @returns {Promise<boolean>} Success status
   * @throws {MemoryError} If memory cannot be cleared
   */
  async clearMemory(tier = null) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      // Clear memory via tier manager
      const cleared = await this.tierManager.clearMemory(tier);
      
      // Update stats
      await this.stats.updateAfterMemoryClear(tier);
      
      // If long-term memory was cleared, update persistent storage
      if (!tier || tier === 'long-term') {
        await this.persistence.saveLongTermMemory([]);
      }
      
      logger.info(`[MemoryManager] Cleared memory${tier ? ` (${tier})` : ''}`);
      return cleared;
    } catch (error) {
      const wrappedError = new MemoryError('Failed to clear memory', { 
        cause: error,
        tier
      });
      logger.error('[MemoryManager] Error clearing memory:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get current memory statistics
   * 
   * @returns {Promise<Object>} Memory statistics
   */
  async getStats() {
    try {
      return this.stats.getStats();
    } catch (error) {
      logger.error('[MemoryManager] Error getting stats:', error);
      return {}; // Return empty object rather than throwing
    }
  }
  
  /**
   * Delete a memory item by ID (compatibility method for IPC handlers)
   * 
   * @param {string} id - The ID of the memory item to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteMemoryItem(id) {
    return this.deleteItem(id);
  }
  
  /**
   * Track AI usage statistics
   * 
   * @param {Object} stats - AI usage statistics
   * @param {number} stats.promptTokens - Number of prompt tokens
   * @param {number} stats.completionTokens - Number of completion tokens
   * @returns {Promise<void>}
   */
  async trackAIUsage(stats) {
    try {
      await this.aiTracker.trackUsage(stats);
    } catch (error) {
      logger.error('[MemoryManager] Error tracking AI usage:', error);
      // Don't throw, as this is non-critical functionality
    }
  }
  
  /**
   * Get AI usage statistics
   * 
   * @returns {Promise<Object>} AI usage statistics
   */
  async getAIStats() {
    try {
      return this.aiTracker.getStats();
    } catch (error) {
      logger.error('[MemoryManager] Error getting AI stats:', error);
      return {}; // Return empty object rather than throwing
    }
  }
}

// Factory function to create a new MemoryManager instance
module.exports = () => new MemoryManager(); 