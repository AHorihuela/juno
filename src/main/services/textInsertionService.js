const { clipboard } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const BaseService = require('./BaseService');
const LogManager = require('../utils/LogManager');
const pasteLogger = require('../utils/PasteLogger');

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
      applescript: 4000,    // Increased from 3000 to 4000 ms
      clipboardWait: 100,   // Increased from 50 to 100 ms
      clipboardRestore: 100 // Increased from 50 to 100 ms
    };
    
    // Fallback options
    this.maxRetries = 3;    // Increased from 2 to 3
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
    
    // Enhanced script for standard paste operation with delay and retry
    const pasteScript = `
      on run
        set pasteSuccess to false
        set retryCount to 0
        set maxRetries to 3
        
        repeat while not pasteSuccess and retryCount < maxRetries
          try
            tell application "System Events"
              delay 0.1
              keystroke "v" using command down
            end tell
            set pasteSuccess to true
          on error errMsg
            set retryCount to retryCount + 1
            delay 0.2
          end try
        end repeat
        
        if pasteSuccess then
          return "success"
        else
          return "failure"
        end if
      end run
    `;
    
    // Enhanced script for replacing selected text with retry
    const replaceSelectionScript = `
      on run
        set replaceSuccess to false
        set retryCount to 0
        set maxRetries to 3
        
        repeat while not replaceSuccess and retryCount < maxRetries
          try
            tell application "System Events"
              key code 51 -- Delete key to remove selected text
              delay 0.1
              keystroke "v" using command down
            end tell
            set replaceSuccess to true
          on error errMsg
            set retryCount to retryCount + 1
            delay 0.2
          end try
        end repeat
        
        if replaceSuccess then
          return "success"
        else
          return "failure"
        end if
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
      execFile('osascript', [scriptPath], { timeout }, (error, stdout, stderr) => {
        // Clear the timeout
        clearTimeout(timeoutId);
        
        if (error) {
          logger.error('AppleScript execution error:', { 
            metadata: { 
              error: error.message,
              code: error.code,
              signal: error.signal,
              stderr
            } 
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
      execFile('osascript', ['-e', script], { timeout }, (error, stdout, stderr) => {
        // Clear the timeout
        clearTimeout(timeoutId);
        
        if (error) {
          logger.error('Inline AppleScript execution error:', { 
            metadata: { 
              error: error.message,
              code: error.code,
              signal: error.signal,
              stderr
            } 
          });
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Insert text at the current cursor position
   * @param {string} text - Text to insert
   * @param {boolean} replaceHighlight - Whether to replace highlighted text
   * @returns {Promise<boolean>} Success status
   */
  async insertText(text, replaceHighlight = false) {
    // If already inserting, wait for completion
    if (this.isInserting) {
      logger.debug('Another insertion in progress, queueing this insertion');
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
      if (this.isInserting) {
        logger.warn('Previous insertion still in progress after delay, might cause conflicts');
      }
    }

    // Track state during insertion
    this.isInserting = true;
    const startTime = Date.now();
    let success = false;
    let errorNotificationSuppressed = false;

    try {
      logger.info(`Inserting text (${text.length} chars)`);
      
      // Validate text
      if (!text) {
        logger.warn('Empty text provided for insertion');
        return false;
      }

      // IMPORTANT: Save original clipboard content
      this.saveClipboard();
      
      // Wait a moment for clipboard save to complete
      await new Promise(resolve => setTimeout(resolve, this.timeouts.clipboardWait));
      
      // Copy new text to clipboard
      clipboard.writeText(text);
      logger.debug('Text copied to clipboard for insertion');
      
      // Wait for clipboard to update
      await new Promise(resolve => setTimeout(resolve, this.timeouts.clipboardWait));
      
      // Attempt to paste using primary method
      const pastingResult = await this._attemptPaste(replaceHighlight);
      success = pastingResult.success;
      
      // If primary paste failed, try aggressive approach
      if (!success) {
        logger.debug('Primary paste attempt failed, trying aggressive approach');
        const aggressiveResult = await this._attemptPasteAggressive(replaceHighlight);
        success = aggressiveResult.success;
        
        if (!success) {
          logger.warn('All paste attempts failed');
          
          // Show a popup with the text and instructions
          this.showCopyPopup(text);
          
          // Even though actual pasting failed, we're suppressing the error sound
          // since the content is available in clipboard for manual pasting
          errorNotificationSuppressed = true;
        }
      }
      
      // Wait before restoring clipboard
      await new Promise(resolve => setTimeout(resolve, this.timeouts.clipboardRestore));
      
      // Log insertion attempt details
      const duration = Date.now() - startTime;
      if (success) {
        logger.info(`Text insertion successful (${duration}ms)`);
      } else {
        logger.warn(`Text insertion failed, but clipboard contains the text (${duration}ms)`);
      }
      
      return success;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Text insertion error (${duration}ms):`, error);
      
      // Show copy popup as fallback
      this.showCopyPopup(text);
      
      // Return false but suppress the error sound since text is at least in clipboard
      errorNotificationSuppressed = true;
      return false;
    } finally {
      // Always restore the original clipboard, even on errors
      try {
        this.restoreClipboard();
      } catch (clipboardError) {
        logger.error('Error restoring clipboard:', clipboardError);
      }
      
      // Set flag to allow next insertion
      this.isInserting = false;
      
      // Emit event for telemetry
      // Use suppressErrorSound flag to prevent playing error sound for certain cases
      if (success) {
        this.emit('textInserted', { success: true, length: text.length });
      } else {
        this.emit('textInserted', { 
          success: false, 
          length: text.length,
          suppressErrorSound: errorNotificationSuppressed
        });
      }
    }
  }
  
  /**
   * Attempt to paste text using various methods
   * @param {boolean|string} replaceHighlight - Whether to replace highlighted text
   * @returns {Promise<boolean>} Whether any paste method succeeded
   * @private
   */
  async _attemptPaste(replaceHighlight) {
    // Check if we should actually try to replace selection
    const shouldReplaceSelection = Boolean(replaceHighlight);
    logger.debug('Should replace selection:', shouldReplaceSelection);
    pasteLogger.logOperation('PASTE_CONFIG', { 
      shouldReplaceSelection,
      replaceHighlightType: typeof replaceHighlight
    });
    
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
          const script = `tell application "System Events" to keystroke "v" using command down`;
          logger.debug('Executing inline AppleScript:', script);
          return await this._executeInlineAppleScript(script);
        },
        
        // Method 3: Direct key simulation with delay
        async () => {
          logger.debug('Trying insertion method 3: Direct key simulation with delay');
          const script = `
            delay 0.5
            tell application "System Events"
              keystroke "v" using command down
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
            logger.warn('AppleScript file not found:', scriptPath);
            throw new Error('AppleScript file not found: ' + scriptPath);
          }
          
          logger.debug('Executing AppleScript from file:', scriptPath);
          return await this._executeAppleScript(scriptPath);
        },
        
        // Method 2: Delete + paste via inline AppleScript
        async () => {
          logger.debug('Trying insertion method 2: Delete + paste via inline AppleScript');
          const script = `
            tell application "System Events"
              key code 51 -- Delete key to remove selected text
              delay 0.1
              keystroke "v" using command down
            end tell
          `;
          logger.debug('Executing inline AppleScript:', script);
          return await this._executeInlineAppleScript(script);
        },
        
        // Method 3: Simple paste fallback
        async () => {
          logger.debug('Trying insertion method 3: Simple paste fallback');
          const script = `tell application "System Events" to keystroke "v" using command down`;
          logger.debug('Executing inline AppleScript:', script);
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
        pasteLogger.logOperation(`PASTE_METHOD_${methodIndex}`, { start: true });
        await method();
        logger.info(`Method ${methodIndex} succeeded`);
        pasteLogger.logOperation(`PASTE_METHOD_${methodIndex}`, { success: true });
        success = true;
        break;
      } catch (error) {
        logger.error(`Method ${methodIndex} failed:`, { 
          metadata: { 
            error: error.message,
            code: error.code
          } 
        });
        pasteLogger.logOperation(`PASTE_METHOD_${methodIndex}`, { 
          success: false, 
          error: error.message,
          code: error.code
        });
        // Continue to next method
      }
      
      // Short delay between attempts
      await new Promise(resolve => setTimeout(resolve, 200)); // Increased from 100 to 200ms
    }
    
    return { success };
  }

  /**
   * Attempt more aggressive paste methods for fallback
   * @param {boolean|string} replaceHighlight - Whether to replace highlighted text
   * @returns {Promise<boolean>} Whether any paste method succeeded
   * @private
   */
  async _attemptPasteAggressive(replaceHighlight) {
    logger.debug('Attempting aggressive paste methods');
    pasteLogger.logOperation('PASTE_AGGRESSIVE_START', {
      replaceHighlight: Boolean(replaceHighlight)
    });
    
    const methods = [
      // Method 1: Multiple keystrokes with longer delay
      async () => {
        logger.debug('Trying aggressive method 1: Multiple keystrokes with delay');
        const script = `
          delay 1
          tell application "System Events"
            keystroke "v" using command down
            delay 0.3
            keystroke "v" using command down
          end tell
        `;
        return await this._executeInlineAppleScript(script);
      },
      
      // Method 2: Simulate menu paste (more reliable in some apps)
      async () => {
        logger.debug('Trying aggressive method 2: Menu-based paste');
        const script = `
          delay 0.5
          tell application "System Events"
            tell process (name of first process whose frontmost is true)
              try
                click menu item "Paste" of menu "Edit" of menu bar 1
              on error
                keystroke "v" using command down
              end try
            end tell
          end tell
        `;
        return await this._executeInlineAppleScript(script);
      }
    ];
    
    // Try each method until one succeeds
    let success = false;
    let methodIndex = 0;
    
    for (const method of methods) {
      methodIndex++;
      try {
        logger.debug(`Attempting aggressive insertion method ${methodIndex}`);
        pasteLogger.logOperation(`PASTE_AGGRESSIVE_${methodIndex}`, { start: true });
        await method();
        logger.info(`Aggressive method ${methodIndex} succeeded`);
        pasteLogger.logOperation(`PASTE_AGGRESSIVE_${methodIndex}`, { success: true });
        success = true;
        break;
      } catch (error) {
        logger.error(`Aggressive method ${methodIndex} failed:`, { 
          metadata: { 
            error: error.message,
            code: error.code
          } 
        });
        pasteLogger.logOperation(`PASTE_AGGRESSIVE_${methodIndex}`, { 
          success: false, 
          error: error.message,
          code: error.code
        });
        // Continue to next method
      }
      
      // Longer delay between aggressive attempts
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return { success };
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
module.exports = () => new TextInsertionService(); 