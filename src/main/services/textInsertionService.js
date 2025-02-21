const { clipboard } = require('electron');
const notificationService = require('./notificationService');
const { exec } = require('child_process');
const path = require('path');

class TextInsertionService {
  constructor() {
    this.originalClipboard = null;
    this.isInserting = false;
  }

  /**
   * Save the current clipboard content
   */
  saveClipboard() {
    console.log('[TextInsertion] Saving original clipboard content');
    this.originalClipboard = clipboard.readText();
    console.log('[TextInsertion] Original clipboard content length:', this.originalClipboard?.length || 0);
  }

  /**
   * Restore the original clipboard content
   */
  restoreClipboard() {
    console.log('[TextInsertion] Attempting to restore clipboard');
    if (this.originalClipboard !== null) {
      clipboard.writeText(this.originalClipboard);
      console.log('[TextInsertion] Clipboard restored to original content');
      this.originalClipboard = null;
    } else {
      console.log('[TextInsertion] No original clipboard content to restore');
    }
  }

  /**
   * Insert text into the active field
   * @param {string} text - Text to insert
   * @param {boolean} replaceHighlight - Whether to replace highlighted text
   * @returns {boolean} - True if insertion was successful
   */
  async insertText(text, replaceHighlight = false) {
    if (this.isInserting) {
      console.log('[TextInsertion] Text insertion already in progress, skipping');
      return false;
    }

    console.log('[TextInsertion] Starting text insertion');
    console.log('[TextInsertion] Text to insert length:', text?.length || 0);
    console.log('[TextInsertion] Replace highlight:', replaceHighlight);

    this.isInserting = true;

    try {
      // Save current clipboard
      this.saveClipboard();

      // Add a space after the text to prevent sentences from running together
      const textWithSpace = text ? `${text} ` : '';

      // Copy new text to clipboard
      console.log('[TextInsertion] Writing new text to clipboard');
      clipboard.writeText(textWithSpace);
      
      // Verify clipboard content
      const verifyClipboard = clipboard.readText();
      console.log('[TextInsertion] Verified clipboard content length:', verifyClipboard?.length || 0);
      console.log('[TextInsertion] Clipboard content matches:', verifyClipboard === textWithSpace);

      if (process.platform === 'darwin') {
        // On macOS, use AppleScript to simulate cmd+v
        console.log('[TextInsertion] Using AppleScript for paste simulation');
        const script = `
          tell application "System Events"
            keystroke "v" using command down
          end tell
        `;
        
        await new Promise((resolve, reject) => {
          exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
            if (error) {
              console.error('[TextInsertion] AppleScript error:', error);
              reject(error);
            } else {
              resolve();
            }
          });
        });
        
        console.log('[TextInsertion] AppleScript paste command executed');
      } else {
        throw new Error('Platform not supported yet');
      }

      // Wait a bit before restoring clipboard
      console.log('[TextInsertion] Waiting before clipboard restore');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.restoreClipboard();
      console.log('[TextInsertion] Text insertion completed successfully');

      return true;
    } catch (error) {
      console.error('[TextInsertion] Failed to insert text:', error);
      console.error('[TextInsertion] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Show popup with copy button
      notificationService.showNotification(
        'Text Insertion Failed',
        'Click here to copy the text to clipboard',
        'info'
      );

      // Keep text in clipboard for manual pasting (including space)
      const textWithSpace = text ? `${text} ` : '';
      clipboard.writeText(textWithSpace);
      console.log('[TextInsertion] Text kept in clipboard for manual pasting');
      
      return false;
    } finally {
      this.isInserting = false;
    }
  }

  /**
   * Show a popup with the text and a copy button
   * @param {string} text - Text to show in popup
   */
  showCopyPopup(text) {
    console.log('[TextInsertion] Showing copy popup');
    notificationService.showNotification(
      'Text Available',
      'Click here to copy the text to clipboard',
      'info'
    );
    // Add space when copying to clipboard via popup as well
    const textWithSpace = text ? `${text} ` : '';
    clipboard.writeText(textWithSpace);
    console.log('[TextInsertion] Text copied to clipboard via popup');
  }
}

module.exports = new TextInsertionService(); 