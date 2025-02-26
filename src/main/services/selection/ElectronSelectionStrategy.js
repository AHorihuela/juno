const { BrowserWindow } = require('electron');
const SelectionStrategy = require('./SelectionStrategy');

/**
 * Strategy for getting selected text from Electron apps using IPC
 */
class ElectronSelectionStrategy extends SelectionStrategy {
  constructor() {
    super('Electron');
  }

  /**
   * Check if this strategy is applicable for the given app
   * @param {string} appName - Name of the active application
   * @returns {boolean} True if this is an Electron app
   */
  isApplicable(appName) {
    return appName === 'Cursor' || appName === 'Electron' || appName.includes('Electron');
  }

  /**
   * Get selected text from Electron apps using IPC
   * @param {string} appName - Name of the active application
   * @returns {Promise<{text: string, success: boolean}>} Selected text and success status
   */
  async getSelection(appName) {
    this.log('Attempting to get selection from Electron app:', appName);
    
    // Get all windows
    const windows = BrowserWindow.getAllWindows();
    this.log('Found windows:', windows.length);
    
    // Try each focused window first
    for (const window of windows) {
      if (!window.isFocused()) continue;
      
      try {
        const result = await this._getSelectionFromWindow(window);
        if (result.text) {
          return result;
        }
      } catch (error) {
        this.logError('Error getting selection from focused window:', error);
      }
    }
    
    // If no selection found in focused windows, try all windows
    for (const window of windows) {
      if (window.isFocused()) continue; // Skip already tried focused windows
      
      try {
        const result = await this._getSelectionFromWindow(window);
        if (result.text) {
          return result;
        }
      } catch (error) {
        this.logError('Error getting selection from window:', error);
      }
    }
    
    this.log('No selection found in any window');
    return { text: '', success: false };
  }
  
  /**
   * Get selection from a specific browser window
   * @param {BrowserWindow} window - Electron browser window
   * @returns {Promise<{text: string, success: boolean}>} Selected text and success status
   * @private
   */
  async _getSelectionFromWindow(window) {
    try {
      const script = `
        (() => {
          const selection = window.getSelection();
          const text = selection ? selection.toString() : '';
          return text;
        })()
      `;
      
      const result = await window.webContents.executeJavaScript(script);
      
      if (result) {
        this.log('Got selection from window:', {
          hasSelection: true,
          length: result.length
        });
        return { text: result, success: true };
      }
      
      return { text: '', success: false };
    } catch (error) {
      this.logError('Error executing JavaScript in window:', error);
      return { text: '', success: false };
    }
  }
}

module.exports = ElectronSelectionStrategy; 