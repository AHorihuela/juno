const { exec } = require('child_process');
const contextService = require('./contextService');
const { webContents, BrowserWindow, ipcMain } = require('electron');

class SelectionService {
  constructor() {
    // Set up IPC handler for getting selected text from renderer
    ipcMain.handle('get-selected-text-from-renderer', async () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (!focusedWindow) return '';
      
      try {
        const result = await focusedWindow.webContents.executeJavaScript(`
          (() => {
            const selection = window.getSelection();
            const text = selection ? selection.toString() : '';
            console.log('Selected text in renderer:', text);
            return text;
          })()
        `);
        return result || '';
      } catch (error) {
        console.error('[SelectionService] Error getting selection from renderer:', error);
        return '';
      }
    });
  }

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
      console.log('[SelectionService] Starting selection detection');
      
      // First get the active app name
      const appNameScript = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          return name of frontApp
        end tell
      `;
      
      const appName = await new Promise((resolve, reject) => {
        exec(`osascript -e '${appNameScript}'`, (error, stdout, stderr) => {
          if (error) {
            console.error('[SelectionService] Error getting app name:', error);
            resolve('');
          } else {
            resolve(stdout.trim());
          }
        });
      });
      
      console.log('[SelectionService] Active application:', appName);

      // If we're in Cursor or another Electron app, use IPC to get selection
      if (appName === 'Cursor') {
        console.log('[SelectionService] Detected Cursor, using IPC for selection');
        
        // Get all windows
        const windows = BrowserWindow.getAllWindows();
        console.log('[SelectionService] Found windows:', windows.length);
        
        // Try each window
        for (const window of windows) {
          if (!window.isFocused()) continue;
          
          try {
            const result = await window.webContents.executeJavaScript(`
              (() => {
                const selection = window.getSelection();
                const text = selection ? selection.toString() : '';
                console.log('Selected text in renderer:', text);
                return text;
              })()
            `);
            
            if (result) {
              console.log('[SelectionService] Got selection from window:', {
                hasSelection: true,
                length: result.length,
                text: result
              });
              return result;
            }
          } catch (error) {
            console.error('[SelectionService] Error getting selection from window:', error);
          }
        }
        
        console.log('[SelectionService] No selection found in any window');
        return '';
      }
      
      // For other apps, use the clipboard method
      console.log('[SelectionService] Using clipboard method for app:', appName);
      
      // Notify context service we're starting an internal clipboard operation
      contextService.startInternalOperation();

      const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set frontAppName to name of frontApp
          
          log "Getting selection from app: " & frontAppName
          
          -- Save current clipboard
          set prevClipboard to the clipboard
          
          -- Use clipboard method for all apps
          tell process frontAppName
            -- First try to get the selection directly if possible
            try
              set selectedText to value of attribute "AXSelectedText" of first window
              if selectedText is not "" then
                return selectedText
              end if
            end try
            
            -- Fallback to clipboard method
            keystroke "c" using command down
          end tell
          
          -- Wait longer for the clipboard to update
          delay 0.3
          
          -- Get clipboard content
          set selectedText to the clipboard
          
          -- Only restore clipboard if it changed
          if selectedText is not equal to prevClipboard then
            set the clipboard to prevClipboard
          end if
          
          return selectedText
        end tell
      `;

      console.log('[SelectionService] Executing AppleScript for selection');
      
      const result = await new Promise((resolve, reject) => {
        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
          if (error) {
            console.error('[SelectionService] Error getting selected text:', error);
            resolve('');
          } else if (stderr) {
            console.warn('[SelectionService] AppleScript warning:', stderr);
          }
          
          const selectedText = stdout.trim();
          console.log('[SelectionService] Raw selected text length:', selectedText.length);
          
          resolve(selectedText);
        });
      });

      // End internal clipboard operation
      contextService.endInternalOperation();
      
      console.log('[SelectionService] Selection detection completed:', {
        hasSelection: Boolean(result),
        selectionLength: result.length
      });

      return result;
    } catch (error) {
      console.error('[SelectionService] Failed to get selected text:', error);
      // Make sure to end internal operation even if there's an error
      contextService.endInternalOperation();
      return '';
    }
  }
}

module.exports = new SelectionService(); 