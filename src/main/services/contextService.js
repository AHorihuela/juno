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
  }

  async _initialize() {
    // Set up clipboard monitoring
    this.checkInterval = setInterval(() => this.checkClipboardChange(), 1000);
    
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
        this.activeApplication = await selectionService.getActiveAppName();
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
        if (currentClipboard.length > 10) {
          this.addToContextHistory({
            type: 'clipboard',
            content: currentClipboard,
            timestamp: this.clipboardTimestamp,
            application: this.activeApplication
          });
        }
      }
    } catch (error) {
      this.emitError(error);
    }
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
      
      // Add highlighted text to context history if it exists
      if (this.highlightedText) {
        this.addToContextHistory({
          type: 'highlight',
          content: this.highlightedText,
          timestamp: this.recordingStartTime,
          application: this.activeApplication
        });
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
   * Get the current context for AI processing
   * @param {string} currentHighlightedText - Currently highlighted text (optional)
   * @returns {Object} Context object with primary and secondary contexts
   */
  getContext(currentHighlightedText = '') {
    try {
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
        
        // Add to context history
        this.addToContextHistory({
          type: 'highlight',
          content: currentHighlightedText,
          timestamp: Date.now(),
          application: this.activeApplication
        });
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

      return context;
    } catch (error) {
      this.emitError(error);
      return { primaryContext: null, secondaryContext: null };
    }
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
    } catch (error) {
      this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new ContextService(); 