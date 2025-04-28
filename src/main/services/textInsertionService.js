const { clipboard } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const BaseService = require('./BaseService');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('TextInsertionService');

class TextInsertionService extends BaseService {
  constructor() {
    super('TextInsertion');
    this.originalClipboard = null;
    this.isInserting = false;
    
    // Optimization: Cache AppleScript for better performance
    this.applescriptPath = {
      paste: path.join(os.tmpdir(), 'juno_paste.scpt'),
      replaceSelection: path.join(os.tmpdir(), 'juno_replace_selection.scpt')
    };
    
    // Configurable timeouts
    this.timeouts = {
      applescript: 3000,    // ms to wait for AppleScript execution
      clipboardWait: 50,    // ms to wait before clipboard operations
      clipboardRestore: 50  // ms to wait before restoring clipboard
    };
    
    // Fallback options
    this.maxRetries = 2;    // Number of retries on AppleScript failure
  }

  async _initialize() {
    logger.info('Initializing TextInsertionService');
    
    // Create optimized AppleScript files for faster execution
    try {
      await this._createAppleScriptFiles();
      logger.info('AppleScript files created successfully');
    } catch (error) {
      logger.error('Failed to create AppleScript files:', error);
      // Continue initialization, we'll use inline scripts as fallback
    }
  }

  async _shutdown() {
    // Restore clipboard if we were in the middle of an operation
    if (this.originalClipboard !== null) {
      this.restoreClipboard();
    }
    
    // Cleanup temporary files
    this._cleanupAppleScriptFiles();
  }
  
  /**
   * Create optimized AppleScript files for faster execution
   * @private
   */
  async _createAppleScriptFiles() {
    logger.info('Creating AppleScript files for text insertion');
    
    // Script for standard paste operation
    const pasteScript = `
      on run
        tell application "System Events"
          keystroke "v" using command down
        end tell
        return "success"
      end run
    `;
    
    // Script for replacing selected text
    const replaceSelectionScript = `
      on run
        tell application "System Events"
          key code 51 -- Delete key to remove selected text
          delay 0.05
          keystroke "v" using command down
        end tell
        return "success"
      end run
    `;
    
    try {
      // Ensure temp directory exists
      const tempDir = os.tmpdir();
      
      // Log the paths
      logger.debug('AppleScript paths:', {
        metadata: {
          paste: this.applescriptPath.paste,
          replaceSelection: this.applescriptPath.replaceSelection,
          tempDir
        }
      });
      
      // Write scripts to temporary files with more robust error handling
      await Promise.all([
        fs.promises.writeFile(this.applescriptPath.paste, pasteScript)
          .catch(err => {
            logger.error(`Failed to write paste script to ${this.applescriptPath.paste}:`, err);
            throw err;
          }),
        fs.promises.writeFile(this.applescriptPath.replaceSelection, replaceSelectionScript)
          .catch(err => {
            logger.error(`Failed to write replace script to ${this.applescriptPath.replaceSelection}:`, err);
            throw err;
          })
      ]);
      
      // Verify files were created
      const [pasteExists, replaceExists] = await Promise.all([
        fs.promises.access(this.applescriptPath.paste, fs.constants.R_OK)
          .then(() => true)
          .catch(() => false),
        fs.promises.access(this.applescriptPath.replaceSelection, fs.constants.R_OK)
          .then(() => true)
          .catch(() => false)
      ]);
      
      logger.info('AppleScript file creation status:', {
        metadata: {
          pasteExists,
          replaceExists 
        }
      });
      
      if (!pasteExists || !replaceExists) {
        throw new Error('Failed to verify AppleScript files');
      }
      
      logger.info('AppleScript files created successfully');
    } catch (error) {
      logger.error('Failed to create AppleScript files:', error);
      // Continue initialization, we'll use inline scripts as fallback
    }
  }
  
  /**
   * Clean up temporary AppleScript files
   * @private
   */
  _cleanupAppleScriptFiles() {
    try {
      Object.values(this.applescriptPath).forEach(path => {
        if (fs.existsSync(path)) {
          fs.unlinkSync(path);
        }
      });
    } catch (error) {
      logger.error('Error cleaning up AppleScript files:', error);
    }
  }

  /**
   * Save the current clipboard content
   */
  saveClipboard() {
    try {
      logger.debug('Saving original clipboard content');
      this.originalClipboard = clipboard.readText();
      logger.debug('Original clipboard content length:', { 
        metadata: { length: this.originalClipboard?.length || 0 } 
      });
    } catch (error) {
      logger.error('Error saving clipboard:', error);
      this.emitError(error);
    }
  }

  /**
   * Restore the original clipboard content
   */
  restoreClipboard() {
    try {
      logger.debug('Attempting to restore clipboard');
      if (this.originalClipboard !== null) {
        clipboard.writeText(this.originalClipboard);
        logger.debug('Clipboard restored to original content');
        this.originalClipboard = null;
      } else {
        logger.debug('No original clipboard content to restore');
      }
    } catch (error) {
      logger.error('Error restoring clipboard:', error);
      this.emitError(error);
    }
  }
  
