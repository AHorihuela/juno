/**
 * SimpleMemoryManager - A simplified memory management system
 * 
 * This class provides basic memory management functionality without the complexity
 * of the full memory tier system. It maintains a single list of memory items and
 * provides methods to add, retrieve, and delete items.
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const BaseService = require('../BaseService');
const logger = require('../../utils/logger');

class SimpleMemoryManager extends BaseService {
  /**
   * Creates a new SimpleMemoryManager instance
   * @constructor
   */
  constructor() {
    super('SimpleMemoryManager');
    
    // Initialize memory storage
    this.memory = [];
    this.maxItems = 100;
    
    // Stats tracking
    this.stats = {
      totalItems: 0,
      addedItems: 0,
      deletedItems: 0,
      lastCleared: null,
      lastSaved: null
    };
    
    // File storage
    this.storageDir = null;
    this.memoryFile = null;
  }
  
  /**
   * Initialize the memory manager
   * 
   * @async
   * @param {Object} services - Service container for dependency injection
   * @returns {Promise<void>}
   */
  async _initialize(services) {
    try {
      logger.info('[SimpleMemoryManager] Starting initialization');
      
      // Set up storage directory
      this.storageDir = path.join(app.getPath('userData'), 'memory');
      this.memoryFile = path.join(this.storageDir, 'memory.json');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        logger.info(`[SimpleMemoryManager] Created storage directory: ${this.storageDir}`);
      }
      
      // Load memory from disk
      await this.loadMemory();
      
      logger.info('[SimpleMemoryManager] Initialized successfully');
    } catch (error) {
      logger.error('[SimpleMemoryManager] Initialization error:', error);
      throw error;
    }
  }
  
  /**
   * Load memory from disk
   * 
   * @async
   * @returns {Promise<void>}
   */
  async loadMemory() {
    try {
      if (!fs.existsSync(this.memoryFile)) {
        logger.info('[SimpleMemoryManager] Memory file not found, starting with empty memory');
        this.memory = [];
        return;
      }
      
      const data = fs.readFileSync(this.memoryFile, 'utf8');
      this.memory = JSON.parse(data);
      this.stats.totalItems = this.memory.length;
      
      logger.info(`[SimpleMemoryManager] Loaded ${this.memory.length} memory items`);
    } catch (error) {
      logger.error('[SimpleMemoryManager] Error loading memory:', error);
      this.memory = [];
    }
  }
  
  /**
   * Save memory to disk
   * 
   * @async
   * @returns {Promise<boolean>} Success status
   */
  async saveMemory() {
    try {
      fs.writeFileSync(this.memoryFile, JSON.stringify(this.memory, null, 2), 'utf8');
      this.stats.lastSaved = Date.now();
      
      logger.info(`[SimpleMemoryManager] Saved ${this.memory.length} memory items`);
      return true;
    } catch (error) {
      logger.error('[SimpleMemoryManager] Error saving memory:', error);
      return false;
    }
  }
  
  /**
   * Add a memory item
   * 
   * @async
   * @param {Object} content - Content of the memory item
   * @param {Object} [metadata={}] - Metadata for the memory item
   * @returns {Promise<Object>} The added memory item
   */
  async addMemoryItem(content, metadata = {}) {
    try {
      // Create the memory item
      const item = {
        id: uuidv4(),
        content,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        ...metadata
      };
      
      // Add to memory
      this.memory.unshift(item);
      
      // Enforce maximum items limit
      if (this.memory.length > this.maxItems) {
        this.memory = this.memory.slice(0, this.maxItems);
      }
      
      // Update stats
      this.stats.totalItems = this.memory.length;
      this.stats.addedItems++;
      
      // Save to disk periodically (every 10 items)
      if (this.stats.addedItems % 10 === 0) {
        this.saveMemory();
      }
      
      logger.info(`[SimpleMemoryManager] Added item: ${item.id}`);
      return item;
    } catch (error) {
      logger.error('[SimpleMemoryManager] Error adding item:', error);
      throw error;
    }
  }
  
  /**
   * Get a memory item by ID
   * 
   * @async
   * @param {string} id - ID of the memory item
   * @returns {Promise<Object|null>} The memory item, or null if not found
   */
  async getMemoryItemById(id) {
    try {
      const item = this.memory.find(item => item.id === id);
      
      if (item) {
        // Update access stats
        item.lastAccessed = Date.now();
        item.accessCount++;
      }
      
      return item || null;
    } catch (error) {
      logger.error('[SimpleMemoryManager] Error getting item:', error);
      return null;
    }
  }
  
  /**
   * Delete a memory item
   * 
   * @async
   * @param {string} id - ID of the memory item
   * @returns {Promise<boolean>} True if the item was deleted, false if not found
   */
  async deleteItem(id) {
    try {
      const initialLength = this.memory.length;
      this.memory = this.memory.filter(item => item.id !== id);
      
      const deleted = initialLength > this.memory.length;
      
      if (deleted) {
        // Update stats
        this.stats.totalItems = this.memory.length;
        this.stats.deletedItems++;
        
        logger.info(`[SimpleMemoryManager] Deleted item: ${id}`);
      }
      
      return deleted;
    } catch (error) {
      logger.error('[SimpleMemoryManager] Error deleting item:', error);
      return false;
    }
  }
  
  /**
   * Get all memory items
   * 
   * @async
   * @returns {Promise<Array>} All memory items
   */
  async getAllMemoryItems() {
    return [...this.memory];
  }
  
  /**
   * Find memories relevant to a command
   * 
   * @async
   * @param {string} command - The command to find relevant memories for
   * @param {number} [limit=5] - Maximum number of items to return
   * @returns {Promise<Array>} Relevant memory items
   */
  async findRelevantMemories(command, limit = 5) {
    try {
      if (!command || typeof command !== 'string') {
        return [];
      }
      
      // Simple relevance calculation based on text matching
      // In a real implementation, you might want to use more sophisticated
      // techniques like embeddings or semantic search
      const commandWords = command.toLowerCase().split(/\s+/);
      
      // Score each memory item based on word overlap
      const scoredItems = this.memory.map(item => {
        const content = typeof item.content === 'string' 
          ? item.content 
          : JSON.stringify(item.content);
        
        const contentLower = content.toLowerCase();
        let score = 0;
        
        // Count matching words
        for (const word of commandWords) {
          if (word.length > 3 && contentLower.includes(word)) {
            score += 1;
          }
        }
        
        // Boost score for recently accessed items
        if (item.lastAccessed) {
          const hoursSinceAccess = (Date.now() - item.lastAccessed) / (1000 * 60 * 60);
          if (hoursSinceAccess < 24) {
            score += 0.5;
          }
        }
        
        // Boost score for frequently accessed items
        if (item.accessCount > 0) {
          score += Math.min(item.accessCount / 10, 0.5);
        }
        
        return { ...item, relevanceScore: score };
      });
      
      // Sort by relevance score (descending)
      scoredItems.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      // Return top N items with non-zero relevance
      return scoredItems
        .filter(item => item.relevanceScore > 0)
        .slice(0, limit);
    } catch (error) {
      logger.error('[SimpleMemoryManager] Error finding relevant memories:', error);
      return [];
    }
  }
  
  /**
   * Clear all memory
   * 
   * @async
   * @returns {Promise<boolean>} Success status
   */
  async clearAllMemory() {
    try {
      this.memory = [];
      this.stats.totalItems = 0;
      this.stats.lastCleared = Date.now();
      
      // Save empty memory to disk
      await this.saveMemory();
      
      logger.info('[SimpleMemoryManager] Cleared all memory');
      return true;
    } catch (error) {
      logger.error('[SimpleMemoryManager] Error clearing memory:', error);
      return false;
    }
  }
  
  /**
   * Get memory statistics
   * 
   * @returns {Object} Memory statistics
   */
  getMemoryStats() {
    return {
      ...this.stats,
      currentSize: this.memory.length,
      maxSize: this.maxItems
    };
  }
}

module.exports = SimpleMemoryManager; 