const { clipboard } = require('electron');

class ContextService {
  constructor() {
    this.clipboardTimestamp = null;
    this.clipboardContent = null;
    this.recordingStartTime = null;
    this.isRecording = false;
  }

  /**
   * Start a new recording session
   */
  startRecording() {
    this.recordingStartTime = Date.now();
    this.isRecording = true;
    console.log('[ContextService] Recording started at:', this.recordingStartTime);
  }

  /**
   * End the current recording session
   */
  stopRecording() {
    this.recordingStartTime = null;
    this.isRecording = false;
    console.log('[ContextService] Recording stopped');
  }

  /**
   * Update clipboard timestamp and content when clipboard changes
   */
  updateClipboardContext() {
    const content = clipboard.readText();
    if (content !== this.clipboardContent) {
      this.clipboardTimestamp = Date.now();
      this.clipboardContent = content;
      console.log('[ContextService] Clipboard updated at:', this.clipboardTimestamp);
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
   * @param {string} highlightedText - Currently highlighted text
   * @returns {Object} Context object with primary and secondary contexts
   */
  getContext(highlightedText = '') {
    this.updateClipboardContext();

    const context = {
      primaryContext: null,
      secondaryContext: null
    };

    // If there's highlighted text, it becomes the primary context
    if (highlightedText) {
      context.primaryContext = {
        type: 'highlight',
        content: highlightedText
      };

      // Fresh clipboard content becomes secondary context if different from highlight
      if (this.isClipboardFresh() && this.clipboardContent !== highlightedText) {
        context.secondaryContext = {
          type: 'clipboard',
          content: this.clipboardContent
        };
      }
    }
    // If no highlight but fresh clipboard, clipboard becomes primary context
    else if (this.isClipboardFresh()) {
      context.primaryContext = {
        type: 'clipboard',
        content: this.clipboardContent
      };
    }

    console.log('[ContextService] Generated context:', {
      hasPrimaryContext: Boolean(context.primaryContext),
      primaryContextType: context.primaryContext?.type,
      hasSecondaryContext: Boolean(context.secondaryContext),
      secondaryContextType: context.secondaryContext?.type
    });

    return context;
  }
}

module.exports = new ContextService(); 