const { clipboard } = require('electron');
const BaseService = require('./BaseService');

class ContextService extends BaseService {
  constructor() {
    super('Context');
    // Initialize with current clipboard content but no timestamp
    const currentClipboard = clipboard.readText();
    this.lastSystemClipboard = currentClipboard;
    this.clipboardContent = currentClipboard;
    this.clipboardTimestamp = null;  // Start with no timestamp
    
    this.recordingStartTime = null;
    this.isRecording = false;
    this.isInternalClipboardOperation = false;
    this.highlightedText = ''; // Add storage for highlighted text
    this.checkInterval = null;
    
    // Context history for richer context
    this.contextHistory = [];
    this.maxHistoryItems = 5;
    this.activeApplication = '';
    
    // Performance optimizations
    this.contextUpdateInterval = 1000; // 1 second
    this.lastContextUpdate = 0;
    this.pendingContextUpdate = null;
    this.contextCache = null;
    this.contextCacheTTL = 2000; // 2 seconds
    this.lastContextCacheTime = 0;
    
    // Content similarity detection to avoid duplicates
    this.similarityThreshold = 0.8; // 80% similarity threshold
  }

  async _initialize() {
    // Set up clipboard monitoring with optimized interval
    this.checkInterval = setInterval(() => this.checkClipboardChange(), this.contextUpdateInterval);
    
    // Get active application periodically
    this.appCheckInterval = setInterval(() => this.updateActiveApplication(), 5000);
  }

  async _shutdown() {
    this.cleanup();
  }

  /**
   * Update the active application information
   * @private
   */
  async updateActiveApplication() {
    try {
      const selectionService = this.getService('selection');
      if (selectionService) {
        // Use the cached version if available
        this.activeApplication = await selectionService.getCachedActiveAppName();
      }
    } catch (error) {
      console.error('[ContextService] Error updating active application:', error);
    }
  }

