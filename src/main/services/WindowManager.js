const { BrowserWindow, screen, app } = require('electron');
const path = require('path');
const BaseService = require('./BaseService');

class WindowManager extends BaseService {
  constructor() {
    super('WindowManager');
    this.mainWindow = null;
    this.overlayWindow = null;
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
    this.destroyOverlay();
    
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

  // Overlay Window Management

  createOverlay() {
    try {
      if (this.overlayWindow) return;
      this.overlayWindow = this._createOverlayWindow();
      this.overlayWindow.loadURL(`data:text/html;charset=utf-8,${this._getHTMLTemplate()}`);
      this._setupOverlayBehavior();
    } catch (error) {
      console.error('[WindowManager] Error creating overlay:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  _createOverlayWindow() {
    try {
      const { workArea } = screen.getPrimaryDisplay();
      return new BrowserWindow({
        width: 200,
        height: 40,
        x: Math.floor(workArea.x + (workArea.width - 200) / 2),
        y: workArea.height - 120,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        focusable: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
        type: 'panel',
        hasShadow: false,
        backgroundColor: '#00000000',
        titleBarStyle: 'hidden',
        titleBarOverlay: false,
        show: false
      });
    } catch (error) {
      console.error('[WindowManager] Error creating overlay window:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
      return null;
    }
  }

  _setupOverlayBehavior() {
    try {
      if (!this.overlayWindow) return;
      this.overlayWindow.setIgnoreMouseEvents(true);
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      
      if (process.platform === 'darwin') {
        this.overlayWindow.setWindowButtonVisibility(false);
      }
      
      this.overlayWindow.hide();
    } catch (error) {
      console.error('[WindowManager] Error setting up overlay behavior:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  _getHTMLTemplate() {
    return `
      <html>
        <head>
          <style>${this._getStyles()}</style>
          <script>${this._getScript()}</script>
        </head>
        <body>
          <div class="container">
            ${Array(7).fill('<div class="bar"></div>').join('')}
          </div>
        </body>
      </html>
    `;
  }

  _getStyles() {
    return `
      body {
        margin: 0;
        padding: 0;
        background: transparent;
        overflow: hidden;
        user-select: none;
        -webkit-app-region: no-drag;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
      }
      .container {
        background: rgba(0, 0, 0, 0.85);
        border-radius: 20px;
        padding: 0 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 4px;
        height: 40px;
        overflow: hidden;
      }
      .bar {
        width: 4px;
        height: 30px;
        border-radius: 2px;
        background: white;
        transition: transform 0.1s ease-out;
        transform-origin: bottom;
        transform: scaleY(0.15);
      }
    `;
  }

  _getScript() {
    return `
      let bars = [];
      let currentState = 'idle';
      const states = {
        idle: () => {
          const now = Date.now() / 1000;
          bars.forEach((bar, i) => {
            const offset = i * 0.2;
            const scale = 0.15 + Math.sin(now * 1.2 + offset) * 0.05;
            bar.style.transform = \`scaleY(\${scale})\`;
          });
        },
        active: (levels) => {
          if (!levels) return;
          bars.forEach((bar, i) => {
            const scale = Math.max(0.15, Math.min(1, levels[i] || 0));
            bar.style.transform = \`scaleY(\${scale})\`;
          });
        }
      };

      function updateState(state, levels) {
        currentState = state;
        if (states[state]) {
          states[state](levels);
        }
      }

      function animate() {
        if (states[currentState]) {
          states[currentState]();
        }
        requestAnimationFrame(animate);
      }

      document.addEventListener('DOMContentLoaded', () => {
        bars = Array.from(document.querySelectorAll('.bar'));
        animate();
      });
    `;
  }

  updateOverlayAudioLevels(levels) {
    try {
      if (!this.overlayWindow) return;
      this.overlayWindow.webContents.executeJavaScript(`updateState('active', ${JSON.stringify(levels)})`);
    } catch (error) {
      console.error('[WindowManager] Error updating audio levels:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  setOverlayState(state) {
    try {
      if (!this.overlayWindow) return;
      this.overlayWindow.webContents.executeJavaScript(`updateState('${state}')`);
    } catch (error) {
      console.error('[WindowManager] Error setting overlay state:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  showOverlay() {
    try {
      if (!this.overlayWindow) {
        this.createOverlay();
      }
      
      // Show the window without activating it (taking focus)
      if (process.platform === 'darwin') {
        // On macOS, use showInactive to prevent focus stealing
        this.overlayWindow.showInactive();
      } else {
        // For other platforms
        this.overlayWindow.show();
        this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      }
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
      if (this.overlayWindow) {
        this.overlayWindow.hide();
      }
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
      if (this.overlayWindow) {
        this.overlayWindow.destroy();
        this.overlayWindow = null;
      }
    } catch (error) {
      console.error('[WindowManager] Error destroying overlay:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  // Recording Indicator Management (combines functionality)
  
  showRecordingIndicator() {
    try {
      console.log('[WindowManager] Showing recording indicator');
      this.isRecording = true;
      
      // Create and show the overlay
      this.createOverlay();
      this.showOverlay();
      
      console.log('[WindowManager] Recording indicator shown');
    } catch (error) {
      console.error('[WindowManager] Error showing recording indicator:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }

  hideRecordingIndicator() {
    try {
      console.log('[WindowManager] Hiding recording indicator');
      
      // Hide the overlay
      this.hideOverlay();
      
      this.isRecording = false;
      console.log('[WindowManager] Recording indicator hidden');
    } catch (error) {
      console.error('[WindowManager] Error hiding recording indicator:', {
        error: error.message,
        stack: error.stack,
      });
      this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new WindowManager(); 