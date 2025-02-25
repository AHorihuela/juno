const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Manages a multi-tiered memory system for context storage
 */
class MemoryManager {
  constructor() {
    // Memory tiers
    this.workingMemory = []; // Short-lived, high-relevance (last 5 minutes)
    this.shortTermMemory = []; // Current session
    this.longTermMemory = []; // Persistent across sessions
    
    // Configuration
    this.workingMemoryTTL = 5 * 60 * 1000; // 5 minutes
    this.workingMemoryLimit = 10; // Max items in working memory
    this.shortTermMemoryLimit = 50; // Max items in short-term memory
    this.longTermMemoryLimit = 100; // Max items in long-term memory
    
    // Thresholds for promotion/retention
    this.shortTermRetentionThreshold = 50; // Min score to keep in short-term
    this.longTermRetentionThreshold = 70; // Min score to promote to long-term
    
    // Stats for UI
    this.stats = {
      workingMemorySize: 0,
      shortTermMemorySize: 0,
      longTermMemorySize: 0,
      totalItemsProcessed: 0,
      lastMemoryManagementTime: null
    };
    
    // Path for persistent storage
    this.storagePath = '';
    this.initialized = false;

    this.memoryStats = {
      totalItems: 0,
      totalSizeBytes: 0,
      totalSizeMB: 0,
      avgItemSizeKB: 0,
      memoryLimitMB: 100, // Default memory limit in MB
      usagePercentage: 0,
      status: 'Good'
    };
    
    this.aiStats = {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalRequests: 0,
      lastRequestTime: null
    };
  }
  
  /**
   * Initialize the memory manager
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Set up storage path
      const userDataPath = app.getPath('userData');
      this.storagePath = path.join(userDataPath, 'context-memory.json');
      
      // Load long-term memory from disk
      await this.loadLongTermMemory();
      
      // Set up periodic memory management
      this.memoryManagementInterval = setInterval(() => this.manageMemory(), 60000); // Every minute
      
      // Load AI stats if available
      await this.loadAIStats();
      
      // Calculate initial memory stats
      await this.updateMemoryStats();
      
      // Set up periodic memory stats update
      this.statsInterval = setInterval(() => this.updateMemoryStats(), 60000); // Update every minute
      
      this.initialized = true;
      console.log('[MemoryManager] Initialized successfully');
    } catch (error) {
      console.error('[MemoryManager] Initialization error:', error);
    }
  }
  
  /**
   * Clean up resources
   */
  shutdown() {
    if (this.memoryManagementInterval) {
      clearInterval(this.memoryManagementInterval);
    }
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    
    // Save long-term memory before shutdown
    this.saveLongTermMemory().catch(err => {
      console.error('[MemoryManager] Error saving long-term memory during shutdown:', err);
    });
    
    // Save stats before shutdown
    this.saveAIStats();
    
    this.initialized = false;
  }
  
  /**
   * Add a new context item to working memory
   * @param {Object} item - Context item to add
   */
  addItem(item) {
    if (!item || !item.content) return;
    
    // Enrich the item with metadata
    const enrichedItem = this.enrichItem(item);
    
    // Add to working memory
    this.workingMemory.unshift(enrichedItem);
    
    // Trim working memory if needed
    if (this.workingMemory.length > this.workingMemoryLimit) {
      const excessItems = this.workingMemory.splice(this.workingMemoryLimit);
      
      // Consider moving valuable items to short-term memory
      for (const item of excessItems) {
        if (this.calculateItemScore(item) >= this.shortTermRetentionThreshold) {
          this.shortTermMemory.unshift(item);
        }
      }
    }
    
    // Update stats
    this.stats.workingMemorySize = this.workingMemory.length;
    this.stats.shortTermMemorySize = this.shortTermMemory.length;
    this.stats.totalItemsProcessed++;
    
    return enrichedItem;
  }
  
