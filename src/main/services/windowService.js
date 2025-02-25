const { BrowserWindow, app } = require('electron');
const BaseService = require('./BaseService');

class WindowService extends BaseService {
  constructor() {
    super('Window');
    this.mainWindow = null;
    this.isRecording = false;
    this.isDev = process.env.NODE_ENV === 'development';
    console.log('[WindowService] Initialized with development mode:', this.isDev);
  }

  async _initialize() {
    console.log('[WindowService] Waiting for main window to be set...');
  }

  async _shutdown() {
    console.log('[WindowService] Shutting down...');
    if (this.mainWindow) {
      this.mainWindow = null;
    }
    console.log('[WindowService] Windows cleared');
  }

  setMainWindow(window) {
    try {
      console.log('[WindowService] Setting main window with properties:', {
        id: window.id,
        type: window.type,
      });
      
      this.mainWindow = window;
      
      // Set initial window properties for standard application window
      console.log('[WindowService] Configuring window properties...');
      this.mainWindow.setFullScreenable(false);
      
      // Set specific window type for macOS
      if (process.platform === 'darwin') {
        console.log('[WindowService] Applying macOS-specific settings');
        this.mainWindow.setWindowButtonVisibility(true);
      }
      
      console.log('[WindowService] Window properties configured successfully');
      
      // Show window initially
      this.mainWindow.show();
      console.log('[WindowService] Window shown initially');

      // Handle DevTools in dev mode
      if (this.isDev) {
        this.mainWindow.webContents.on('devtools-opened', () => {
          console.log('[WindowService] DevTools opened, detaching');
          this.mainWindow.webContents.openDevTools({ mode: 'detach' });
        });
      }
      
      console.log('[WindowService] Window setup completed successfully');
    } catch (error) {
      console.error('[WindowService] Error in setMainWindow:', {
        error: error.message,
        stack: error.stack,
        windowId: window?.id,
      });
      this.emitError(error);
    }
  }

  showRecordingIndicator() {
    try {
      console.log('[WindowService] Showing recording indicator');
      this.isRecording = true;
      
      // Use the overlay service for visualization
      const overlayService = this.getService('overlay');
      overlayService.createWindow();
      
      // Show the overlay without activating it
      overlayService.show();
      
      console.log('[WindowService] Recording indicator shown');
    } catch (error) {
      console.error('[WindowService] Error showing recording indicator:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  hideRecordingIndicator() {
    try {
      console.log('[WindowService] Hiding recording indicator');
      
      // Hide the overlay
      const overlayService = this.getService('overlay');
      overlayService.hide();
      
      this.isRecording = false;
      console.log('[WindowService] Recording indicator hidden');
    } catch (error) {
      console.error('[WindowService] Error hiding recording indicator:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  showWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[WindowService] Cannot show window - no valid window reference');
        return;
      }
      
      console.log('[WindowService] Showing main window');
      this.mainWindow.show();
      this.mainWindow.focus();
    } catch (error) {
      console.error('[WindowService] Error showing window:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  hideWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[WindowService] Cannot hide window - no valid window reference');
        return;
      }
      
      console.log('[WindowService] Hiding main window');
      this.mainWindow.hide();
    } catch (error) {
      console.error('[WindowService] Error hiding window:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  restoreWindow() {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        console.log('[WindowService] Cannot restore window - no valid window reference');
        return;
      }
      
      console.log('[WindowService] Restoring window to default state');
      this.mainWindow.setSize(800, 600);
      this.mainWindow.center();
      this.mainWindow.show();
    } catch (error) {
      console.error('[WindowService] Error restoring window:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new WindowService(); 