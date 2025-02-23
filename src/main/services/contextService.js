const { clipboard } = require('electron');

class ContextService {
  constructor() {
    // Initialize with current clipboard content but no timestamp
    const currentClipboard = clipboard.readText();
    this.lastSystemClipboard = currentClipboard;
    this.clipboardContent = currentClipboard;
    this.clipboardTimestamp = null;  // Start with no timestamp
    
    this.recordingStartTime = null;
    this.isRecording = false;
    this.isInternalClipboardOperation = false;
    this.highlightedText = ''; // Add storage for highlighted text
    
    // Set up clipboard monitoring
    this.checkInterval = setInterval(() => this.checkClipboardChange(), 1000);
  }

  /**
   * Check for real clipboard changes from the system
   * @private
   */
  checkClipboardChange() {
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
    const content = clipboard.readText();
    if (content !== this.clipboardContent) {
      this.clipboardContent = content;
      this.lastSystemClipboard = content;
      console.log('[ContextService] Clipboard content synced without updating timestamp');
    }
  }

  /**
   * Start a new recording session and capture highlighted text
   * @param {string} highlightedText - Text highlighted when recording starts
   */
  async startRecording(highlightedText) {
    this.recordingStartTime = Date.now();
    this.isRecording = true;
    this.highlightedText = highlightedText || '';
    console.log('[ContextService] Recording started at:', this.recordingStartTime, 'with highlighted text:', this.highlightedText);
  }

  /**
   * End the current recording session
   */
  stopRecording() {
    this.recordingStartTime = null;
    this.isRecording = false;
    this.highlightedText = ''; // Clear highlighted text
    console.log('[ContextService] Recording stopped');
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
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

module.exports = new ContextService(); 