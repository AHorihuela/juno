/**
 * AIContextManager - Manages context for AI interactions
 * 
 * This class handles tracking context usage, calculating context size,
 * and updating usefulness scores for memory items.
 */

class AIContextManager {
  constructor() {
    // Track context usage for feedback
    this.lastContextUsage = {
      hasHighlightedText: false,
      hasClipboardContent: false,
      applicationName: '',
      contextSize: 0,
      timestamp: 0,
      historyItemCount: 0,
      memoryTiersUsed: [],
      relevanceScores: []
    };
  }

  /**
   * Update context usage tracking
   * @param {Object} context - Context object
   * @param {string} highlightedText - Currently highlighted text
   */
  updateContextUsage(context, highlightedText) {
    // Extract memory tiers used and relevance scores
    const memoryTiersUsed = new Set();
    const relevanceScores = [];
    
    // Check primary context
    if (context.primaryContext) {
      if (context.primaryContext.tier) {
        memoryTiersUsed.add(context.primaryContext.tier);
      }
      if (context.primaryContext.relevanceScore) {
        relevanceScores.push({
          type: 'primary',
          score: context.primaryContext.relevanceScore
        });
      }
    }
    
    // Check secondary context
    if (context.secondaryContext) {
      if (context.secondaryContext.tier) {
        memoryTiersUsed.add(context.secondaryContext.tier);
      }
      if (context.secondaryContext.relevanceScore) {
        relevanceScores.push({
          type: 'secondary',
          score: context.secondaryContext.relevanceScore
        });
      }
    }
    
    // Check history context
    if (context.historyContext && Array.isArray(context.historyContext)) {
      for (const item of context.historyContext) {
        if (item.tier) {
          memoryTiersUsed.add(item.tier);
        }
        if (item.relevanceScore) {
          relevanceScores.push({
            type: 'history',
            score: item.relevanceScore
          });
        }
      }
    }
    
    this.lastContextUsage = {
      hasHighlightedText: Boolean(highlightedText),
      hasClipboardContent: Boolean(context.primaryContext?.type === 'clipboard'),
      applicationName: context.applicationContext?.name || '',
      contextSize: this.calculateContextSize(context),
      timestamp: Date.now(),
      historyItemCount: context.historyContext?.length || 0,
      memoryTiersUsed: Array.from(memoryTiersUsed),
      relevanceScores,
      memoryStats: context.memoryStats || null
    };
    
    console.log('[AIContextManager] Updated context usage tracking:', this.lastContextUsage);
  }
  
  /**
   * Update usefulness scores for context items
   * @param {Object} context - Context object
   * @param {boolean} wasSuccessful - Whether the AI request was successful
   */
  updateContextUsefulness(context, wasSuccessful) {
    try {
      // Try to get the memory manager service
      // This is done dynamically to avoid circular dependencies
      const memoryManager = global.serviceRegistry?.get('memoryManager');
      if (!memoryManager) return;
      
      // Base usefulness score - higher if request was successful
      const baseScore = wasSuccessful ? 8 : 3;
      
      // Record usefulness for primary context
      if (context.primaryContext?.id) {
        memoryManager.recordItemUsage(context.primaryContext.id, baseScore);
      }
      
      // Record usefulness for secondary context (slightly lower score)
      if (context.secondaryContext?.id) {
        memoryManager.recordItemUsage(context.secondaryContext.id, Math.max(1, baseScore - 2));
      }
      
      // Record usefulness for history context items (even lower score)
      if (context.historyContext && Array.isArray(context.historyContext)) {
        for (const item of context.historyContext) {
          if (item.id) {
            memoryManager.recordItemUsage(item.id, Math.max(1, baseScore - 4));
          }
        }
      }
      
      console.log('[AIContextManager] Updated context usefulness scores');
    } catch (error) {
      console.error('[AIContextManager] Error updating context usefulness:', error);
    }
  }
  
  /**
   * Calculate the total size of context in characters
   * @param {Object} context - Context object
   * @returns {number} Total context size in characters
   */
  calculateContextSize(context) {
    let size = 0;
    
    if (context.primaryContext?.content) {
      size += context.primaryContext.content.length;
    }
    
    if (context.secondaryContext?.content) {
      size += context.secondaryContext.content.length;
    }
    
    if (context.historyContext) {
      for (const item of context.historyContext) {
        if (item.content) {
          size += item.content.length;
        }
      }
    }
    
    return size;
  }
  
  /**
   * Get the last context usage information
   * @returns {Object} Last context usage information
   */
  getLastContextUsage() {
    return this.lastContextUsage;
  }
  
  /**
   * Get a summary of context usage for user feedback
   * @returns {Object} Context usage summary
   */
  getContextUsageSummary() {
    return {
      ...this.lastContextUsage,
      contextSizeFormatted: this.formatContextSize(this.lastContextUsage.contextSize)
    };
  }
  
  /**
   * Format context size in a human-readable way
   * @param {number} size - Size in characters
   * @returns {string} Formatted size
   */
  formatContextSize(size) {
    if (size < 1000) {
      return `${size} characters`;
    } else {
      return `${(size / 1000).toFixed(1)}K characters`;
    }
  }
  
  /**
   * Format a timestamp in a human-readable way
   * @param {number} timestamp - The timestamp to format
   * @returns {string} A human-readable representation of the timestamp
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return 'unknown time';
    
    const now = Date.now();
    const diffSeconds = Math.floor((now - timestamp) / 1000);
    
    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`;
    } else if (diffSeconds < 3600) {
      return `${Math.floor(diffSeconds / 60)} minutes ago`;
    } else if (diffSeconds < 86400) {
      return `${Math.floor(diffSeconds / 3600)} hours ago`;
    } else {
      return `${Math.floor(diffSeconds / 86400)} days ago`;
    }
  }
}

module.exports = AIContextManager; 