  /**
   * Execute AppleScript with timeout protection
   * @param {string} scriptPath - Path to AppleScript file
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<string>} - Script output
   * @private
   */
  _executeAppleScript(scriptPath, timeout = this.timeouts.applescript) {
    return new Promise((resolve, reject) => {
      // Create a timeout handler
      const timeoutId = setTimeout(() => {
        logger.warn('AppleScript execution timed out after', timeout, 'ms');
        reject(new Error(`AppleScript execution timed out after ${timeout}ms`));
      }, timeout);
      
      // Execute the script
      execFile('osascript', [scriptPath], (error, stdout, stderr) => {
        // Clear the timeout
        clearTimeout(timeoutId);
        
        if (error) {
          logger.error('AppleScript execution error:', { 
            metadata: { error, stderr } 
          });
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
  
  /**
   * Execute inline AppleScript (fallback method)
   * @param {string} script - AppleScript code
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<string>} - Script output
   * @private
   */
  _executeInlineAppleScript(script, timeout = this.timeouts.applescript) {
    return new Promise((resolve, reject) => {
      // Create a timeout handler
      const timeoutId = setTimeout(() => {
        logger.warn('Inline AppleScript execution timed out after', timeout, 'ms');
        reject(new Error(`Inline AppleScript execution timed out after ${timeout}ms`));
      }, timeout);
      
      // Execute the script
      execFile('osascript', ['-e', script], (error, stdout, stderr) => {
        // Clear the timeout
        clearTimeout(timeoutId);
        
        if (error) {
          logger.error('Inline AppleScript execution error:', { 
            metadata: { error, stderr } 
          });
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Insert text into the active field
   * @param {string} text - Text to insert
   * @param {string|boolean} replaceHighlight - Text to replace or boolean indicating replacement
   * @returns {Promise<boolean>} - True if insertion was successful
   */
  async insertText(text, replaceHighlight = false) {
    if (!this.initialized) {
      logger.error('TextInsertionService not initialized');
      throw this.emitError(new Error('TextInsertionService not initialized'));
    }

    if (this.isInserting) {
      logger.info('Text insertion already in progress, skipping');
      return false;
    }

    // Normalize text to empty string if falsy
    if (!text) {
      text = '';
      logger.debug('Empty text provided, normalizing to empty string');
    }

    if (process.platform !== 'darwin') {
      logger.error('Text insertion is only supported on macOS');
      throw this.emitError(new Error('Text insertion is only supported on macOS'));
    }

    // Normalize replaceHighlight parameter
    // If it's a string but empty or just whitespace, treat it as false
    // This prevents attempting to replace non-existent selections
    if (typeof replaceHighlight === 'string' && replaceHighlight.trim() === '') {
      replaceHighlight = false;
      logger.debug('Empty highlight string provided, will not attempt replacement');
    }

    logger.info('Starting text insertion', { 
      metadata: {
        textLength: text.length,
        textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        hasHighlight: Boolean(replaceHighlight),
        highlightLength: typeof replaceHighlight === 'string' ? replaceHighlight.length : 0
      }
    });

    this.isInserting = true;
    let retryCount = 0;
    let lastError = null;

    try {
      // Save current clipboard
      logger.debug('Attempting to save current clipboard');
      this.saveClipboard();
      logger.debug('Clipboard saved successfully');

      // For better UX, don't automatically add space (this can be added back if needed)
      const textToInsert = text;

      // Copy new text to clipboard
      logger.debug('Writing new text to clipboard');
      clipboard.writeText(textToInsert);
      
      // Verify clipboard content
      const verifyClipboard = clipboard.readText();
      logger.debug('Clipboard verification', {
        metadata: {
          success: verifyClipboard === textToInsert,
          expectedLength: textToInsert.length,
          actualLength: verifyClipboard.length,
          expectedPreview: textToInsert.substring(0, 30) + '...',
          actualPreview: verifyClipboard.substring(0, 30) + '...'
        }
      });
      
      if (verifyClipboard !== textToInsert) {
        logger.warn('Clipboard verification failed', { 
          metadata: { 
            expected: textToInsert.length,
            actual: verifyClipboard.length
          } 
        });
        // Retry clipboard write once
        logger.debug('Retrying clipboard write');
        clipboard.writeText(textToInsert);
        
        // Verify again
        const secondVerify = clipboard.readText();
        logger.debug('Second clipboard verification', {
          metadata: {
            success: secondVerify === textToInsert,
            expectedLength: textToInsert.length,
            actualLength: secondVerify.length
          }
        });
      }

      // Check if we should actually try to replace selection
      const shouldReplaceSelection = Boolean(replaceHighlight);
      logger.debug('Should replace selection:', shouldReplaceSelection);
      
      // Check if we need to try simpler insertion method first
      const trySimpleInsertionFirst = !shouldReplaceSelection || 
        (typeof replaceHighlight === 'string' && replaceHighlight.length > 1000);
      
      // If highlight is very long or non-existent, prefer simple paste
      if (trySimpleInsertionFirst) {
        logger.debug('Using simple paste method (no replacement)');
      }
      
      // Try multiple insertion methods in sequence until one works
      const methods = [];
      
      // Order methods differently based on whether we're replacing or just inserting
      if (trySimpleInsertionFirst) {
        // For simple insertion, try simple methods first
        methods.push(
          // Method 1: Simple paste via AppleScript
          async () => {
            logger.debug('Trying insertion method 1: Simple paste via AppleScript');
            const scriptPath = this.applescriptPath.paste;
            
            if (!fs.existsSync(scriptPath)) {
              logger.warn('AppleScript file not found:', scriptPath);
              throw new Error('AppleScript file not found: ' + scriptPath);
            }
            
            logger.debug('Executing AppleScript from file:', scriptPath);
            return await this._executeAppleScript(scriptPath);
          },
          
          // Method 2: Inline paste AppleScript
          async () => {
            logger.debug('Trying insertion method 2: Inline paste AppleScript');
            const script = `tell application "System Events" to keystroke "v" using {command down}`;
            logger.debug('Executing inline AppleScript:', script);
            return await this._executeInlineAppleScript(script);
          },
          
          // Method 3: Direct key simulation with delay
          async () => {
            logger.debug('Trying insertion method 3: Direct key simulation with delay');
            const script = `
              delay 0.5
              tell application "System Events"
                keystroke "v" using {command down}
              end tell
            `;
            logger.debug('Executing delayed inline AppleScript');
            return await this._executeInlineAppleScript(script);
          }
        );
      } else {
        // For replacement, try replacement methods first
        methods.push(
          // Method 1: Replace selection via AppleScript
          async () => {
            logger.debug('Trying insertion method 1: Replace selection via AppleScript');
            const scriptPath = this.applescriptPath.replaceSelection;
            
            if (!fs.existsSync(scriptPath)) {
              throw new Error('AppleScript file not found: ' + scriptPath);
            }
            
            return await this._executeAppleScript(scriptPath);
          },
          
          // Method 2: Delete + paste via inline AppleScript
          async () => {
            logger.debug('Trying insertion method 2: Delete + paste via inline AppleScript');
            const script = `
              tell application "System Events"
                key code 51 -- Delete key to remove selected text
                delay 0.1
                keystroke "v" using {command down}
              end tell
            `;
            
            return await this._executeInlineAppleScript(script);
          },
          
          // Method 3: Simple paste fallback
          async () => {
            logger.debug('Trying insertion method 3: Simple paste fallback');
            const script = `tell application "System Events" to keystroke "v" using {command down}`;
            return await this._executeInlineAppleScript(script);
          }
        );
      }
      
      // Try each method until one succeeds
      let success = false;
      let methodIndex = 0;
      
      for (const method of methods) {
        methodIndex++;
        try {
          logger.debug(`Attempting insertion method ${methodIndex}`);
          await method();
          logger.info(`Method ${methodIndex} succeeded`);
          success = true;
          break;
        } catch (error) {
          logger.error(`Method ${methodIndex} failed:`, { 
            metadata: { 
              error, 
              message: error.message
            } 
          });
          lastError = error;
          // Continue to next method
        }
      }
      
      // Check if we need to restore the clipboard
      if (this.originalClipboard !== null) {
        // Wait a short time to ensure paste completes
        await new Promise(resolve => setTimeout(resolve, this.timeouts.clipboardRestore));
        logger.debug('Attempting to restore clipboard');
        this.restoreClipboard();
        logger.debug('Clipboard restored successfully');
      }
      
      this.isInserting = false;
      
      if (!success) {
        if (lastError) {
          this.emitError(lastError);
          logger.error('All insertion methods failed, last error:', { 
            metadata: { error: lastError }
          });
          return false;
        }
      }
      
      logger.info('Text insertion completed successfully');
      this.emit('text-inserted', { 
        textLength: text.length,
        wasReplacement: shouldReplaceSelection
      });
      
      return true;
    } catch (error) {
      this.isInserting = false;
      
      // Ensure clipboard is restored on error
      try {
        if (this.originalClipboard !== null) {
          this.restoreClipboard();
          logger.debug('Clipboard restored after error');
        }
      } catch (restoreError) {
        logger.error('Error restoring clipboard:', { 
          metadata: { error: restoreError }
        });
      }
      
      logger.error('Error during text insertion:', { 
        metadata: { 
          error, 
          message: error.message,
          stack: error.stack
        }
      });
      
      this.emitError(error);
      return false;
    }
  }

  /**
   * Show a popup with the text and a copy button
   * @param {string} text - Text to show in popup
   */
  showCopyPopup(text) {
    try {
      logger.debug('Showing copy popup');
      this.getService('notification').showNotification({
        title: 'Text Available',
        body: 'Text copied to clipboard. Press Cmd+V to paste.',
        type: 'info'
      });

      clipboard.writeText(text);
      logger.debug('Text copied to clipboard via popup');
    } catch (error) {
      logger.error('Error showing copy popup:', error);
      this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TextInsertionService(); 