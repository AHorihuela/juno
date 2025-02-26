/**
 * Main Window Manager for the Juno application.
 * 
 * This class is responsible for managing the main application window, including:
 * - Setting up, showing, hiding, and restoring the main window
 * - Handling window recreation and cleanup
 * 
 * It is used by the WindowManager service to delegate main window-specific functionality,
 * improving separation of concerns and maintainability.
 */

/**
 * MainWindowManager class responsible for managing the main application window
 * @class
 */
class MainWindowManager {
  /**
   * Creates a new MainWindowManager instance
   * @constructor
   * @param {WindowManager} windowManager - The parent WindowManager instance
   */
  constructor(windowManager) {
    this.windowManager = windowManager;
    this.mainWindow = null;
    this.isDev = process.env.NODE_ENV === 'development';
    console.log('[MainWindowManager] Initialized with development mode:', this.isDev);
  }

  /**
   * Set the main application window and configure its properties
   * @param {BrowserWindow} window - The Electron BrowserWindow instance
   */
  setMainWindow(window) {
    try {
      console.log('[MainWindowManager] Setting main window with properties:', {
        id: window.id,
        type: window.type,
      });
      
      this.mainWindow = window;
      
      // Set initial window properties for standard application window
      console.log('[MainWindowManager] Configuring window properties...');
      this.mainWindow.setFullScreenable(false);
      
      // Set specific window type for macOS
      if (process.platform === 'darwin') {
        console.log('[MainWindowManager] Applying macOS-specific settings');
        this.mainWindow.setWindowButtonVisibility(true);
        
        // Ensure window close button only hides the window instead of quitting the app
        this.mainWindow.on('close', (event) => {
          // If app is explicitly quitting, allow the close
          if (require('electron').app.isQuitting) return;
          
          // Otherwise prevent default close behavior
          event.preventDefault();
          
          // Hide the window instead
          this.hideWindow();
          
          // Return false to prevent the window from being closed
          return false;
        });
      }
      
      console.log('[MainWindowManager] Window properties configured successfully');
      
      // Show window initially
      this.mainWindow.show();
      console.log('[MainWindowManager] Window shown initially');

      // Handle DevTools in dev mode
      if (this.isDev) {
        this.mainWindow.webContents.on('devtools-opened', () => {
          console.log('[MainWindowManager] DevTools opened, detaching');
          this.mainWindow.webContents.openDevTools({ mode: 'detach' });
        });
      }
      
      console.log('[MainWindowManager] Window setup completed successfully');
    } catch (error) {
      console.error('[MainWindowManager] Error in setMainWindow:', {
        error: error.message,
        stack: error.stack,
        windowId: window?.id,
      });
      this.windowManager.emitError(error);
    }
  }

  /**
   * Show the main application window and bring it to focus
   */
  showWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[MainWindowManager] Cannot show window - no valid window reference');
        return;
      }
      
      console.log('[MainWindowManager] Showing main window');
      this.mainWindow.show();
      this.mainWindow.focus();
    } catch (error) {
      console.error('[MainWindowManager] Error showing window:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
    }
  }

  /**
   * Hide the main application window
   */
  hideWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[MainWindowManager] Cannot hide window - no valid window reference');
        return;
      }
      
      console.log('[MainWindowManager] Hiding main window');
      this.mainWindow.hide();
    } catch (error) {
      console.error('[MainWindowManager] Error hiding window:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
    }
  }

  /**
   * Restore the main window to its default size and position
   */
  restoreWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[MainWindowManager] Cannot restore window - no valid window reference');
        return;
      }
      
      console.log('[MainWindowManager] Restoring window to default state');
      this.mainWindow.setSize(800, 600);
      this.mainWindow.center();
      this.mainWindow.show();
    } catch (error) {
      console.error('[MainWindowManager] Error restoring window:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
    }
  }

  /**
   * Gets the main window instance
   * @returns {BrowserWindow|null} The main window or null if not set
   */
  getMainWindow() {
    return this.mainWindow;
  }
  
  /**
   * Clears the main window reference
   */
  clearMainWindow() {
    console.log('[MainWindowManager] Clearing main window reference');
    this.mainWindow = null;
  }
  
  /**
   * Recreates the main window if it was destroyed
   */
  recreateMainWindow() {
    console.log('[MainWindowManager] Recreating main window');
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      const { createMainWindow } = require('../utils/windowManager');
      this.mainWindow = createMainWindow();
      
      // Re-setup IPC handlers
      const setupIpcHandlers = require('../ipc/handlers');
      setupIpcHandlers(this.mainWindow);
      
      // Re-setup specialized IPC handlers
      const setupMicrophoneHandlers = require('../ipc/microphoneHandlers');
      const setupSettingsHandlers = require('../ipc/settingsHandlers');
      const setupNotificationHandlers = require('../ipc/notificationHandlers');
      const setupDictionaryIpcHandlers = require('../services/dictionaryIpcHandlers');
      
      setupMicrophoneHandlers();
      setupSettingsHandlers();
      setupNotificationHandlers();
      setupDictionaryIpcHandlers();
    }
  }
}

module.exports = MainWindowManager; 