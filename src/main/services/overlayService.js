const { BrowserWindow, screen } = require('electron');
const path = require('path');
const BaseService = require('./BaseService');

class OverlayService extends BaseService {
  constructor() {
    super('Overlay');
    this.window = null;
  }

  async _initialize() {
    // Nothing to initialize yet - we wait for createWindow to be called
  }

  async _shutdown() {
    this.destroy();
  }

  createWindow() {
    try {
      if (this.window) return;
      this.window = this._createBrowserWindow();
      this.window.loadURL(`data:text/html;charset=utf-8,${this._getHTMLTemplate()}`);
      this._setupWindowBehavior();
    } catch (error) {
      this.emitError(error);
    }
  }

  _createBrowserWindow() {
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
      this.emitError(error);
      return null;
    }
  }

  _setupWindowBehavior() {
    try {
      if (!this.window) return;
      this.window.setIgnoreMouseEvents(true);
      this.window.setAlwaysOnTop(true, 'screen-saver', 1);
      this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      
      if (process.platform === 'darwin') {
        this.window.setWindowButtonVisibility(false);
      }
      
      this.window.hide();
    } catch (error) {
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

  updateAudioLevels(levels) {
    try {
      if (!this.window || this.window.isDestroyed()) return;
      
      this.window.webContents.executeJavaScript(`
        if (window.updateState) {
          window.updateState('active', ${JSON.stringify(levels)});
        } else {
          window.postMessage({ type: 'update-levels', data: { levels: ${JSON.stringify(levels)} } }, '*');
        }
      `).catch(err => this.emitError(err));
    } catch (error) {
      this.emitError(error);
    }
  }

  setState(state) {
    try {
      if (!this.window || this.window.isDestroyed()) return;
      
      this.window.webContents.executeJavaScript(`
        if (window.updateState) {
          window.updateState('${state}');
        } else {
          window.postMessage({ type: 'set-state', data: { state: '${state}' } }, '*');
        }
      `).catch(err => this.emitError(err));
    } catch (error) {
      this.emitError(error);
    }
  }

  show() {
    try {
      if (!this.window || this.window.isDestroyed()) return;
      
      // Create window if it doesn't exist
      if (!this.window) {
        this.createWindow();
      }
      
      // Position the window at the bottom center of the screen
      const { workArea } = screen.getPrimaryDisplay();
      this.window.setPosition(
        Math.floor(workArea.x + (workArea.width - this.window.getSize()[0]) / 2),
        workArea.height - 120
      );
      
      // Show with fade-in effect
      this.window.setOpacity(0);
      this.window.show();
      
      // Animate opacity
      let opacity = 0;
      const fadeIn = setInterval(() => {
        opacity += 0.1;
        this.window.setOpacity(opacity);
        
        if (opacity >= 1) {
          clearInterval(fadeIn);
        }
      }, 16);
      
      // Set state to idle initially
      this.setState('idle');
    } catch (error) {
      this.emitError(error);
    }
  }

  hide() {
    try {
      if (!this.window || this.window.isDestroyed()) return;
      
      // Fade out effect
      let opacity = this.window.getOpacity();
      const fadeOut = setInterval(() => {
        opacity -= 0.1;
        this.window.setOpacity(Math.max(0, opacity));
        
        if (opacity <= 0) {
          clearInterval(fadeOut);
          this.window.hide();
        }
      }, 16);
    } catch (error) {
      this.emitError(error);
    }
  }

  destroy() {
    try {
      if (this.window) {
        this.window.destroy();
        this.window = null;
      }
    } catch (error) {
      this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new OverlayService(); 