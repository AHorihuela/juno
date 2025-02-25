const { exec } = require('child_process');
const { webContents, BrowserWindow, ipcMain } = require('electron');
const BaseService = require('./BaseService');

class SelectionService extends BaseService {
  constructor() {
    super('Selection');
    this.ipcHandler = null;
    this.lastSelectionAttempt = null;
    this.selectionCache = { text: '', timestamp: 0 };
    
    // Performance optimization
    this.appNameCache = { name: '', timestamp: 0 };
    this.appNameCacheTTL = 5000; // 5 seconds
    this.pendingSelectionRequest = null;
    this.selectionDebounceTime = 300; // 300ms
    this.lastSelectionTime = 0;
  }

  async _initialize() {
    // Set up IPC handler for getting selected text from renderer
    this.ipcHandler = async () => {
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
        this.emitError(error);
        return '';
      }
    };

    ipcMain.handle('get-selected-text-from-renderer', this.ipcHandler);
  }

  async _shutdown() {
    if (this.ipcHandler) {
      ipcMain.removeHandler('get-selected-text-from-renderer');
      this.ipcHandler = null;
    }
    
    // Cancel any pending selection requests
    if (this.pendingSelectionRequest) {
      clearTimeout(this.pendingSelectionRequest);
      this.pendingSelectionRequest = null;
    }
  }

  /**
   * Get selected text from the active application with debouncing
   * @returns {Promise<string>} Selected text or empty string if none
   */
  async getSelectedText() {
    // Implement debouncing to prevent rapid consecutive calls
    const now = Date.now();
    if (now - this.lastSelectionTime < this.selectionDebounceTime) {
      console.log('[SelectionService] Debouncing selection request');
      
      // Return cached selection if available and recent
      if (this.selectionCache.text && (now - this.selectionCache.timestamp < 1000)) {
        console.log('[SelectionService] Returning cached selection due to debounce');
        return this.selectionCache.text;
      }
      
      // Set up a debounced request
      return new Promise((resolve) => {
        if (this.pendingSelectionRequest) {
          clearTimeout(this.pendingSelectionRequest);
        }
        
        this.pendingSelectionRequest = setTimeout(async () => {
          const text = await this._getSelectedTextImpl();
          this.pendingSelectionRequest = null;
          resolve(text);
        }, this.selectionDebounceTime);
      });
    }
    
    // Update last selection time
    this.lastSelectionTime = now;
    
    // Proceed with normal selection
    return this._getSelectedTextImpl();
  }
  
  /**
   * Implementation of selection detection
   * @returns {Promise<string>} Selected text or empty string if none
   * @private
   */
  async _getSelectedTextImpl() {
    if (process.platform !== 'darwin') {
      console.log('[SelectionService] Platform not supported for getting selected text');
      return '';
    }

    try {
      console.log('[SelectionService] Starting selection detection');
      
      // First get the active app name (with caching)
      const appName = await this.getCachedActiveAppName();
      console.log('[SelectionService] Active application:', appName);

      // If we're in Cursor or another Electron app, use IPC to get selection
      if (appName === 'Cursor' || appName === 'Electron') {
        return await this.getElectronAppSelection();
      }
      
      // For other apps, try accessibility API first, then fallback to clipboard
      console.log('[SelectionService] Using accessibility API for app:', appName);
      
      // Try to get selection using accessibility API first
      let selectedText = await this.getSelectionViaAccessibility(appName);
      
      // If accessibility API failed, fallback to clipboard method
      if (!selectedText) {
        console.log('[SelectionService] Accessibility API failed, falling back to clipboard method');
        selectedText = await this.getSelectionViaClipboard(appName);
      }
      
      // Cache the selection for potential recovery
      if (selectedText) {
        this.selectionCache = {
          text: selectedText,
          timestamp: Date.now()
        };
      }
      
      console.log('[SelectionService] Selection detection completed:', {
        hasSelection: Boolean(selectedText),
        selectionLength: selectedText?.length || 0
      });

      return selectedText || '';
    } catch (error) {
      console.error('[SelectionService] Failed to get selected text:', error);
      
      // If we have a recent selection cache (within 5 seconds), use it as fallback
      const now = Date.now();
      if (this.selectionCache.text && (now - this.selectionCache.timestamp) < 5000) {
        console.log('[SelectionService] Using cached selection as fallback');
        return this.selectionCache.text;
      }
      
      // Make sure to end internal operation even if there's an error
      this.getService('context').endInternalOperation();
      this.emitError(error);
      return '';
    }
  }

  /**
   * Get the name of the active application with caching
   * @returns {Promise<string>} Name of the active application
   * @private
   */
  async getCachedActiveAppName() {
    const now = Date.now();
    
    // Return cached app name if it's still valid
    if (this.appNameCache.name && (now - this.appNameCache.timestamp) < this.appNameCacheTTL) {
      console.log('[SelectionService] Using cached app name:', this.appNameCache.name);
      return this.appNameCache.name;
    }
    
    // Get fresh app name
    const appName = await this.getActiveAppName();
    
    // Update cache
    this.appNameCache = {
      name: appName,
      timestamp: now
    };
    
    return appName;
  }

  /**
   * Get the name of the active application
   * @returns {Promise<string>} Name of the active application
   * @private
   */
  async getActiveAppName() {
    const appNameScript = `
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        return name of frontApp
      end tell
    `;
    
    return new Promise((resolve, reject) => {
      exec(`osascript -e '${appNameScript}'`, (error, stdout, stderr) => {
        if (error) {
          console.error('[SelectionService] Error getting app name:', error);
          resolve('');
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Get selection from Electron apps using IPC
   * @returns {Promise<string>} Selected text
   * @private
   */
  async getElectronAppSelection() {
    console.log('[SelectionService] Using IPC for selection in Electron app');
    
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
            length: result.length
          });
          return result;
        }
      } catch (error) {
        console.error('[SelectionService] Error getting selection from window:', error);
        this.emitError(error);
      }
    }
    
    console.log('[SelectionService] No selection found in any window');
    return '';
  }

  /**
   * Get selection using macOS Accessibility API
   * @param {string} appName - Name of the active application
   * @returns {Promise<string>} Selected text
   * @private
   */
  async getSelectionViaAccessibility(appName) {
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
    
    return new Promise((resolve, reject) => {
      // Use a timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        console.log('[SelectionService] Accessibility API timed out');
        resolve('');
      }, 500);
      
      exec(`osascript -e '${accessibilityScript}'`, (error, stdout, stderr) => {
        clearTimeout(timeoutId);
        
        if (error) {
          console.error('[SelectionService] Error getting selection via accessibility:', error);
          resolve('');
        } else {
          const selectedText = stdout.trim();
          if (selectedText) {
            console.log('[SelectionService] Got selection via accessibility API:', {
              length: selectedText.length
            });
          }
          resolve(selectedText);
        }
      });
    });
  }

  /**
   * Get selection using clipboard method as fallback
   * @param {string} appName - Name of the active application
   * @returns {Promise<string>} Selected text
   * @private
   */
  async getSelectionViaClipboard(appName) {
    // Notify context service we're starting an internal clipboard operation
    this.getService('context').startInternalOperation();

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

    try {
      console.log('[SelectionService] Executing AppleScript for clipboard selection');
      
      // Use a timeout to prevent hanging
      const result = await Promise.race([
        new Promise((resolve, reject) => {
          exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
            if (error) {
              console.error('[SelectionService] Error getting selected text via clipboard:', error);
              resolve('');
            } else if (stderr) {
              console.warn('[SelectionService] AppleScript warning:', stderr);
            }
            
            const selectedText = stdout.trim();
            console.log('[SelectionService] Raw selected text length via clipboard:', selectedText.length);
            
            resolve(selectedText);
          });
        }),
        new Promise((resolve) => {
          setTimeout(() => {
            console.log('[SelectionService] Clipboard selection timed out');
            resolve('');
          }, 1000);
        })
      ]);

      return result;
    } finally {
      // Always end internal clipboard operation
      this.getService('context').endInternalOperation();
    }
  }
  
  /**
   * Preload app name for better performance in subsequent calls
   * This can be called during app initialization or when user activity is detected
   */
  async preloadAppName() {
    try {
      const appName = await this.getActiveAppName();
      this.appNameCache = {
        name: appName,
        timestamp: Date.now()
      };
      console.log('[SelectionService] Preloaded app name:', appName);
    } catch (error) {
      console.error('[SelectionService] Error preloading app name:', error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new SelectionService(); 