  /**
   * Check for real clipboard changes from the system
   * @private
   */
  checkClipboardChange() {
    try {
      // Skip if we're doing internal clipboard operations
      if (this.isInternalClipboardOperation) {
        return;
      }

      const currentClipboard = clipboard.readText();
      if (currentClipboard !== this.lastSystemClipboard && currentClipboard.trim()) {
        this.lastSystemClipboard = currentClipboard;
        this.clipboardContent = currentClipboard;
        this.clipboardTimestamp = Date.now();
        console.log('[ContextService] Real clipboard change detected at:', this.clipboardTimestamp);
        
        // Add to context history if it's substantial (more than just a few characters)
        // and not too similar to existing items
        if (currentClipboard.length > 10 && !this.isSimilarToExistingContext(currentClipboard)) {
          this.addToContextHistory({
            type: 'clipboard',
            content: currentClipboard,
            timestamp: this.clipboardTimestamp,
            application: this.activeApplication
          });
          
          // Invalidate context cache when new content is added
          this.invalidateContextCache();
        }
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Check if content is similar to existing context items
   * @param {string} content - Content to check
   * @returns {boolean} True if similar content exists
   * @private
   */
  isSimilarToExistingContext(content) {
    // Simple implementation: check if any existing item contains this content
    // or if this content contains any existing item
    return this.contextHistory.some(item => {
      // Skip different types
      if (item.type !== 'clipboard') return false;
      
      const itemContent = item.content || '';
      
      // Check if one contains the other
      if (itemContent.includes(content) || content.includes(itemContent)) {
        return true;
      }
      
      // Check similarity using Levenshtein distance for shorter content
      if (content.length < 200 && itemContent.length < 200) {
        return this.calculateSimilarity(content, itemContent) > this.similarityThreshold;
      }
      
      return false;
    });
  }
  
  /**
   * Calculate similarity between two strings (0-1)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   * @private
   */
  calculateSimilarity(str1, str2) {
    // Simple implementation of similarity based on common words
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    // Count common words
    let commonCount = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        commonCount++;
      }
    }
    
    // Calculate Jaccard similarity
    const totalUniqueWords = new Set([...words1, ...words2]).size;
    return totalUniqueWords > 0 ? commonCount / totalUniqueWords : 0;
  }

  /**
   * Add an item to context history
   * @param {Object} contextItem - The context item to add
   * @private
   */
  addToContextHistory(contextItem) {
    // Don't add duplicates
    const isDuplicate = this.contextHistory.some(item => 
      item.type === contextItem.type && item.content === contextItem.content
    );
    
    if (!isDuplicate) {
      // Add to beginning of array
      this.contextHistory.unshift(contextItem);
      
      // Trim history to max size
      if (this.contextHistory.length > this.maxHistoryItems) {
        this.contextHistory = this.contextHistory.slice(0, this.maxHistoryItems);
      }
      
      console.log('[ContextService] Added item to context history, new size:', this.contextHistory.length);
    }
  }

  /**
   * Start an internal clipboard operation
   */
  startInternalOperation() {
    this.isInternalClipboardOperation = true;
  }

  /**
   * End an internal clipboard operation
   */
  endInternalOperation() {
    this.isInternalClipboardOperation = false;
    // Update our last known clipboard state without updating timestamp
    this.lastSystemClipboard = clipboard.readText();
    this.clipboardContent = this.lastSystemClipboard;
  }

  /**
   * Update clipboard content without updating timestamp
   */
  updateClipboardContext() {
    try {
      const content = clipboard.readText();
      if (content !== this.clipboardContent) {
        this.clipboardContent = content;
        this.lastSystemClipboard = content;
        console.log('[ContextService] Clipboard content synced without updating timestamp');
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Start a new recording session and capture highlighted text
   * @param {string} highlightedText - Text highlighted when recording starts
   */
  async startRecording(highlightedText) {
    try {
      this.recordingStartTime = Date.now();
      this.isRecording = true;
      this.highlightedText = highlightedText || '';
      
      // Update active application at recording start
      await this.updateActiveApplication();
      
      console.log('[ContextService] Recording started at:', this.recordingStartTime, 'with highlighted text:', this.highlightedText);
      
      // Add highlighted text to context history if it exists and is not too similar to existing items
      if (this.highlightedText && !this.isSimilarToExistingContext(this.highlightedText)) {
        this.addToContextHistory({
          type: 'highlight',
          content: this.highlightedText,
          timestamp: this.recordingStartTime,
          application: this.activeApplication
        });
        
        // Invalidate context cache when new content is added
        this.invalidateContextCache();
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * End the current recording session
   */
  stopRecording() {
    try {
      this.recordingStartTime = null;
      this.isRecording = false;
      this.highlightedText = ''; // Clear highlighted text
      console.log('[ContextService] Recording stopped');
      
      // Invalidate context cache when recording stops
      this.invalidateContextCache();
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Check if clipboard content is fresh (within 30 seconds or during current recording)
   * @returns {boolean}
   */
  isClipboardFresh() {
    if (!this.clipboardTimestamp) return false;
    if (!this.clipboardContent || this.clipboardContent.trim() === '') return false;

    const now = Date.now();
    const isWithin30Seconds = (now - this.clipboardTimestamp) <= 30000;
    const isDuringRecording = this.isRecording && this.clipboardTimestamp >= this.recordingStartTime;

    console.log('[ContextService] Clipboard freshness check:', {
      isWithin30Seconds,
      isDuringRecording,
      clipboardAge: now - this.clipboardTimestamp,
      isRecording: this.isRecording,
      recordingStartTime: this.recordingStartTime
    });

    return isWithin30Seconds || isDuringRecording;
  }

  /**
   * Invalidate the context cache
   * @private
   */
  invalidateContextCache() {
    this.contextCache = null;
    this.lastContextCacheTime = 0;
    console.log('[ContextService] Context cache invalidated');
  }

  /**
   * Get the current context for AI processing with caching
   * @param {string} currentHighlightedText - Currently highlighted text (optional)
   * @returns {Object} Context object with primary and secondary contexts
   */
  getContext(currentHighlightedText = '') {
    try {
      // Check if we can use cached context
      const now = Date.now();
      const isCacheValid = this.contextCache && 
                          (now - this.lastContextCacheTime) < this.contextCacheTTL &&
                          !currentHighlightedText; // Don't use cache if new highlighted text is provided
      
      if (isCacheValid) {
        console.log('[ContextService] Using cached context');
        return this.contextCache;
      }
      
      // Update clipboard content
      this.updateClipboardContext();

      console.log('[ContextService] Getting context with inputs:', {
        recordingHighlightedText: this.highlightedText,
        currentHighlightedText,
        clipboardContent: this.clipboardContent,
        clipboardTimestamp: this.clipboardTimestamp,
        isRecording: this.isRecording,
        recordingStartTime: this.recordingStartTime,
        activeApplication: this.activeApplication,
        historyItems: this.contextHistory.length
      });

      const context = {
        primaryContext: null,
        secondaryContext: null,
        applicationContext: this.activeApplication ? { name: this.activeApplication } : null,
        historyContext: this.contextHistory.length > 0 ? this.contextHistory.slice(0, 2) : null
      };

      // First try the text that was highlighted when recording started
      if (this.highlightedText) {
        console.log('[ContextService] Using recording-start highlighted text as primary context:', this.highlightedText);
        context.primaryContext = {
          type: 'highlight',
          content: this.highlightedText
        };
      }
      // Then try currently highlighted text if different
      else if (currentHighlightedText && currentHighlightedText !== this.highlightedText) {
        console.log('[ContextService] Using current highlighted text as primary context:', currentHighlightedText);
        context.primaryContext = {
          type: 'highlight',
          content: currentHighlightedText
        };
        
        // Add to context history if not too similar to existing items
        if (!this.isSimilarToExistingContext(currentHighlightedText)) {
          this.addToContextHistory({
            type: 'highlight',
            content: currentHighlightedText,
            timestamp: Date.now(),
            application: this.activeApplication
          });
        }
      }
      // Finally try clipboard if it's fresh
      else if (this.isClipboardFresh()) {
        console.log('[ContextService] Using clipboard as primary context:', this.clipboardContent);
        context.primaryContext = {
          type: 'clipboard',
          content: this.clipboardContent
        };
      }
      
      // If we have context history but no primary context, use the most recent history item
      if (!context.primaryContext && this.contextHistory.length > 0) {
        const mostRecent = this.contextHistory[0];
        console.log('[ContextService] Using most recent history item as primary context:', mostRecent);
        context.primaryContext = {
          type: mostRecent.type,
          content: mostRecent.content
        };
      }
      
      // If we have more history items, use the second most recent as secondary context
      if (this.contextHistory.length > 1 && !context.secondaryContext) {
        const secondMostRecent = this.contextHistory[1];
        console.log('[ContextService] Using second most recent history item as secondary context:', secondMostRecent);
        context.secondaryContext = {
          type: secondMostRecent.type,
          content: secondMostRecent.content
        };
      }

      console.log('[ContextService] Generated context:', {
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
      
      // Cache the context
      this.contextCache = context;
      this.lastContextCacheTime = now;

      return context;
    } catch (error) {
      this.emitError(error);
      return { primaryContext: null, secondaryContext: null };
    }
  }
  
  /**
   * Get context asynchronously with debouncing
   * @param {string} currentHighlightedText - Currently highlighted text (optional)
   * @returns {Promise<Object>} Context object with primary and secondary contexts
   */
  async getContextAsync(currentHighlightedText = '') {
    // Implement debouncing for context updates
    const now = Date.now();
    if (now - this.lastContextUpdate < 500) { // 500ms debounce
      // If we have a pending update, cancel it
      if (this.pendingContextUpdate) {
        clearTimeout(this.pendingContextUpdate.timeoutId);
      }
      
      // Set up a new pending update
      return new Promise((resolve) => {
        this.pendingContextUpdate = {
          timeoutId: setTimeout(() => {
            const context = this.getContext(currentHighlightedText);
            this.pendingContextUpdate = null;
            this.lastContextUpdate = Date.now();
            resolve(context);
          }, 500)
        };
      });
    }
    
    // No debouncing needed, update immediately
    this.lastContextUpdate = now;
    return this.getContext(currentHighlightedText);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    try {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      
      if (this.appCheckInterval) {
        clearInterval(this.appCheckInterval);
        this.appCheckInterval = null;
      }
      
      if (this.pendingContextUpdate) {
        clearTimeout(this.pendingContextUpdate.timeoutId);
        this.pendingContextUpdate = null;
      }
    } catch (error) {
      this.emitError(error);
    }
  }
  
  /**
   * Export context history for persistence
   * @returns {Object} Serializable context history
   */
  exportContextHistory() {
    return {
      history: this.contextHistory,
      timestamp: Date.now()
    };
  }
  
  /**
   * Import context history from persistence
   * @param {Object} data - Previously exported context history
   * @returns {boolean} Success status
   */
  importContextHistory(data) {
    try {
      if (!data || !data.history || !Array.isArray(data.history)) {
        return false;
      }
      
      // Only import history that's less than 24 hours old
      const now = Date.now();
      if (now - data.timestamp > 24 * 60 * 60 * 1000) {
        console.log('[ContextService] Imported history is too old, ignoring');
        return false;
      }
      
      this.contextHistory = data.history;
      console.log('[ContextService] Imported context history, size:', this.contextHistory.length);
      
      // Invalidate context cache
      this.invalidateContextCache();
      
      return true;
    } catch (error) {
      console.error('[ContextService] Error importing context history:', error);
      return false;
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new ContextService(); 