/**
 * ContextRetrieval - Strategies for retrieving context
 * 
 * This class provides different strategies for retrieving context
 * based on the available sources (memory manager, history, clipboard, etc.)
 */

class ContextRetrieval {
  /**
   * Creates a new ContextRetrieval instance
   * @param {Object} options - Configuration options
   * @param {Object} options.clipboardManager - ClipboardManager instance
   * @param {Object} options.contextHistory - ContextHistory instance
   * @param {Object} options.memoryManager - MemoryManager instance (optional)
   */
  constructor(options = {}) {
    this.clipboardManager = options.clipboardManager;
    this.contextHistory = options.contextHistory;
    this.memoryManager = options.memoryManager;
    this.activeApplication = '';
    
    // Cache settings
    this.contextCache = null;
    this.contextCacheTTL = options.contextCacheTTL || 2000; // 2 seconds
    this.lastContextCacheTime = 0;
  }

  /**
   * Set the active application name
   * @param {string} appName - Name of the active application
   */
  setActiveApplication(appName) {
    this.activeApplication = appName;
  }

  /**
   * Invalidate the context cache
   */
  invalidateContextCache() {
    this.contextCache = null;
    this.lastContextCacheTime = 0;
    console.log('[ContextRetrieval] Context cache invalidated');
  }

