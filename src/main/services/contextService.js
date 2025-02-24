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
  }

  async _initialize() {
    // Set up clipboard monitoring
    this.checkInterval = setInterval(() => this.checkClipboardChange(), 1000);
  }

  async _shutdown() {
    this.cleanup();
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
      if (currentClipboard !== this.lastSystemClipboard) {
        this.lastSystemClipboard = currentClipboard;
        this.clipboardContent = currentClipboard;
        this.clipboardTimestamp = Date.now();
        console.log('[ContextService] Real clipboard change detected at:', this.clipboardTimestamp);
      }
    } catch (error) {
      this.emitError(error);
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
      console.log('[ContextService] Recording started at:', this.recordingStartTime, 'with highlighted text:', this.highlightedText);
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
        recordingStartTime: this.recordingStartTime
      });

      const context = {
        primaryContext: null,
        secondaryContext: null
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
      }
      // Finally try clipboard if it's fresh
      else if (this.isClipboardFresh()) {
        console.log('[ContextService] Using clipboard as primary context:', this.clipboardContent);
        context.primaryContext = {
          type: 'clipboard',
          content: this.clipboardContent
        };
      }

      console.log('[ContextService] Generated context:', {
        hasPrimaryContext: Boolean(context.primaryContext),
        primaryContextType: context.primaryContext?.type,
        primaryContent: context.primaryContext?.content,
        hasSecondaryContext: Boolean(context.secondaryContext),
        secondaryContextType: context.secondaryContext?.type,
        secondaryContent: context.secondaryContext?.content
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
    } catch (error) {
      this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new ContextService(); 