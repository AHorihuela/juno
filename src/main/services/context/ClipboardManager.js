/**
 * ClipboardManager - Manages clipboard monitoring and operations
 * 
 * This class handles monitoring the system clipboard for changes and
 * provides methods for clipboard operations.
 */

const { clipboard } = require('electron');
const EventEmitter = require('events');

class ClipboardManager extends EventEmitter {
  /**
   * Creates a new ClipboardManager instance
   * @param {Object} options - Configuration options
   * @param {number} options.checkInterval - Interval for checking clipboard changes in ms
   */
  constructor(options = {}) {
    super();
    
    // Initialize with current clipboard content but no timestamp
    const currentClipboard = clipboard.readText();
    this.lastSystemClipboard = currentClipboard;
    this.clipboardContent = currentClipboard;
    this.clipboardTimestamp = null;  // Start with no timestamp
    
    this.isInternalClipboardOperation = false;
    this.checkIntervalId = null;
    this.checkIntervalMs = options.checkInterval || 1000; // Default to 1 second
    this.activeApplication = '';
  }

  /**
   * Start monitoring the clipboard for changes
   */
  startMonitoring() {
    if (this.checkIntervalId) {
      this.stopMonitoring();
    }
    
    this.checkIntervalId = setInterval(() => this.checkClipboardChange(), this.checkIntervalMs);
    console.log('[ClipboardManager] Started clipboard monitoring with interval:', this.checkIntervalMs, 'ms');
  }

  /**
   * Stop monitoring the clipboard
   */
  stopMonitoring() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
      console.log('[ClipboardManager] Stopped clipboard monitoring');
    }
  }

  /**
   * Set the active application name
   * @param {string} appName - Name of the active application
   */
  setActiveApplication(appName) {
    this.activeApplication = appName;
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
        
        console.log('[ClipboardManager] Real clipboard change detected at:', this.clipboardTimestamp);
        
        // Emit event with clipboard content and metadata
        this.emit('clipboardChange', {
          content: currentClipboard,
          timestamp: this.clipboardTimestamp,
          application: this.activeApplication
        });
      }
    } catch (error) {
      console.error('[ClipboardManager] Error checking clipboard:', error);
      this.emit('error', error);
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
        console.log('[ClipboardManager] Clipboard content synced without updating timestamp');
      }
    } catch (error) {
      console.error('[ClipboardManager] Error updating clipboard context:', error);
      this.emit('error', error);
    }
  }

  /**
   * Check if clipboard content is fresh (within specified time)
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @param {number} recordingStartTime - Optional recording start time
   * @returns {boolean} True if clipboard is fresh
   */
  isClipboardFresh(maxAgeMs = 30000, recordingStartTime = null) {
    if (!this.clipboardTimestamp) return false;
    if (!this.clipboardContent || this.clipboardContent.trim() === '') return false;

    const now = Date.now();
    const isWithinMaxAge = (now - this.clipboardTimestamp) <= maxAgeMs;
    const isDuringRecording = recordingStartTime && this.clipboardTimestamp >= recordingStartTime;

    console.log('[ClipboardManager] Clipboard freshness check:', {
      isWithinMaxAge,
      isDuringRecording,
      clipboardAge: now - this.clipboardTimestamp,
      recordingStartTime
    });

    return isWithinMaxAge || isDuringRecording;
  }

  /**
   * Get the current clipboard content
   * @returns {Object} Clipboard content and metadata
   */
  getCurrentContent() {
    return {
      content: this.clipboardContent,
      timestamp: this.clipboardTimestamp,
      application: this.activeApplication,
      isFresh: this.isClipboardFresh()
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}

module.exports = ClipboardManager; 