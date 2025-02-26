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

/**
 * Factory function to create a new MemoryManager instance
 * @returns {MemoryManager} A new MemoryManager instance
 */
function memoryManagerFactory() {
  return new MemoryManager();
}

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
    this.aiUsageTracker = new AIUsageTracker();
    
    this.initialized = false;
    this.configService = null;
    this.contextService = null;
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
      
      // Validate required services
      if (!services || !services.config) {
        throw new MemoryError('Config service is required');
      }
      
      if (!services || !services.context) {
        throw new MemoryError('Context service is required');
      }
      
      this.configService = services.config;
      this.contextService = services.context;
      
      // Initialize persistence first (needed for loading data)
      await this.persistence.initialize(services);
      
      // Initialize stats tracking
      this.stats.initialize();
      
      // Initialize AI usage tracker
      await this.aiUsageTracker.initialize(services);
      
      // Load long-term memory from disk
      const longTermMemory = await this.persistence.loadLongTermMemory();
      
      // Initialize tier manager
      this.tierManager.initialize({
        memoryStats: this.stats,
        memoryScoring: this.scoring
      });
      
      // Set memory tiers with loaded data
      if (longTermMemory && longTermMemory.length > 0) {
        this.tierManager.setMemoryTiers([], [], longTermMemory);
      }
      
      this.initialized = true;
      logger.info('[MemoryManager] Initialized successfully');
    } catch (error) {
      const wrappedError = new MemoryError('Failed to initialize memory manager', { cause: error });
      logger.error('[MemoryManager] Initialization error:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Add a memory item
   * 
   * @async
   * @param {Object} content - Content of the memory item
   * @param {Object} [metadata={}] - Metadata for the memory item
   * @returns {Promise<Object>} The added memory item
   * @throws {MemoryError} If the item cannot be added
   */
  async addMemoryItem(content, metadata = {}) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      const item = this.tierManager.addToMemory(content, metadata);
      return item;
    } catch (error) {
      const wrappedError = new MemoryError('Failed to add memory item', { cause: error });
      logger.error('[MemoryManager] Error adding memory item:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get a memory item by ID
   * 
   * @async
   * @param {string} id - ID of the memory item
   * @returns {Promise<Object|null>} The memory item, or null if not found
   * @throws {MemoryError} If the item cannot be retrieved
   */
  async getMemoryItemById(id) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      return this.tierManager.findMemoryItemById(id);
    } catch (error) {
      const wrappedError = new MemoryError('Failed to get memory item', { cause: error });
      logger.error('[MemoryManager] Error getting memory item:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Access a memory item (updates access count and timestamp)
   * 
   * @async
   * @param {string} id - ID of the memory item
   * @returns {Promise<Object|null>} The accessed memory item, or null if not found
   * @throws {MemoryError} If the item cannot be accessed
   */
  async accessMemoryItem(id) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      return this.tierManager.accessMemoryItem(id);
    } catch (error) {
      const wrappedError = new MemoryError('Failed to access memory item', { cause: error });
      logger.error('[MemoryManager] Error accessing memory item:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Delete a memory item
   * 
   * @async
   * @param {string} id - ID of the memory item
   * @returns {Promise<boolean>} True if the item was deleted, false if not found
   * @throws {MemoryError} If the item cannot be deleted
   */
  async deleteMemoryItem(id) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      const deleted = this.tierManager.deleteMemoryItem(id);
      
      if (deleted) {
        // Also remove from context service
        await this.contextService.deleteMemoryItem(id);
      }
      
      return deleted;
    } catch (error) {
      const wrappedError = new MemoryError('Failed to delete memory item', { cause: error });
      logger.error('[MemoryManager] Error deleting memory item:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get all memory items
   * 
   * @async
   * @returns {Promise<Array>} All memory items
   * @throws {MemoryError} If the items cannot be retrieved
   */
  async getAllMemoryItems() {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      return this.tierManager.getAllMemoryItems();
    } catch (error) {
      const wrappedError = new MemoryError('Failed to get all memory items', { cause: error });
      logger.error('[MemoryManager] Error getting all memory items:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get memory items by tier
   * 
   * @async
   * @param {string} tier - Memory tier ('working', 'shortTerm', or 'longTerm')
   * @returns {Promise<Array>} Memory items in the specified tier
   * @throws {MemoryError} If the items cannot be retrieved
   */
  async getMemoryByTier(tier) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      return this.tierManager.getMemoryTier(tier);
    } catch (error) {
      const wrappedError = new MemoryError('Failed to get memory by tier', { cause: error });
      logger.error('[MemoryManager] Error getting memory by tier:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Find memories relevant to a command
   * 
   * @async
   * @param {string} command - The command to find relevant memories for
   * @param {number} [limit=5] - Maximum number of memories to return
   * @returns {Promise<Array>} Relevant memory items
   * @throws {MemoryError} If relevant memories cannot be found
   */
  async findRelevantMemories(command, limit = 5) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      // Get all memory items
      const allItems = this.tierManager.getAllMemoryItems();
      
      if (!allItems || allItems.length === 0) {
        return [];
      }
      
      // Calculate relevance for each item
      const itemsWithRelevance = allItems.map(item => {
        const relevance = this.scoring.calculateRelevanceToCommand(item, command);
        return { ...item, relevance };
      });
      
      // Sort by relevance (descending)
      itemsWithRelevance.sort((a, b) => b.relevance - a.relevance);
      
      // Return the top N items
      return itemsWithRelevance.slice(0, limit);
    } catch (error) {
      const wrappedError = new MemoryError('Failed to find relevant memories', { cause: error });
      logger.error('[MemoryManager] Error finding relevant memories:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Promote a memory item to the next tier
   * 
   * @async
   * @param {string} id - ID of the memory item
   * @returns {Promise<Object|null>} The promoted memory item, or null if not found
   * @throws {MemoryError} If the item cannot be promoted
   */
  async promoteMemoryItem(id) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      return this.tierManager.promoteMemoryItem(id);
    } catch (error) {
      const wrappedError = new MemoryError('Failed to promote memory item', { cause: error });
      logger.error('[MemoryManager] Error promoting memory item:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Demote a memory item to the previous tier
   * 
   * @async
   * @param {string} id - ID of the memory item
   * @returns {Promise<Object|null>} The demoted memory item, or null if not found
   * @throws {MemoryError} If the item cannot be demoted
   */
  async demoteMemoryItem(id) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      return this.tierManager.demoteMemoryItem(id);
    } catch (error) {
      const wrappedError = new MemoryError('Failed to demote memory item', { cause: error });
      logger.error('[MemoryManager] Error demoting memory item:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Clear a memory tier
   * 
   * @async
   * @param {string} tier - Memory tier to clear ('working', 'shortTerm', or 'longTerm')
   * @returns {Promise<void>}
   * @throws {MemoryError} If the tier cannot be cleared
   */
  async clearMemoryTier(tier) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      this.tierManager.clearMemoryTier(tier);
      
      // Also clear from context service
      await this.contextService.clearMemory(tier);
    } catch (error) {
      const wrappedError = new MemoryError('Failed to clear memory tier', { cause: error });
      logger.error('[MemoryManager] Error clearing memory tier:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Clear all memory
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {MemoryError} If memory cannot be cleared
   */
  async clearAllMemory() {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      this.tierManager.clearAllMemory();
      
      // Also clear from context service
      await this.contextService.clearMemory('all');
    } catch (error) {
      const wrappedError = new MemoryError('Failed to clear all memory', { cause: error });
      logger.error('[MemoryManager] Error clearing all memory:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Save memory to disk
   * 
   * @async
   * @returns {Promise<boolean>} Success status
   * @throws {MemoryError} If memory cannot be saved
   */
  async saveMemory() {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      const longTermMemory = this.tierManager.getMemoryTier('longTerm');
      return await this.persistence.saveLongTermMemory(longTermMemory);
    } catch (error) {
      const wrappedError = new MemoryError('Failed to save memory', { cause: error });
      logger.error('[MemoryManager] Error saving memory:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get memory statistics
   * 
   * @async
   * @returns {Promise<Object>} Memory statistics
   * @throws {MemoryError} If statistics cannot be retrieved
   */
  async getMemoryStats() {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      return this.stats.getStats();
    } catch (error) {
      const wrappedError = new MemoryError('Failed to get memory statistics', { cause: error });
      logger.error('[MemoryManager] Error getting memory statistics:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Track AI usage
   * 
   * @async
   * @param {Object} usageData - AI usage data
   * @param {number} usageData.promptTokens - Number of prompt tokens
   * @param {number} usageData.completionTokens - Number of completion tokens
   * @param {string} usageData.model - Model name
   * @returns {Promise<void>}
   * @throws {MemoryError} If usage cannot be tracked
   */
  async trackAIUsage(usageData) {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      await this.aiUsageTracker.trackUsage(usageData);
    } catch (error) {
      const wrappedError = new MemoryError('Failed to track AI usage', { cause: error });
      logger.error('[MemoryManager] Error tracking AI usage:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get AI usage statistics
   * 
   * @async
   * @returns {Promise<Object>} AI usage statistics
   * @throws {MemoryError} If statistics cannot be retrieved
   */
  async getAIUsageStats() {
    try {
      if (!this.initialized) {
        throw new MemoryError('Memory manager not initialized');
      }
      
      return this.aiUsageTracker.getStats();
    } catch (error) {
      const wrappedError = new MemoryError('Failed to get AI usage statistics', { cause: error });
      logger.error('[MemoryManager] Error getting AI usage statistics:', wrappedError);
      throw wrappedError;
    }
  }
}

module.exports = memoryManagerFactory; 