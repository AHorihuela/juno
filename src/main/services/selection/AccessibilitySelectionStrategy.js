const SelectionStrategy = require('./SelectionStrategy');
const AppleScriptExecutor = require('./AppleScriptExecutor');

/**
 * Strategy for getting selected text using macOS Accessibility API
 */
class AccessibilitySelectionStrategy extends SelectionStrategy {
  constructor(timeoutMs = 500) {
    super('Accessibility');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Get selection using macOS Accessibility API
   * @param {string} appName - Name of the active application
   * @returns {Promise<{text: string, success: boolean}>} Selected text and success status
   */
  async getSelection(appName) {
    this.log('Attempting to get selection via accessibility API for app:', appName);
    
    // Optimization: Use a more efficient AppleScript that doesn't create a new process
    const accessibilityScript = `
      tell application "System Events"
        tell process "${appName}"
          try
            set selectedText to value of attribute "AXSelectedText" of first window
            return selectedText
          on error
            return ""
          end try
        end tell
      end tell
    `;
    
    try {
      const result = await AppleScriptExecutor.execute(
        accessibilityScript, 
        this.timeoutMs,
        this.name
      );
      
      if (result) {
        this.log('Got selection via accessibility API:', {
          length: result.length
        });
        return { text: result, success: true };
      }
      
      this.log('No selection found via accessibility API');
      return { text: '', success: false };
    } catch (error) {
      this.logError('Error getting selection via accessibility:', error);
      return { text: '', success: false };
    }
  }
}

module.exports = AccessibilitySelectionStrategy; 