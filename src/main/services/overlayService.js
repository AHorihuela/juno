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

  updateAudioLevels(levels) {
    try {
      if (!this.window) return;
      this.window.webContents.executeJavaScript(`updateState('active', ${JSON.stringify(levels)})`);
    } catch (error) {
      this.emitError(error);
    }
  }

  setState(state) {
    try {
      if (!this.window) return;
      this.window.webContents.executeJavaScript(`updateState('${state}')`);
    } catch (error) {
      this.emitError(error);
    }
  }

  show() {
    try {
      if (!this.window) {
        this.createWindow();
      }
      
      // Show the window without activating it (taking focus)
      if (process.platform === 'darwin') {
        // On macOS, use showInactive to prevent focus stealing
        this.window.showInactive();
      } else {
        // For other platforms
        this.window.show();
        this.window.setAlwaysOnTop(true, 'screen-saver', 1);
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  hide() {
    try {
      if (this.window) {
        this.window.hide();
      }
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