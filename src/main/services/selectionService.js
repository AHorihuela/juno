const { exec } = require('child_process');

class SelectionService {
  /**
   * Get selected text from the active application using AppleScript
   * @returns {Promise<string>} Selected text or empty string if none
   */
  async getSelectedText() {
    if (process.platform !== 'darwin') {
      console.log('[SelectionService] Platform not supported for getting selected text');
      return '';
    }

    try {
      const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set frontAppName to name of frontApp
          
          -- Save current clipboard
          set prevClipboard to the clipboard
          
          -- Use clipboard method for all apps
          tell process frontAppName
            keystroke "c" using command down
          end tell
          
          delay 0.1
          set selectedText to the clipboard
          
          -- Restore clipboard
          set the clipboard to prevClipboard
          
          return selectedText
        end tell
      `;

      return new Promise((resolve, reject) => {
        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
          if (error) {
            console.error('[SelectionService] Error getting selected text:', error);
            resolve('');
          } else {
            resolve(stdout.trim());
          }
        });
      });
    } catch (error) {
      console.error('[SelectionService] Failed to get selected text:', error);
      return '';
    }
  }
}

module.exports = new SelectionService(); 