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
      this.overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(this._getOverlayHTML())}`);
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
      console.log('[WindowManager] Creating overlay window');
      
      // Create a new BrowserWindow for the overlay
      this.overlayWindow = new BrowserWindow({
        width: 200,
        height: 80,
        frame: false,
        transparent: true,
        hasShadow: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        parent: null, // Set to null to ensure it's not attached to main window
        modal: false, // Set to false to ensure it doesn't behave like a modal dialog
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../../renderer/preload.js'),
        }
      });
      
      // Return the created window (removed the loadFile call that was trying to load a non-existent file)
      return this.overlayWindow;
    } catch (error) {
      console.error('[WindowManager] Error creating overlay window:', error);
      this.emitError(error);
      return null;
    }
  }

  _setupOverlayBehavior() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
      
      // Make the window click-through
      this.overlayWindow.setIgnoreMouseEvents(true);
      
      // Ensure it's always on top
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      
      // Make it visible on all workspaces
      this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      
      // Ensure it doesn't appear in the taskbar
      this.overlayWindow.setSkipTaskbar(true);
      
      // Position the window at the bottom center of the screen
      const { workArea } = screen.getPrimaryDisplay();
      this.overlayWindow.setPosition(
        Math.floor(workArea.x + (workArea.width - this.overlayWindow.getSize()[0]) / 2),
        workArea.height - 120
      );
      
      // Set initial state
      this.setOverlayState('idle');
      
      // Handle window events
      this.overlayWindow.on('closed', () => {
        this.overlayWindow = null;
      });
    } catch (error) {
      console.error('[WindowManager] Error setting up overlay behavior:', error);
      this.emitError(error);
    }
  }

  _getOverlayHTML() {
    return `
      <html>
        <head>
          <style>${this._getStyles()}</style>
          <script>${this._getScript()}</script>
        </head>
        <body>
          <div class="container">
            <div class="recording-indicator">
              <div class="record-icon"></div>
            </div>
            <div class="visualization-container">
              ${Array(20).fill('<div class="bar"></div>').join('')}
            </div>
            <div class="timer">00:00</div>
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
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      
      .container {
        background: linear-gradient(135deg, rgba(30, 30, 30, 0.85) 0%, rgba(10, 10, 10, 0.95) 100%);
        border-radius: 24px;
        padding: 0 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 48px;
        min-width: 280px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      
      .recording-indicator {
        display: flex;
        align-items: center;
        margin-right: 12px;
      }
      
      .record-icon {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #ff3b30;
        animation: pulse 2s infinite;
      }
      
      .visualization-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        height: 32px;
        overflow: hidden;
      }
      
      .bar {
        flex: 1;
        height: 32px;
        background: linear-gradient(to top, rgba(255, 59, 48, 0.5), rgba(255, 59, 48, 0.9));
        border-radius: 2px;
        transition: transform 0.12s cubic-bezier(0.4, 0.0, 0.2, 1);
        transform-origin: bottom;
        transform: scaleY(0.15);
      }
      
      .timer {
        font-size: 14px;
        font-weight: 500;
        color: white;
        margin-left: 12px;
        min-width: 45px;
        text-align: right;
      }
      
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7);
        }
        70% {
          box-shadow: 0 0 0 6px rgba(255, 59, 48, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
        }
      }
    `;
  }

  _getScript() {
    return `
      let bars = [];
      let timerElement;
      let startTime = 0;
      let currentState = 'idle';
      let animationFrameId;
      
      const states = {
        idle: () => {
          const now = Date.now() / 1000;
          bars.forEach((bar, i) => {
            const offset = i * 0.05;
            const scale = 0.15 + Math.sin(now * 2 + offset) * 0.05;
            bar.style.transform = \`scaleY(\${scale})\`;
          });
        },
        active: (levels) => {
          if (!levels || !Array.isArray(levels)) return;
          
          // Expand the levels array to match our number of bars
          const expandedLevels = [];
          const barsCount = bars.length;
          const levelsCount = levels.length;
          
          for (let i = 0; i < barsCount; i++) {
            // Map the bar index to a level index
            const levelIdx = Math.floor(i * levelsCount / barsCount);
            // Get the level value, with some randomization for visual interest
            const randomFactor = 0.85 + Math.random() * 0.3;
            const level = levels[levelIdx] * randomFactor;
            expandedLevels.push(level);
          }
          
          // Apply smoothed levels to bars with slight delay for wave effect
          bars.forEach((bar, i) => {
            const delay = i * 15; // ms delay between bars for wave effect
            setTimeout(() => {
              const scale = Math.max(0.15, Math.min(1, expandedLevels[i] || 0));
              bar.style.transform = \`scaleY(\${scale})\`;
              
              // Add subtle color variation based on intensity
              const intensity = Math.min(0.9, 0.5 + scale * 0.5);
              bar.style.background = \`linear-gradient(to top, 
                rgba(255, 59, 48, \${intensity * 0.5}), 
                rgba(255, 59, 48, \${intensity}))\`;
            }, delay);
          });
          
          // Update timer
          updateTimer();
        }
      };

      function updateTimer() {
        if (!timerElement) return;
        
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        
        timerElement.textContent = \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
      }

      function updateState(state, levels) {
        if (state === 'active' && currentState !== 'active') {
          // Starting recording
          startTime = Date.now();
        }
        
        currentState = state;
        
        // Cancel any existing animation frame
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        // Start animation loop
        function animate() {
          if (states[currentState]) {
            states[currentState](levels);
          }
          animationFrameId = requestAnimationFrame(animate);
        }
        
        animate();
      }

      // Expose updateState globally so it can be called from the main process
      window.updateState = updateState;

      document.addEventListener('DOMContentLoaded', () => {
        bars = Array.from(document.querySelectorAll('.bar'));
        timerElement = document.querySelector('.timer');
        
        // Start with idle animation
        updateState('idle');
        
        // Listen for messages from main process
        window.addEventListener('message', (event) => {
          const { type, data } = event.data;
          
          if (type === 'update-levels' && data.levels) {
            updateState('active', data.levels);
          } else if (type === 'set-state') {
            updateState(data.state);
          }
        });
      });
    `;
  }

  updateOverlayAudioLevels(levels) {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        console.log('[WindowManager] Cannot update overlay audio levels - no valid overlay window');
        return;
      }
      
      console.log('[WindowManager] Updating overlay audio levels');
      this.overlayWindow.webContents.executeJavaScript(`
        if (window.updateState) {
          window.updateState('active', ${JSON.stringify(levels)});
        } else {
          window.postMessage({ type: 'update-levels', data: { levels: ${JSON.stringify(levels)} } }, '*');
        }
      `).catch(err => {
        console.error('[WindowManager] Error updating overlay audio levels:', err);
        this.emitError(err);
      });
    } catch (error) {
      console.error('[WindowManager] Error in updateOverlayAudioLevels:', error);
      this.emitError(error);
    }
  }

  setOverlayState(state) {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        console.log('[WindowManager] Cannot set overlay state - no valid overlay window');
        return;
      }
      
      console.log('[WindowManager] Setting overlay state:', state);
      this.overlayWindow.webContents.executeJavaScript(`
        if (window.updateState) {
          window.updateState('${state}');
        } else {
          window.postMessage({ type: 'set-state', data: { state: '${state}' } }, '*');
        }
      `).catch(err => {
        console.error('[WindowManager] Error setting overlay state:', err);
        this.emitError(err);
      });
    } catch (error) {
      console.error('[WindowManager] Error in setOverlayState:', error);
      this.emitError(error);
    }
  }

  showOverlay() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        this.createOverlay();
      }
      
      console.log('[WindowManager] Showing overlay with fade-in effect');
      
      // Set initial opacity to 0
      this.overlayWindow.setOpacity(0);
      
      // Show the window without activating it (no focus stealing)
      this.overlayWindow.showInactive();
      
      // Ensure it's always on top without activating
      this.overlayWindow.setAlwaysOnTop(true, 'floating', 1);
      
      // Fade in effect
      let opacity = 0;
      const fadeIn = setInterval(() => {
        opacity += 0.1;
        
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
          clearInterval(fadeIn);
          return;
        }
        
        this.overlayWindow.setOpacity(Math.min(1, opacity));
        
        if (opacity >= 1) {
          clearInterval(fadeIn);
        }
      }, 16);
    } catch (error) {
      console.error('[WindowManager] Error showing overlay:', error);
      this.emitError(error);
    }
  }

  hideOverlay() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        console.log('[WindowManager] Cannot hide overlay - no valid overlay window');
        return;
      }
      
      // Fade out effect
      console.log('[WindowManager] Hiding overlay with fade-out effect');
      let opacity = this.overlayWindow.getOpacity();
      const fadeOut = setInterval(() => {
        opacity -= 0.1;
        
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
          clearInterval(fadeOut);
          return;
        }
        
        this.overlayWindow.setOpacity(Math.max(0, opacity));
        
        if (opacity <= 0) {
          clearInterval(fadeOut);
          this.overlayWindow.hide();
        }
      }, 16);
    } catch (error) {
      console.error('[WindowManager] Error hiding overlay:', error);
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