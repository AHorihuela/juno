const SelectionStrategy = require('./SelectionStrategy');
const AppleScriptExecutor = require('./AppleScriptExecutor');

/**
 * Strategy for getting selected text using clipboard method
 * This is a fallback method that simulates Cmd+C to copy selected text to clipboard
 */
class ClipboardSelectionStrategy extends SelectionStrategy {
  constructor(contextService, timeoutMs = 1000) {
    super('Clipboard');
    this.contextService = contextService;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Get selection using clipboard method
   * @param {string} appName - Name of the active application
   * @returns {Promise<{text: string, success: boolean}>} Selected text and success status
   */
  async getSelection(appName) {
    this.log('Attempting to get selection via clipboard for app:', appName);
    
    // Notify context service we're starting an internal clipboard operation
    this.contextService.startInternalOperation();

    try {
      // Optimization: Use a more efficient AppleScript with better error handling
      const script = `
        tell application "System Events"
          set frontAppName to "${appName}"
          
          -- Save current clipboard
          set prevClipboard to the clipboard
          
          -- Use clipboard method
          try
            tell process frontAppName
              keystroke "c" using command down
            end tell
            
            -- Wait for the clipboard to update, but with a shorter delay
            delay 0.2
            
            -- Get clipboard content
            set selectedText to the clipboard
            
            -- Only restore clipboard if it changed
            if selectedText is not equal to prevClipboard then
              set the clipboard to prevClipboard
            end if
            
            return selectedText
          on error errMsg
            -- Restore clipboard on error
            set the clipboard to prevClipboard
            return ""
          end try
        end tell
      `;

      // Use the AppleScriptExecutor with retry for better reliability
      const result = await AppleScriptExecutor.executeWithRetry(script, {
        timeoutMs: this.timeoutMs,
        retries: 1, // One retry is usually enough for clipboard operations
        retryDelayMs: 200,
        logPrefix: this.name
      });
      
      if (result) {
        this.log('Got selection via clipboard:', {
          length: result.length
        });
        return { text: result, success: true };
      }
      
      this.log('No selection found via clipboard');
      return { text: '', success: false };
    } catch (error) {
      this.logError('Error getting selection via clipboard:', error);
      return { text: '', success: false };
    } finally {
      // Always end internal clipboard operation
      this.contextService.endInternalOperation();
    }
  }
}

module.exports = ClipboardSelectionStrategy; 