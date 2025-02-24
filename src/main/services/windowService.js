const { BrowserWindow, app } = require('electron');
const BaseService = require('./BaseService');

class WindowService extends BaseService {
  constructor() {
    super('Window');
    this.mainWindow = null;
    this.isRecording = false;
    this.isFirstShow = true;
    this.isDev = process.env.NODE_ENV === 'development';
  }

  async _initialize() {
    // Nothing to initialize yet - we wait for setMainWindow to be called
  }

  async _shutdown() {
    if (this.mainWindow) {
      this.hideWindow();
      this.mainWindow = null;
    }
  }

  setMainWindow(window) {
    try {
      this.mainWindow = window;
      
      console.log('[WindowService] Initializing main window properties');
      
      // Set window properties before showing anything
      this.mainWindow.setVisibleOnAllWorkspaces(true);
      this.mainWindow.setAlwaysOnTop(true, 'floating');
      this.mainWindow.setFullScreenable(false);
      this.mainWindow.setSkipTaskbar(true);  // Don't show in taskbar
      this.mainWindow.setFocusable(false);    // Prevent window from being focusable
      
      // Start hidden
      this.mainWindow.hide();

      // Handle DevTools specifically in dev mode
      if (this.isDev) {
        this.mainWindow.webContents.on('devtools-opened', () => {
          console.log('[WindowService] DevTools opened');
          // Immediately detach DevTools to its own window
          this.mainWindow.webContents.openDevTools({ mode: 'detach' });
          // Hide main window if it was shown
          this.mainWindow.hide();
        });
      }
      
      // Listen for window events
      this.mainWindow.on('show', () => {
        console.log('[WindowService] Window shown');
        // Ensure window stays unfocusable when shown
        this.mainWindow.setFocusable(false);
        // If in dev mode, ensure DevTools doesn't bring main window to front
        if (this.isDev && this.mainWindow.webContents.isDevToolsOpened()) {
          this.mainWindow.hide();
        }
      });
      
      this.mainWindow.on('focus', () => {
        console.log('[WindowService] Window focused');
        if (!this.isRecording) {
          // If we get focused while not recording, immediately hide
          this.hideWindow();
        }
      });

      // Handle window-all-closed to prevent app quit
      app.on('window-all-closed', (e) => {
        e.preventDefault();
      });
    } catch (error) {
      this.emitError(error);
    }
  }

  showRecordingIndicator() {
    try {
      if (!this.mainWindow) return;
      
      console.log('[WindowService] Showing recording indicator');
      
      // Minimize the window to just show a small indicator
      this.mainWindow.setSize(60, 60);
      
      // Position it in the top-right corner
      const workArea = this.mainWindow.screen.getPrimaryDisplay().workArea;
      this.mainWindow.setPosition(workArea.width - 80, 20);
      
      // Double ensure window won't steal focus
      this.mainWindow.setFocusable(false);
      this.mainWindow.setAlwaysOnTop(true, 'floating');
      
      // If this is the first show, handle it specially
      if (this.isFirstShow) {
        console.log('[WindowService] First time showing window');
        // Wait for window to be ready
        if (this.mainWindow.isReady()) {
          this.mainWindow.showInactive();
        } else {
          this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.showInactive();
          });
        }
        this.isFirstShow = false;
      } else {
        // For subsequent shows, just show without activation
        this.mainWindow.showInactive();
      }
      
      this.isRecording = true;
      
      // In dev mode, ensure DevTools doesn't bring main window to front
      if (this.isDev && this.mainWindow.webContents.isDevToolsOpened()) {
        setImmediate(() => {
          this.mainWindow.showInactive();
        });
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  hideWindow() {
    try {
      if (this.mainWindow) {
        this.mainWindow.hide();
        this.isRecording = false;
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  showWindow() {
    try {
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  restoreWindow() {
    try {
      if (this.mainWindow) {
        // Reset window to default size and position
        this.mainWindow.setSize(800, 600);
        this.mainWindow.center();
        this.mainWindow.show();
      }
    } catch (error) {
      this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new WindowService(); 