  /**
   * Enrich a context item with additional metadata
   * @param {Object} item - Original context item
   * @returns {Object} Enriched item
   */
  enrichItem(item) {
    return {
      ...item,
      id: `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      usefulnessScore: 0,
      interactionCount: 0,
      tier: 'working' // Start in working memory
    };
  }
  
  /**
   * Calculate a relevance score for an item
   * @param {Object} item - Context item
   * @param {string} [command] - Optional command for context-specific scoring
   * @returns {number} Score from 0-100
   */
  calculateItemScore(item, command = null) {
    if (!item) return 0;
    
    let score = 0;
    const now = Date.now();
    
    // Recency score (max 40 points)
    const ageInMinutes = (now - item.addedAt) / (60 * 1000);
    score += 40 * Math.exp(-0.05 * ageInMinutes); // Exponential decay
    
    // Usage score (max 30 points)
    score += Math.min(30, item.accessCount * 3);
    
    // Usefulness score (max 20 points)
    score += Math.min(20, item.usefulnessScore);
    
    // Size appropriateness (max 10 points)
    const contentLength = item.content?.length || 0;
    const idealSize = 500;
    const sizeFactor = Math.exp(-Math.pow((contentLength - idealSize) / 500, 2));
    score += 10 * sizeFactor;
    
    // Command-specific relevance (if command provided)
    if (command && item.content) {
      // Simple relevance check - do any words in the command appear in the content?
      const commandWords = command.toLowerCase().split(/\s+/);
      const contentLower = item.content.toLowerCase();
      
      let matchCount = 0;
      for (const word of commandWords) {
        if (word.length > 3 && contentLower.includes(word)) {
          matchCount++;
        }
      }
      
      if (matchCount > 0) {
        // Bonus points for command relevance (up to 20)
        const relevanceBonus = Math.min(20, matchCount * 5);
        score += relevanceBonus;
      }
    }
    
    return Math.min(100, Math.max(0, score));
  }
  
  /**
   * Manage memory tiers - move items between tiers based on relevance
   */
  async manageMemory() {
    try {
      const now = Date.now();
      console.log('[MemoryManager] Running memory management');
      
      // Move expired items from working memory to short-term memory
      const expiredWorkingItems = this.workingMemory.filter(
        item => (now - item.addedAt) > this.workingMemoryTTL
      );
      
      for (const item of expiredWorkingItems) {
        const score = this.calculateItemScore(item);
        
        // Only keep items that meet the threshold
        if (score >= this.shortTermRetentionThreshold) {
          item.tier = 'short-term';
          this.shortTermMemory.unshift(item);
        }
      }
      
      // Remove expired items from working memory
      this.workingMemory = this.workingMemory.filter(
        item => (now - item.addedAt) <= this.workingMemoryTTL
      );
      
      // Consider promoting items from short-term to long-term memory
      const promotionCandidates = this.shortTermMemory.filter(
        item => item.accessCount >= 3 || item.usefulnessScore >= 8
      );
      
      for (const item of promotionCandidates) {
        const score = this.calculateItemScore(item);
        
        if (score >= this.longTermRetentionThreshold) {
          item.tier = 'long-term';
          this.longTermMemory.unshift(item);
        }
      }
      
      // Trim short-term memory if needed
      if (this.shortTermMemory.length > this.shortTermMemoryLimit) {
        // Sort by score and keep only the highest scoring items
        this.shortTermMemory.sort((a, b) => 
          this.calculateItemScore(b) - this.calculateItemScore(a)
        );
        this.shortTermMemory = this.shortTermMemory.slice(0, this.shortTermMemoryLimit);
      }
      
      // Trim long-term memory if needed
      if (this.longTermMemory.length > this.longTermMemoryLimit) {
        // Sort by score and keep only the highest scoring items
        this.longTermMemory.sort((a, b) => 
          this.calculateItemScore(b) - this.calculateItemScore(a)
        );
        this.longTermMemory = this.longTermMemory.slice(0, this.longTermMemoryLimit);
      }
      
      // Save long-term memory periodically
      await this.saveLongTermMemory();
      
      // Update stats
      this.stats.workingMemorySize = this.workingMemory.length;
      this.stats.shortTermMemorySize = this.shortTermMemory.length;
      this.stats.longTermMemorySize = this.longTermMemory.length;
      this.stats.lastMemoryManagementTime = now;
      
      console.log('[MemoryManager] Memory management complete', this.stats);
    } catch (error) {
      console.error('[MemoryManager] Error during memory management:', error);
    }
  }
  
  /**
   * Record that an item was accessed and found useful
   * @param {string} itemId - ID of the item
   * @param {number} usefulness - How useful the item was (0-10)
   */
  recordItemUsage(itemId, usefulness = 5) {
    // Update in all memory tiers
    for (const tier of [this.workingMemory, this.shortTermMemory, this.longTermMemory]) {
      const item = tier.find(i => i.id === itemId);
      if (item) {
        item.accessCount++;
        item.lastAccessedAt = Date.now();
        item.usefulnessScore = Math.max(item.usefulnessScore, usefulness);
        break;
      }
    }
  }
  
  /**
   * Get the best context for a given command
   * @param {string} command - The command being processed
   * @param {Object} options - Options for context selection
   * @returns {Object} Selected context items
   */
  getContextForCommand(command, options = {}) {
    const { maxItems = 3, minScore = 30 } = options;
    
    // Combine all memory tiers for scoring
    const allItems = [
      ...this.workingMemory,
      ...this.shortTermMemory,
      ...this.longTermMemory.slice(0, 20) // Limit long-term to recent items
    ];
    
    // Score all items for this command
    const scoredItems = allItems.map(item => ({
      item,
      score: this.calculateItemScore(item, command)
    })).filter(
      // Filter out low-scoring items
      entry => entry.score >= minScore
    ).sort(
      // Sort by score (highest first)
      (a, b) => b.score - a.score
    );
    
    // Take the top N items
    const selectedItems = scoredItems.slice(0, maxItems).map(entry => {
      // Record that this item was accessed
      this.recordItemUsage(entry.item.id);
      
      return {
        ...entry.item,
        relevanceScore: entry.score
      };
    });
    
    console.log(`[MemoryManager] Selected ${selectedItems.length} context items for command`);
    
    return {
      primaryContext: selectedItems[0] || null,
      secondaryContext: selectedItems[1] || null,
      additionalContext: selectedItems.slice(2),
      stats: {
        totalItemsScored: allItems.length,
        itemsAboveThreshold: scoredItems.length
      }
    };
  }
  
  /**
   * Get all memory items for UI display
   * @returns {Object} Memory items organized by tier
   */
  getAllMemoryItems() {
    return {
      working: this.workingMemory.map(item => ({
        ...item,
        score: this.calculateItemScore(item)
      })),
      shortTerm: this.shortTermMemory.map(item => ({
        ...item,
        score: this.calculateItemScore(item)
      })),
      longTerm: this.longTermMemory.map(item => ({
        ...item,
        score: this.calculateItemScore(item)
      })),
      stats: this.stats
    };
  }
  
  /**
   * Save long-term memory to disk
   */
  async saveLongTermMemory() {
    try {
      if (!this.storagePath) return;
      
      const data = {
        items: this.longTermMemory,
        savedAt: Date.now(),
        version: 1
      };
      
      await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2));
      console.log('[MemoryManager] Saved long-term memory to disk');
    } catch (error) {
      console.error('[MemoryManager] Error saving long-term memory:', error);
    }
  }
  
  /**
   * Load long-term memory from disk
   */
  async loadLongTermMemory() {
    try {
      if (!this.storagePath) return;
      
      try {
        const data = await fs.readFile(this.storagePath, 'utf8');
        const parsed = JSON.parse(data);
        
        if (parsed && Array.isArray(parsed.items)) {
          this.longTermMemory = parsed.items;
          this.stats.longTermMemorySize = this.longTermMemory.length;
          console.log(`[MemoryManager] Loaded ${this.longTermMemory.length} items from long-term memory`);
        }
      } catch (readError) {
        // File might not exist yet, which is fine
        if (readError.code !== 'ENOENT') {
          throw readError;
        }
      }
    } catch (error) {
      console.error('[MemoryManager] Error loading long-term memory:', error);
    }
  }
  
  /**
   * Delete an item from memory
   * @param {string} itemId - ID of the item to delete
   * @returns {boolean} Success
   */
  deleteItem(itemId) {
    let deleted = false;
    
    // Remove from all memory tiers
    for (const tier of ['workingMemory', 'shortTermMemory', 'longTermMemory']) {
      const index = this[tier].findIndex(item => item.id === itemId);
      if (index !== -1) {
        this[tier].splice(index, 1);
        deleted = true;
        
        // Update stats
        this.stats[`${tier}Size`] = this[tier].length;
      }
    }
    
    return deleted;
  }
  
  /**
   * Clear all memory
   * @param {string} [tier] - Specific tier to clear, or all if not specified
   */
  clearMemory(tier = null) {
    if (!tier || tier === 'working') {
      this.workingMemory = [];
      this.stats.workingMemorySize = 0;
    }
    
    if (!tier || tier === 'short-term') {
      this.shortTermMemory = [];
      this.stats.shortTermMemorySize = 0;
    }
    
    if (!tier || tier === 'long-term') {
      this.longTermMemory = [];
      this.stats.longTermMemorySize = 0;
      
      // Also clear persistent storage
      this.saveLongTermMemory().catch(console.error);
    }
    
    console.log(`[MemoryManager] Cleared memory${tier ? ` (${tier})` : ''}`);
  }

  /**
   * Update memory statistics based on current context service state
   */
  async updateMemoryStats() {
    try {
      if (!this.contextService) {
        console.warn('[MemoryManager] Context service not available for memory stats update');
        return;
      }

      const memoryStats = await this.contextService.getMemoryStats();
      const items = memoryStats.items || [];
      
      let totalSize = 0;
      items.forEach(item => {
        totalSize += item.size || 0;
      });
      
      this.memoryStats = {
        totalItems: items.length,
        totalSizeBytes: totalSize,
        totalSizeMB: totalSize / (1024 * 1024),
        avgItemSizeKB: items.length > 0 ? (totalSize / items.length) / 1024 : 0,
        memoryLimitMB: this.memoryStats.memoryLimitMB,
        usagePercentage: (totalSize / (this.memoryStats.memoryLimitMB * 1024 * 1024)) * 100,
        status: this.getMemoryStatus(totalSize)
      };
      
      console.debug('[MemoryManager] Memory stats updated', this.memoryStats);
    } catch (error) {
      console.error('[MemoryManager] Error updating memory stats:', error);
    }
  }

  /**
   * Determine memory status based on current usage
   * @param {number} totalSizeBytes - Total memory size in bytes
   * @returns {string} Memory status
   */
  getMemoryStatus(totalSizeBytes) {
    const usagePercentage = (totalSizeBytes / (this.memoryStats.memoryLimitMB * 1024 * 1024)) * 100;
    
    if (usagePercentage < 70) {
      return 'Good';
    } else if (usagePercentage < 90) {
      return 'Warning';
    } else {
      return 'Critical';
    }
  }

  /**
   * Get current memory statistics
   * @returns {Object} Memory statistics
   */
  getStats() {
    return this.memoryStats;
  }

  /**
   * Delete a memory item by ID
   * @param {string} id - The ID of the memory item to delete
   * @returns {boolean} Success status
   */
  async deleteMemoryItem(id) {
    try {
      if (!this.contextService) {
        console.warn('[MemoryManager] Context service not available for memory item deletion');
        return false;
      }

      const result = await this.contextService.deleteMemoryItem(id);
      await this.updateMemoryStats();
      return result;
    } catch (error) {
      console.error('[MemoryManager] Error deleting memory item:', error);
      throw error;
    }
  }

  /**
   * Clear all memory items
   * @returns {boolean} Success status
   */
  async clearMemory() {
    try {
      if (!this.contextService) {
        console.warn('[MemoryManager] Context service not available for memory clearing');
        return false;
      }

      const result = await this.contextService.clearMemory();
      await this.updateMemoryStats();
      return result;
    } catch (error) {
      console.error('[MemoryManager] Error clearing memory:', error);
      throw error;
    }
  }

  /**
   * Track AI usage statistics
   * @param {Object} stats - AI usage statistics
   * @param {number} stats.promptTokens - Number of prompt tokens
   * @param {number} stats.completionTokens - Number of completion tokens
   */
  trackAIUsage(stats) {
    try {
      const { promptTokens = 0, completionTokens = 0 } = stats;
      
      this.aiStats.totalTokens += (promptTokens + completionTokens);
      this.aiStats.promptTokens += promptTokens;
      this.aiStats.completionTokens += completionTokens;
      this.aiStats.totalRequests += 1;
      this.aiStats.lastRequestTime = Date.now();
      
      // Save stats periodically
      this.saveAIStats();
      
      console.debug('[MemoryManager] AI usage tracked', this.aiStats);
    } catch (error) {
      console.error('[MemoryManager] Error tracking AI usage:', error);
    }
  }

  /**
   * Get AI usage statistics
   * @returns {Object} AI usage statistics
   */
  getAIStats() {
    return this.aiStats;
  }

  /**
   * Save AI usage statistics to disk
   */
  async saveAIStats() {
    try {
      if (!this.services || !this.services.get('configService')) {
        console.warn('[MemoryManager] Config service not available for saving AI stats');
        return;
      }
      
      const userDataPath = this.services.get('configService').getUserDataPath();
      const statsPath = path.join(userDataPath, 'ai-stats.json');
      
      await fs.promises.writeFile(statsPath, JSON.stringify(this.aiStats, null, 2));
    } catch (error) {
      console.error('[MemoryManager] Error saving AI stats:', error);
    }
  }

  /**
   * Load AI usage statistics from disk
   */
  async loadAIStats() {
    try {
      if (!this.services || !this.services.get('configService')) {
        console.warn('[MemoryManager] Config service not available for loading AI stats');
        return;
      }
      
      const userDataPath = this.services.get('configService').getUserDataPath();
      const statsPath = path.join(userDataPath, 'ai-stats.json');
      
      if (fs.existsSync(statsPath)) {
        const data = await fs.promises.readFile(statsPath, 'utf8');
        const stats = JSON.parse(data);
        
        this.aiStats = {
          ...this.aiStats,
          ...stats
        };
        
        console.info('[MemoryManager] AI stats loaded from disk');
      }
    } catch (error) {
      console.error('[MemoryManager] Error loading AI stats:', error);
    }
  }
}

module.exports = () => new MemoryManager(); 