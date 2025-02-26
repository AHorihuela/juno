const { BrowserWindow, screen, app, ipcMain } = require('electron');
const path = require('path');
const BaseService = require('./BaseService');

class WindowManager extends BaseService {
  constructor() {
    super('WindowManager');
    this.mainWindow = null;
    this.isRecording = false;
    this.isDev = process.env.NODE_ENV === 'development';
    console.log('[WindowManager] Initialized with development mode:', this.isDev);
  }

  async _initialize() {
    console.log('[WindowManager] Initializing...');
    // Nothing to initialize yet - we wait for setMainWindow to be called
  }

  async _shutdown() {
    console.log('[WindowManager] Shutting down...');
    
    if (this.mainWindow) {
      this.mainWindow = null;
    }
    console.log('[WindowManager] Windows cleared');
  }

  // Main Window Management
  
  setMainWindow(window) {
    try {
      console.log('[WindowManager] Setting main window with properties:', {
        id: window.id,
        type: window.type,
      });
      
      this.mainWindow = window;
      
      // Set initial window properties for standard application window
      console.log('[WindowManager] Configuring window properties...');
      this.mainWindow.setFullScreenable(false);
      
      // Set specific window type for macOS
      if (process.platform === 'darwin') {
        console.log('[WindowManager] Applying macOS-specific settings');
        this.mainWindow.setWindowButtonVisibility(true);
      }
      
      console.log('[WindowManager] Window properties configured successfully');
      
      // Show window initially
      this.mainWindow.show();
      console.log('[WindowManager] Window shown initially');

      // Handle DevTools in dev mode
      if (this.isDev) {
        this.mainWindow.webContents.on('devtools-opened', () => {
          console.log('[WindowManager] DevTools opened, detaching');
          this.mainWindow.webContents.openDevTools({ mode: 'detach' });
        });
      }
      
      console.log('[WindowManager] Window setup completed successfully');
    } catch (error) {
      console.error('[WindowManager] Error in setMainWindow:', {
        error: error.message,
        stack: error.stack,
        windowId: window?.id,
      });
      this.emitError(error);
    }
  }

  showWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[WindowManager] Cannot show window - no valid window reference');
        return;
      }
      
      console.log('[WindowManager] Showing main window');
      this.mainWindow.show();
      this.mainWindow.focus();
    } catch (error) {
      console.error('[WindowManager] Error showing window:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  hideWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[WindowManager] Cannot hide window - no valid window reference');
        return;
      }
      
      console.log('[WindowManager] Hiding main window');
      this.mainWindow.hide();
    } catch (error) {
      console.error('[WindowManager] Error hiding window:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  restoreWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[WindowManager] Cannot restore window - no valid window reference');
        return;
      }
      
      console.log('[WindowManager] Restoring window to default state');
      this.mainWindow.setSize(800, 600);
      this.mainWindow.center();
      this.mainWindow.show();
    } catch (error) {
      console.error('[WindowManager] Error restoring window:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  // Overlay Window Management (delegated to OverlayService)

  createOverlay() {
    try {
      const overlayService = this.getService('overlay');
      if (!overlayService) {
        console.error('[WindowManager] Overlay service not available');
        return;
      }
      
      overlayService.createOverlay();
    } catch (error) {
      console.error('[WindowManager] Error creating overlay:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  showOverlay() {
    try {
      const overlayService = this.getService('overlay');
      if (!overlayService) {
        console.error('[WindowManager] Overlay service not available');
        return;
      }
      
      overlayService.showOverlay();
    } catch (error) {
      console.error('[WindowManager] Error showing overlay:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  hideOverlay() {
    try {
      const overlayService = this.getService('overlay');
      if (!overlayService) {
        console.error('[WindowManager] Overlay service not available');
        return;
      }
      
      overlayService.hideOverlay();
    } catch (error) {
      console.error('[WindowManager] Error hiding overlay:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  destroyOverlay() {
    try {
      const overlayService = this.getService('overlay');
      if (!overlayService) {
        console.error('[WindowManager] Overlay service not available');
        return;
      }
      
      overlayService.destroyOverlay();
    } catch (error) {
      console.error('[WindowManager] Error destroying overlay:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  updateOverlayAudioLevels(levels) {
    try {
      const overlayService = this.getService('overlay');
      if (!overlayService) {
        console.error('[WindowManager] Overlay service not available');
        return;
      }
      
      overlayService.updateOverlayAudioLevels(levels);
    } catch (error) {
      console.error('[WindowManager] Error updating overlay audio levels:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }
  
  updateOverlayState(state) {
    try {
      const overlayService = this.getService('overlay');
      if (!overlayService) {
        console.error('[WindowManager] Overlay service not available');
        return;
      }
      
      overlayService.updateOverlayState(state);
    } catch (error) {
      console.error('[WindowManager] Error updating overlay state:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  setOverlayState(state) {
    try {
      const overlayService = this.getService('overlay');
      if (!overlayService) {
        console.error('[WindowManager] Overlay service not available');
        return;
      }
      
      overlayService.setOverlayState(state);
    } catch (error) {
      console.error('[WindowManager] Error setting overlay state:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
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
    console.log('[WindowManager] Clearing main window reference');
    this.mainWindow = null;
  }
  
  /**
   * Recreates the main window if it was destroyed
   */
  recreateMainWindow() {
    console.log('[WindowManager] Recreating main window');
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

// Export a factory function instead of a singleton
module.exports = () => new WindowManager(); 