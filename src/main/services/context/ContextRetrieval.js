/**
 * ContextRetrieval - Strategies for retrieving context
 * 
 * This class provides different strategies for retrieving context
 * based on the available sources (history, clipboard, etc.)
 */

class ContextRetrieval {
  /**
   * Creates a new ContextRetrieval instance
   * @param {Object} options - Configuration options
   * @param {Object} options.clipboardManager - ClipboardManager instance
   * @param {Object} options.contextHistory - ContextHistory instance
   */
  constructor(options = {}) {
    this.clipboardManager = options.clipboardManager;
    this.contextHistory = options.contextHistory;
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
        hasCommand: Boolean(command)
      });

      // Use legacy context retrieval
      const context = this.getLegacyContext(
        currentHighlightedText,
        recordingHighlightedText,
        recordingStartTime
      );
      
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