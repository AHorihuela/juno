const { BrowserWindow, screen, app, ipcMain } = require('electron');
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
    
    // Set up IPC handlers
    this._setupIPCHandlers();
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
    
    // Remove IPC handlers
    ipcMain.removeAllListeners('control-action');
  }
  
  _setupIPCHandlers() {
    ipcMain.on('control-action', (event, data) => {
      if (data && data.action) {
        this._handleControlAction(data.action);
      }
    });
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

      // Set up IPC handlers for the overlay window
      this.overlayWindow.webContents.on('did-finish-load', () => {
        this.overlayWindow.webContents.executeJavaScript(`
          // Set up message handler for control actions
          window.addEventListener('message', (event) => {
            const { type, action } = event.data;
            if (type === 'control-action') {
              // Forward to main process via IPC
              window.ipcRenderer.send('control-action', { action });
            }
          });
        `).catch(err => {
          console.error('[WindowManager] Error setting up overlay message handler:', err);
        });
      });
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
        width: 280,
        height: 60,
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
        workArea.height - 100 // Moved up from 120 to be less intrusive
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
            <div class="controls">
              <button class="control-button pause-button" title="Pause recording">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="2" y="2" width="2" height="6" rx="0.5" fill="white"/>
                  <rect x="6" y="2" width="2" height="6" rx="0.5" fill="white"/>
                </svg>
              </button>
              <button class="control-button cancel-button" title="Cancel recording">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
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
        border-radius: 28px;
        padding: 0 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 40px;
        min-width: 280px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: all 0.3s ease;
      }
      
      .recording-indicator {
        display: flex;
        align-items: center;
        margin-right: 10px;
      }
      
      .record-icon {
        width: 10px;
        height: 10px;
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
        height: 28px;
        overflow: hidden;
      }
      
      .bar {
        flex: 1;
        height: 28px;
        background: linear-gradient(to top, rgba(255, 59, 48, 0.5), rgba(255, 59, 48, 0.9));
        border-radius: 4px;
        transition: transform 0.1s cubic-bezier(0.4, 0.0, 0.2, 1);
        transform-origin: bottom;
        transform: scaleY(0.15);
        will-change: transform, background;
      }
      
      .timer {
        font-size: 12px;
        font-weight: 500;
        color: white;
        margin-left: 10px;
        min-width: 40px;
        text-align: right;
      }
      
      .controls {
        display: flex;
        align-items: center;
        margin-left: 12px;
        gap: 8px;
      }
      
      .control-button {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.15);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        transition: background-color 0.2s ease, transform 0.1s ease;
        outline: none;
      }
      
      .control-button:hover {
        background-color: rgba(255, 255, 255, 0.25);
      }
      
      .control-button:active {
        transform: scale(0.95);
        background-color: rgba(255, 255, 255, 0.3);
      }
      
      .pause-button {
        margin-right: 2px;
      }
      
      .cancel-button svg {
        stroke: rgba(255, 255, 255, 0.9);
      }
      
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7);
        }
        70% {
          box-shadow: 0 0 0 5px rgba(255, 59, 48, 0);
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
      let isPaused = false;
      let pauseStartTime = 0;
      let totalPausedTime = 0;
      
      const states = {
        idle: () => {
          const now = Date.now() / 1000;
          bars.forEach((bar, i) => {
            const offset = i * 0.05;
            // More pronounced idle animation with multiple sine waves
            const wave1 = Math.sin(now * 2 + offset) * 0.06;
            const wave2 = Math.sin(now * 1.5 + offset * 2) * 0.04;
            const scale = 0.2 + wave1 + wave2;
            
            bar.style.transform = \`scaleY(\${scale})\`;
            
            // Subtle color animation in idle state
            const hue = 355 + Math.floor(Math.sin(now + i * 0.1) * 5);
            const lightness = 50 + Math.floor(Math.sin(now * 0.7 + i * 0.15) * 5);
            bar.style.background = \`linear-gradient(to top, 
              hsla(\${hue}, 90%, \${lightness}%, 0.5), 
              hsla(\${hue}, 90%, \${lightness + 10}%, 0.9))\`;
          });
        },
        active: (levels) => {
          if (!levels || !Array.isArray(levels)) return;
          
          // Expand the levels array to match our number of bars
          const expandedLevels = [];
          const barsCount = bars.length;
          const levelsCount = levels.length;
          
          // Add some artificial peaks for more visual interest
          const enhancedLevels = [...levels];
          for (let i = 0; i < enhancedLevels.length; i++) {
            // Randomly boost some levels to create more dynamic peaks
            if (Math.random() < 0.3) {
              enhancedLevels[i] = Math.min(1, enhancedLevels[i] * 1.8); // Increased boost from 1.5 to 1.8
            }
          }
          
          // Create a wave-like pattern by adding a sine wave to the levels
          const now = Date.now() / 1000;
          for (let i = 0; i < barsCount; i++) {
            // Map the bar index to a level index with some overlap for smoother visualization
            const levelIdx = Math.min(levelsCount - 1, Math.floor(i * levelsCount / barsCount));
            
            // Enhanced randomization for more dynamic visualization
            const randomFactor = 0.85 + Math.random() * 0.4;
            
            // Apply a stronger curve to emphasize peaks
            let level = Math.pow(enhancedLevels[levelIdx] * randomFactor, 0.75); // More aggressive curve (0.75 instead of 0.8)
            
            // Add a subtle sine wave for more fluid motion
            const waveOffset = Math.sin((now * 3) + (i * 0.2)) * 0.05;
            level = Math.min(1, level + waveOffset);
            
            expandedLevels.push(level);
          }
          
          // Apply smoothed levels to bars with minimal delay for more responsive animation
          bars.forEach((bar, i) => {
            // Reduced delay for more responsive animation
            const delay = i * 4; // Further reduced from 5 to 4
            setTimeout(() => {
              // Ensure minimum scale for better visibility
              const scale = Math.max(0.25, Math.min(1, expandedLevels[i] || 0));
              bar.style.transform = \`scaleY(\${scale})\`;
              
              // Enhanced color variation based on intensity
              const intensity = Math.min(0.98, 0.6 + scale * 0.4);
              const hue = 355 - Math.floor(scale * 25); // More pronounced hue shift based on intensity
              bar.style.background = \`linear-gradient(to top, 
                hsla(\${hue}, 95%, 50%, \${intensity * 0.6}), 
                hsla(\${hue}, 95%, 65%, \${intensity}))\`;
            }, delay);
          });
          
          // Update timer
          updateTimer();
        },
        paused: () => {
          // Subtle pulsing animation for paused state
          const now = Date.now() / 1000;
          bars.forEach((bar, i) => {
            const offset = i * 0.1;
            const pulse = Math.sin(now * 1.5 + offset) * 0.05;
            const scale = 0.15 + pulse;
            
            bar.style.transform = \`scaleY(\${scale})\`;
            
            // Blue-ish color for paused state
            bar.style.background = \`linear-gradient(to top, 
              rgba(59, 130, 246, 0.5), 
              rgba(59, 130, 246, 0.9))\`;
          });
          
          // Keep timer frozen at paused time
          updateTimer();
        }
      };

      function updateTimer() {
        if (!timerElement) return;
        
        let elapsedSeconds;
        if (isPaused) {
          // When paused, show the time at which we paused
          elapsedSeconds = Math.floor((pauseStartTime - startTime - totalPausedTime) / 1000);
        } else {
          // When active, calculate current elapsed time minus any paused time
          elapsedSeconds = Math.floor((Date.now() - startTime - totalPausedTime) / 1000);
        }
        
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        
        timerElement.textContent = \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
      }

      function updateState(state, levels) {
        if (state === 'active' && currentState !== 'active') {
          // Starting recording
          if (!startTime) {
            startTime = Date.now();
          } else if (isPaused) {
            // Resuming from pause
            totalPausedTime += (Date.now() - pauseStartTime);
            isPaused = false;
            updatePauseButtonUI();
          }
        } else if (state === 'paused' && currentState !== 'paused') {
          // Pausing recording
          isPaused = true;
          pauseStartTime = Date.now();
          updatePauseButtonUI();
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
      
      function updatePauseButtonUI() {
        const pauseButton = document.querySelector('.pause-button');
        if (!pauseButton) return;
        
        if (isPaused) {
          // Show play icon when paused
          pauseButton.innerHTML = \`
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 2.5L7.5 5L3.5 7.5V2.5Z" fill="white" stroke="white" stroke-width="0.5" stroke-linejoin="round"/>
            </svg>
          \`;
          pauseButton.title = "Resume recording";
        } else {
          // Show pause icon when active
          pauseButton.innerHTML = \`
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="2" y="2" width="2" height="6" rx="0.5" fill="white"/>
              <rect x="6" y="2" width="2" height="6" rx="0.5" fill="white"/>
            </svg>
          \`;
          pauseButton.title = "Pause recording";
        }
      }
      
      function handlePauseClick() {
        if (isPaused) {
          // Resume recording
          window.postMessage({ type: 'control-action', action: 'resume' }, '*');
          updateState('active');
        } else {
          // Pause recording
          window.postMessage({ type: 'control-action', action: 'pause' }, '*');
          updateState('paused');
        }
      }
      
      function handleCancelClick() {
        window.postMessage({ type: 'control-action', action: 'cancel' }, '*');
      }

      // Expose updateState globally so it can be called from the main process
      window.updateState = updateState;

      document.addEventListener('DOMContentLoaded', () => {
        bars = Array.from(document.querySelectorAll('.bar'));
        timerElement = document.querySelector('.timer');
        
        // Set up button event listeners
        const pauseButton = document.querySelector('.pause-button');
        const cancelButton = document.querySelector('.cancel-button');
        
        if (pauseButton) {
          pauseButton.addEventListener('click', handlePauseClick);
        }
        
        if (cancelButton) {
          cancelButton.addEventListener('click', handleCancelClick);
        }
        
        // Start with idle animation
        updateState('idle');
        
        // Listen for messages from main process
        window.addEventListener('message', (event) => {
          const { type, data } = event.data;
          
          if (type === 'update-levels' && data.levels) {
            if (!isPaused) {
              updateState('active', data.levels);
            }
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
      
      // Log the max level for debugging (only occasionally to avoid flooding logs)
      if (Math.random() < 0.05) {
        const maxLevel = Math.max(...levels);
        console.log(`[WindowManager] Audio levels - max: ${maxLevel.toFixed(2)}, avg: ${(levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(2)}`);
      }
      
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

  updateOverlayState(state) {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        console.log('[WindowManager] Cannot update overlay state - no valid overlay window');
        return;
      }
      
      console.log('[WindowManager] Updating overlay state to:', state);
      this.overlayWindow.webContents.executeJavaScript(`
        if (window.updateState) {
          window.updateState('${state}');
        } else {
          window.postMessage({ type: 'set-state', data: { state: '${state}' } }, '*');
        }
      `).catch(err => {
        console.error('[WindowManager] Error updating overlay state:', err);
        this.emitError(err);
      });
    } catch (error) {
      console.error('[WindowManager] Error in updateOverlayState:', error);
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

  _handleControlAction(action) {
    console.log('[WindowManager] Received control action:', action);
    
    const recorderService = this.getService('recorder');
    if (!recorderService) {
      console.error('[WindowManager] Recorder service not available');
      return;
    }
    
    switch (action) {
      case 'pause':
        recorderService.pause();
        break;
      case 'resume':
        recorderService.resume();
        break;
      case 'cancel':
        recorderService.cancel();
        break;
      default:
        console.warn('[WindowManager] Unknown control action:', action);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new WindowManager(); 