  /**
   * Get context using the memory manager
   * @param {string} currentHighlightedText - Currently highlighted text
   * @param {string} command - Command for context-specific retrieval
   * @param {number} recordingStartTime - Optional recording start time
   * @param {string} recordingHighlightedText - Text highlighted when recording started
   * @returns {Promise<Object>} Context object with primary and secondary contexts
   */
  async getContextFromMemoryManager(currentHighlightedText, command, recordingStartTime, recordingHighlightedText) {
    // Add current highlighted text to memory if it's substantial
    if (currentHighlightedText && currentHighlightedText.length > 10) {
      try {
        await this.memoryManager.addMemoryItem(currentHighlightedText, {
          source: 'highlighted_text',
          application: this.activeApplication,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('[ContextRetrieval] Error adding current highlighted text to memory:', err);
      }
    }
    
    // Get relevant memories from memory manager
    let relevantMemories = [];
    try {
      relevantMemories = await this.memoryManager.findRelevantMemories(command, 5);
    } catch (err) {
      console.error('[ContextRetrieval] Error finding relevant memories:', err);
    }
    
    const context = {
      primaryContext: null,
      secondaryContext: null,
      applicationContext: this.activeApplication ? { name: this.activeApplication } : null,
      historyContext: [],
      memoryStats: await this.memoryManager.getMemoryStats()
    };
    
    // Use the most relevant memory as primary context
    if (relevantMemories.length > 0) {
      context.primaryContext = {
        type: relevantMemories[0].source || 'memory',
        content: relevantMemories[0].content,
        relevanceScore: relevantMemories[0].relevanceScore
      };
      
      // Use the second most relevant memory as secondary context
      if (relevantMemories.length > 1) {
        context.secondaryContext = {
          type: relevantMemories[1].source || 'memory',
          content: relevantMemories[1].content,
          relevanceScore: relevantMemories[1].relevanceScore
        };
      }
      
      // Add additional context items to history context
      if (relevantMemories.length > 2) {
        context.historyContext = relevantMemories.slice(2).map(item => ({
          type: item.source || 'memory',
          content: item.content,
          relevanceScore: item.relevanceScore
        }));
      }
    }
    
    // If we still don't have primary context, fall back to current highlighted text or clipboard
    if (!context.primaryContext) {
      if (currentHighlightedText) {
        context.primaryContext = {
          type: 'highlight',
          content: currentHighlightedText
        };
      } else if (recordingHighlightedText) {
        context.primaryContext = {
          type: 'highlight',
          content: recordingHighlightedText
        };
      } else {
        const clipboardData = this.clipboardManager.getCurrentContent();
        if (clipboardData.isFresh) {
          context.primaryContext = {
            type: 'clipboard',
            content: clipboardData.content
          };
        }
      }
    }
    
    console.log('[ContextRetrieval] Generated context from memory manager:', {
      hasPrimaryContext: Boolean(context.primaryContext),
      primaryContextType: context.primaryContext?.type,
      primaryContentLength: context.primaryContext?.content?.length,
      primaryRelevanceScore: context.primaryContext?.relevanceScore,
      hasSecondaryContext: Boolean(context.secondaryContext),
      secondaryContextType: context.secondaryContext?.type,
      secondaryRelevanceScore: context.secondaryContext?.relevanceScore,
      additionalContextItems: context.historyContext?.length
    });
    
    return context;
  }
  
  /**
   * Get context using the legacy approach
   * @param {string} currentHighlightedText - Currently highlighted text
   * @param {string} recordingHighlightedText - Text highlighted when recording started
   * @param {number} recordingStartTime - Optional recording start time
   * @returns {Object} Context object with primary and secondary contexts
   */
  getLegacyContext(currentHighlightedText, recordingHighlightedText, recordingStartTime) {
    const historyItems = this.contextHistory.getAll();
    
    const context = {
      primaryContext: null,
      secondaryContext: null,
      applicationContext: this.activeApplication ? { name: this.activeApplication } : null,
      historyContext: historyItems.length > 0 ? historyItems.slice(0, 2) : null
    };

    // First try the text that was highlighted when recording started
    if (recordingHighlightedText) {
      console.log('[ContextRetrieval] Using recording-start highlighted text as primary context:', recordingHighlightedText);
      context.primaryContext = {
        type: 'highlight',
        content: recordingHighlightedText
      };
    }
    // Then try currently highlighted text if different
    else if (currentHighlightedText && currentHighlightedText !== recordingHighlightedText) {
      console.log('[ContextRetrieval] Using current highlighted text as primary context:', currentHighlightedText);
      context.primaryContext = {
        type: 'highlight',
        content: currentHighlightedText
      };
      
      // Add to context history if not too similar to existing items
      if (!this.contextHistory.isSimilarToExisting(currentHighlightedText, 'highlight')) {
        this.contextHistory.addItem({
          type: 'highlight',
          content: currentHighlightedText,
          timestamp: Date.now(),
          application: this.activeApplication
        });
      }
    }
    // Finally try clipboard if it's fresh
    else {
      const clipboardData = this.clipboardManager.getCurrentContent();
      if (clipboardData.isFresh) {
        console.log('[ContextRetrieval] Using clipboard as primary context:', clipboardData.content);
        context.primaryContext = {
          type: 'clipboard',
          content: clipboardData.content
        };
      }
    }
    
    // If we have context history but no primary context, use the most recent history item
    if (!context.primaryContext && historyItems.length > 0) {
      const mostRecent = historyItems[0];
      console.log('[ContextRetrieval] Using most recent history item as primary context:', mostRecent);
      context.primaryContext = {
        type: mostRecent.type,
        content: mostRecent.content
      };
    }
    
    // If we have more history items, use the second most recent as secondary context
    if (historyItems.length > 1 && !context.secondaryContext) {
      const secondMostRecent = historyItems[1];
      console.log('[ContextRetrieval] Using second most recent history item as secondary context:', secondMostRecent);
      context.secondaryContext = {
        type: secondMostRecent.type,
        content: secondMostRecent.content
      };
    }

    console.log('[ContextRetrieval] Generated legacy context:', {
      hasPrimaryContext: Boolean(context.primaryContext),
      primaryContextType: context.primaryContext?.type,
      primaryContentLength: context.primaryContext?.content?.length,
      hasSecondaryContext: Boolean(context.secondaryContext),
      secondaryContextType: context.secondaryContext?.type,
      secondaryContentLength: context.secondaryContext?.content?.length,
      hasApplicationContext: Boolean(context.applicationContext),
      applicationName: context.applicationContext?.name,
      hasHistoryContext: Boolean(context.historyContext),
      historyItemCount: context.historyContext?.length
    });

    return context;
  }
  
  /**
   * Get the current context for AI processing
   * @param {string} currentHighlightedText - Currently highlighted text (optional)
   * @param {string} command - Optional command for context-specific retrieval
   * @param {string} recordingHighlightedText - Text highlighted when recording started
   * @param {number} recordingStartTime - Optional recording start time
   * @returns {Promise<Object>} Context object with primary and secondary contexts
   */
  async getContext(currentHighlightedText = '', command = null, recordingHighlightedText = '', recordingStartTime = null) {
    try {
      // Check if we can use cached context
      const now = Date.now();
      const isCacheValid = this.contextCache && 
                          (now - this.lastContextCacheTime) < this.contextCacheTTL &&
                          !currentHighlightedText && // Don't use cache if new highlighted text is provided
                          !command; // Don't use cache if command-specific context is requested
      
      if (isCacheValid) {
        console.log('[ContextRetrieval] Using cached context');
        return this.contextCache;
      }
      
      // Update clipboard content
      this.clipboardManager.updateClipboardContext();

      console.log('[ContextRetrieval] Getting context with inputs:', {
        recordingHighlightedText,
        currentHighlightedText,
        clipboardContent: this.clipboardManager.clipboardContent?.substring(0, 50) + 
                         (this.clipboardManager.clipboardContent?.length > 50 ? '...' : ''),
        clipboardTimestamp: this.clipboardManager.clipboardTimestamp,
        recordingStartTime,
        activeApplication: this.activeApplication,
        historyItems: this.contextHistory.size(),
        hasCommand: Boolean(command),
        usingMemoryManager: Boolean(this.memoryManager)
      });

      let context;
      
      // If memory manager is available and we have a command, use it for intelligent context selection
      if (this.memoryManager && command) {
        context = await this.getContextFromMemoryManager(
          currentHighlightedText, 
          command, 
          recordingStartTime,
          recordingHighlightedText
        );
      } else {
        // Otherwise use legacy context retrieval
        context = this.getLegacyContext(
          currentHighlightedText,
          recordingHighlightedText,
          recordingStartTime
        );
      }
      
      // Cache the context
      this.contextCache = context;
      this.lastContextCacheTime = Date.now();
      
      return context;
    } catch (error) {
      console.error('[ContextRetrieval] Error getting context:', error);
      return { primaryContext: null, secondaryContext: null };
    }
  }
  
  /**
   * Get context asynchronously with debouncing
   * @param {string} currentHighlightedText - Currently highlighted text (optional)
   * @param {string} command - Optional command for context-specific retrieval
   * @param {string} recordingHighlightedText - Text highlighted when recording started
   * @param {number} recordingStartTime - Optional recording start time
   * @returns {Promise<Object>} Context object with primary and secondary contexts
   */
  async getContextAsync(currentHighlightedText = '', command = null, recordingHighlightedText = '', recordingStartTime = null) {
    // Simple implementation without debouncing for now
    return this.getContext(currentHighlightedText, command, recordingHighlightedText, recordingStartTime);
  }
}

module.exports = ContextRetrieval; 