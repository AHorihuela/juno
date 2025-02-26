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
    this.retryCount = 0;
    this.maxRetries = 3;
    this.lastWindowState = null; // Store the last known good window state
    console.log('[MainWindowManager] Initialized with development mode:', this.isDev);
  }

  /**
   * Set the main application window and configure its properties
   * @param {BrowserWindow} window - The Electron BrowserWindow instance
   * @returns {boolean} Success status of the operation
   */
  setMainWindow(window) {
    try {
      console.log('[MainWindowManager] Setting main window with properties:', {
        id: window.id,
        type: window.type,
      });
      
      // Save reference to previous window state before setting new one
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.saveWindowState();
      }
      
      this.mainWindow = window;
      
      // Set initial window properties for standard application window
      console.log('[MainWindowManager] Configuring window properties...');
      this.mainWindow.setFullScreenable(false);
      
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
      
      // Reset retry count on success
      this.retryCount = 0;
      return true;
    } catch (error) {
      // Enhanced error handling with recovery options
      return this.handleSetMainWindowError(error, window);
    }
  }

  /**
   * Handle errors that occur during setMainWindow with recovery options
   * @private
   * @param {Error} error - The error that occurred
   * @param {BrowserWindow} window - The window that was being set
   * @returns {boolean} Success status after recovery attempt
   */
  handleSetMainWindowError(error, window) {
    console.error('[MainWindowManager] Error in setMainWindow:', {
      error: error.message,
      stack: error.stack,
      windowId: window?.id,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    });

    // Attempt recovery based on error type and retry count
    if (this.retryCount < this.maxRetries) {
      console.log(`[MainWindowManager] Retrying (${this.retryCount + 1}/${this.maxRetries})...`);
      this.retryCount++;
      
      // Keep the previous window reference if it exists and is valid
      if (this.mainWindow && this.mainWindow.isDestroyed()) {
        this.mainWindow = null;
      }
      
      // Emit error but indicate retry is in progress
      this.windowManager.emitError('MainWindowManager', {
        ...error,
        recovery: {
          type: 'retry',
          attempt: this.retryCount,
          maxAttempts: this.maxRetries
        }
      });
      
      // Attempt to retry the operation with a slight delay
      setTimeout(() => {
        try {
          // Simplified retry that just attempts to set basic properties
          if (window && !window.isDestroyed()) {
            this.mainWindow = window;
            this.mainWindow.setFullScreenable(false);
            this.mainWindow.show();
            console.log('[MainWindowManager] Retry successful');
            this.retryCount = 0;
            return true;
          }
        } catch (retryError) {
          console.error('[MainWindowManager] Retry failed:', retryError.message);
          // Continue with next recovery option if retry fails
        }
      }, 500);
      
      return false;
    } else {
      // Max retries reached, attempt fallback options
      console.error('[MainWindowManager] Max retries reached, falling back to recovery options');
      
      // Emit error with recovery status
      this.windowManager.emitError('MainWindowManager', {
        ...error,
        recovery: {
          type: 'fallback',
          status: 'attempting',
          message: 'Creating fallback window after multiple failed attempts'
        }
      });
      
      // Try to restore from last known good state or create minimal window
      return this.createFallbackWindow();
    }
  }

  /**
   * Creates a fallback window when the main window cannot be set
   * @private
   * @returns {boolean} Success status of fallback creation
   */
  createFallbackWindow() {
    try {
      console.log('[MainWindowManager] Creating fallback window');
      
      // First try to restore from last known good state
      if (this.lastWindowState) {
        console.log('[MainWindowManager] Attempting to restore from last known good state');
        this.restoreFromState(this.lastWindowState);
        return true;
      }
      
      // If no saved state, create a minimal window
      const { BrowserWindow } = require('electron');
      const path = require('path');
      
      const minimalWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
      
      // Load a minimal HTML page
      const minimalHtmlPath = path.join(__dirname, '../../renderer/error.html');
      minimalWindow.loadFile(minimalHtmlPath).catch(err => {
        console.error('[MainWindowManager] Failed to load minimal HTML:', err.message);
        // If we can't even load the minimal HTML, load a blank page with error message
        minimalWindow.loadURL('data:text/html,<html><body><h2>Error</h2><p>Failed to load application window. Please restart the application.</p></body></html>');
      });
      
      this.mainWindow = minimalWindow;
      this.mainWindow.show();
      
      console.log('[MainWindowManager] Fallback window created successfully');
      
      // Reset retry count after fallback
      this.retryCount = 0;
      return true;
    } catch (fallbackError) {
      console.error('[MainWindowManager] Failed to create fallback window:', fallbackError.message);
      this.mainWindow = null;
      this.windowManager.emitError('MainWindowManager', {
        ...fallbackError,
        recovery: {
          type: 'fallback',
          status: 'failed',
          message: 'Unable to create any window after multiple attempts'
        }
      });
      return false;
    }
  }

  /**
   * Save the current window state for potential recovery
   * @private
   */
  saveWindowState() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    
    try {
      const bounds = this.mainWindow.getBounds();
      const isMaximized = this.mainWindow.isMaximized();
      const isMinimized = this.mainWindow.isMinimized();
      const isFullScreen = this.mainWindow.isFullScreen();
      
      this.lastWindowState = {
        bounds,
        isMaximized,
        isMinimized,
        isFullScreen
      };
      
      console.log('[MainWindowManager] Window state saved for recovery');
    } catch (error) {
      console.error('[MainWindowManager] Failed to save window state:', error.message);
    }
  }

  /**
   * Restore window from a saved state
   * @private
   * @param {Object} state - The window state to restore
   */
  restoreFromState(state) {
    if (!state || !this.mainWindow || this.mainWindow.isDestroyed()) return;
    
    try {
      const { bounds, isMaximized, isMinimized, isFullScreen } = state;
      
      // Set the window bounds
      this.mainWindow.setBounds(bounds);
      
      // Restore window state
      if (isMaximized) {
        this.mainWindow.maximize();
      } else if (isMinimized) {
        this.mainWindow.minimize();
      } else if (isFullScreen) {
        this.mainWindow.setFullScreen(true);
      } else {
        this.mainWindow.show();
      }
      
      console.log('[MainWindowManager] Window restored from saved state');
    } catch (error) {
      console.error('[MainWindowManager] Failed to restore window state:', error.message);
    }
  }

  /**
   * Show the main application window and bring it to focus
   */
  showWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[MainWindowManager] Cannot show window - no valid window reference');
        // Attempt to recreate the window if it doesn't exist
        this.recreateMainWindow();
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
      this.windowManager.emitError('MainWindowManager', {
        ...error,
        operation: 'showWindow',
        recovery: { type: 'automatic', action: 'recreate' }
      });
      
      // Try to recreate the window as a recovery mechanism
      this.recreateMainWindow();
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
      
      // Save window state before hiding
      this.saveWindowState();
      
      console.log('[MainWindowManager] Hiding main window');
      this.mainWindow.hide();
    } catch (error) {
      console.error('[MainWindowManager] Error hiding window:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError('MainWindowManager', {
        ...error,
        operation: 'hideWindow'
      });
    }
  }

  /**
   * Restore the main window to its default size and position
   */
  restoreWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[MainWindowManager] Cannot restore window - no valid window reference');
        // Try to recreate the window
        this.recreateMainWindow();
        return;
      }
      
      // If we have a saved state, try to restore from it first
      if (this.lastWindowState) {
        console.log('[MainWindowManager] Restoring window from saved state');
        this.restoreFromState(this.lastWindowState);
        return;
      }
      
      // Otherwise use default values
      console.log('[MainWindowManager] Restoring window to default state');
      this.mainWindow.setSize(800, 600);
      this.mainWindow.center();
      this.mainWindow.show();
    } catch (error) {
      console.error('[MainWindowManager] Error restoring window:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError('MainWindowManager', {
        ...error,
        operation: 'restoreWindow',
        recovery: { type: 'automatic', action: 'recreate' }
      });
      
      // Try to recreate the window as a recovery mechanism
      this.recreateMainWindow();
    }
  }

  /**
   * Gets the main window instance
   * @returns {BrowserWindow|null} The main window or null if not set
   */
  getMainWindow() {
    // If window exists but is destroyed, return null
    if (this.mainWindow && this.mainWindow.isDestroyed()) {
      console.log('[MainWindowManager] Window reference exists but is destroyed, returning null');
      this.mainWindow = null;
    }
    return this.mainWindow;
  }
  
  /**
   * Clears the main window reference
   */
  clearMainWindow() {
    // Save window state before clearing
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.saveWindowState();
    }
    
    console.log('[MainWindowManager] Clearing main window reference');
    this.mainWindow = null;
  }
  
  /**
   * Recreates the main window if it was destroyed
   * @returns {boolean} Success status of the recreation
   */
  recreateMainWindow() {
    console.log('[MainWindowManager] Recreating main window');
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        const { createMainWindow } = require('../utils/windowManager');
        const newWindow = createMainWindow();
        
        if (!newWindow) {
          console.error('[MainWindowManager] Failed to create new main window');
          return false;
        }
        
        this.mainWindow = newWindow;
        
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
        
        // Restore window state if available
        if (this.lastWindowState) {
          this.restoreFromState(this.lastWindowState);
        }
        
        console.log('[MainWindowManager] Main window recreated successfully');
        return true;
      } else {
        console.log('[MainWindowManager] Main window already exists and is valid');
        return true;
      }
    } catch (error) {
      console.error('[MainWindowManager] Error recreating main window:', {
        error: error.message,
        stack: error.stack
      });
      
      this.windowManager.emitError('MainWindowManager', {
        ...error,
        operation: 'recreateMainWindow',
        recovery: { type: 'fallback', action: 'createMinimal' }
      });
      
      // As a last resort, try to create a minimal fallback window
      return this.createFallbackWindow();
    }
  }
}

module.exports = MainWindowManager; 