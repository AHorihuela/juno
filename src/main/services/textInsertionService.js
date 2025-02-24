const { clipboard } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const BaseService = require('./BaseService');

class TextInsertionService extends BaseService {
  constructor() {
    super('TextInsertion');
    this.originalClipboard = null;
    this.isInserting = false;
  }

  async _initialize() {
    // Nothing to initialize yet
  }

  async _shutdown() {
    // Restore clipboard if we were in the middle of an operation
    if (this.originalClipboard !== null) {
      this.restoreClipboard();
    }
  }

  /**
   * Save the current clipboard content
   */
  saveClipboard() {
    try {
      console.log('[TextInsertion] Saving original clipboard content');
      this.originalClipboard = clipboard.readText();
      console.log('[TextInsertion] Original clipboard content length:', this.originalClipboard?.length || 0);
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Restore the original clipboard content
   */
  restoreClipboard() {
    try {
      console.log('[TextInsertion] Attempting to restore clipboard');
      if (this.originalClipboard !== null) {
        clipboard.writeText(this.originalClipboard);
        console.log('[TextInsertion] Clipboard restored to original content');
        this.originalClipboard = null;
      } else {
        console.log('[TextInsertion] No original clipboard content to restore');
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Insert text into the active field
   * @param {string} text - Text to insert
   * @param {boolean} replaceHighlight - Whether to replace highlighted text
   * @returns {Promise<boolean>} - True if insertion was successful
   */
  async insertText(text, replaceHighlight = false) {
    if (!this.initialized) {
      throw this.emitError(new Error('TextInsertionService not initialized'));
    }

    if (this.isInserting) {
      console.log('[TextInsertion] Text insertion already in progress, skipping');
      return false;
    }

    if (!text) {
      text = '';
    }

    if (process.platform !== 'darwin') {
      throw this.emitError(new Error('Text insertion is only supported on macOS'));
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
        // On macOS, use AppleScript to handle text insertion
        console.log('[TextInsertion] Using AppleScript for text insertion');
        
        // If text is selected, we need to handle it differently
        if (replaceHighlight) {
          const script = `
            tell application "System Events"
              key code 51 -- Delete key to remove selected text
              delay 0.1
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
        } else {
          // No text selected, just paste normally
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
        }
        
        console.log('[TextInsertion] AppleScript paste command executed');
      } else {
        throw this.emitError(new Error('Platform not supported yet'));
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
      this.getService('notification').showNotification(
        'Text Insertion Failed',
        'Click here to copy the text to clipboard',
        'info'
      );

      // Keep text in clipboard for manual pasting (including space)
      const textWithSpace = text ? `${text} ` : '';
      clipboard.writeText(textWithSpace);
      console.log('[TextInsertion] Text kept in clipboard for manual pasting');
      
      this.emitError(error);
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
    try {
      console.log('[TextInsertion] Showing copy popup');
      this.getService('notification').showNotification(
        'Text Available',
        'Click here to copy the text to clipboard',
        'info'
      );
      // Add space when copying to clipboard via popup as well
      const textWithSpace = text ? `${text} ` : '';
      clipboard.writeText(textWithSpace);
      console.log('[TextInsertion] Text copied to clipboard via popup');
    } catch (error) {
      this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TextInsertionService(); 