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
          set activeApp to name of first application process whose frontmost is true
          
          if activeApp is "TextEdit" then
            tell application "TextEdit"
              if (count of windows) > 0 then
                return selection of front document
              end if
            end tell
          else if activeApp is "Notes" then
            tell application "Notes"
              if (count of windows) > 0 then
                return selected text of front document
              end if
            end tell
          else
            -- Get selected text via clipboard
            set prevClipboard to the clipboard
            keystroke "c" using command down
            delay 0.1
            set selectedText to the clipboard
            set the clipboard to prevClipboard
            return selectedText
          end if
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