const { clipboard, globalShortcut } = require('electron');
const notificationService = require('./notificationService');

class TextInsertionService {
  constructor() {
    this.originalClipboard = null;
  }

  /**
   * Save the current clipboard content
   */
  saveClipboard() {
    this.originalClipboard = clipboard.readText();
  }

  /**
   * Restore the original clipboard content
   */
  restoreClipboard() {
    if (this.originalClipboard !== null) {
      clipboard.writeText(this.originalClipboard);
      this.originalClipboard = null;
    }
  }

  /**
   * Insert text into the active field
   * @param {string} text - Text to insert
   * @param {boolean} replaceHighlight - Whether to replace highlighted text
   * @returns {boolean} - True if insertion was successful
   */
  async insertText(text, replaceHighlight = false) {
    try {
      // Save current clipboard
      this.saveClipboard();

      // Copy new text to clipboard
      clipboard.writeText(text);

      // Simulate cmd+v using global shortcuts
      // This is more reliable than robotjs on macOS
      const pasteSuccess = await new Promise(resolve => {
        // Register a temporary shortcut for paste
        const success = globalShortcut.register('CommandOrControl+V', () => {
          resolve(true);
        });

        if (!success) {
          resolve(false);
        }

        // Unregister after a short delay
        setTimeout(() => {
          globalShortcut.unregister('CommandOrControl+V');
          resolve(false);
        }, 1000);
      });

      if (!pasteSuccess) {
        throw new Error('Failed to simulate paste command');
      }

      // Wait a bit before restoring clipboard
      await new Promise(resolve => setTimeout(resolve, 100));
      this.restoreClipboard();

      return true;
    } catch (error) {
      console.error('Failed to insert text:', error);
      
      // Show popup with copy button
      notificationService.showNotification(
        'Text Insertion Failed',
        'Click here to copy the text to clipboard',
        'info'
      );

      // Keep text in clipboard for manual pasting
      clipboard.writeText(text);
      
      return false;
    }
  }

  /**
   * Show a popup with the text and a copy button
   * @param {string} text - Text to show in popup
   */
  showCopyPopup(text) {
    notificationService.showNotification(
      'Text Available',
      'Click here to copy the text to clipboard',
      'info'
    );
    clipboard.writeText(text);
  }
}

module.exports = new TextInsertionService(); 