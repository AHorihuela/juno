const { BrowserWindow, screen } = require('electron');
const path = require('path');

class OverlayService {
  constructor() {
    this.window = null;
  }

  createWindow() {
    if (this.window) return;
    this.window = this._createBrowserWindow();
    this.window.loadURL(`data:text/html;charset=utf-8,${this._getHTMLTemplate()}`);
    this._setupWindowBehavior();
  }

  _createBrowserWindow() {
    const { workArea } = screen.getPrimaryDisplay();
    return new BrowserWindow({
      width: 120,
      height: 22,
      x: Math.floor(workArea.x + (workArea.width - 120) / 2),
      y: workArea.height - 100,
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
      titleBarOverlay: false
    });
  }

  _setupWindowBehavior() {
    this.window.setIgnoreMouseEvents(true);
    this.window.setAlwaysOnTop(true, 'screen-saver', 1);
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.window.hide();
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
        background: rgba(0, 0, 0, 0.75);
        border-radius: 11px;
        padding: 0 12px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 3px;
        height: 22px;
        overflow: hidden;
      }
      .bar {
        width: 2.5px;
        height: 16px;
        border-radius: 1px;
        background: white;
        transition: transform 0.06s ease-out;
        transform-origin: center;
        transform: scaleY(0.15);
      }
      .container[data-state="processing"] .bar {
        animation: pulse 1s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
      }
    `;
  }

  _getScript() {
    return `
      let previousLevels = [0, 0, 0, 0, 0, 0, 0];
      let targetLevels = [0, 0, 0, 0, 0, 0, 0];
      
      function animate() {
        const bars = document.querySelectorAll('.bar');
        const smoothingFactor = 0.6;
        
        previousLevels = previousLevels.map((prev, i) => {
          const target = targetLevels[i];
          const next = prev + (target - prev) * smoothingFactor;
          
          if (bars[i]) {
            const scale = 0.15 + (next * 1.05);
            bars[i].style.transform = 'scaleY(' + scale + ')';
          }
          
          return next;
        });
        
        requestAnimationFrame(animate);
      }
      
      animate();

      function updateLevels(levels) {
        const mainLevel = Math.min(1, levels[0] * 2.0);
        const centerIdx = 3;
        targetLevels[centerIdx] = mainLevel;
        
        const decayFactor = 0.7;
        
        for (let i = centerIdx - 1; i >= 0; i--) {
          targetLevels[i] = targetLevels[i + 1] * decayFactor;
        }
        
        for (let i = centerIdx + 1; i < 7; i++) {
          targetLevels[i] = targetLevels[i - 1] * decayFactor;
        }
        
        targetLevels = targetLevels.map(level => 
          level * (0.9 + Math.random() * 0.2)
        );
      }

      function setState(state) {
        document.querySelector('.container').dataset.state = state;
      }
    `;
  }

  updateAudioLevels(levels) {
    if (!this.window) return;
    this.window.webContents.executeJavaScript(`updateLevels(${JSON.stringify(levels)})`).catch(err => {
      console.error('Failed to update audio levels:', err);
    });
  }

  setState(state) {
    if (!this.window) return;
    this.window.webContents.executeJavaScript(`setState("${state}")`).catch(err => {
      console.error('Failed to update state:', err);
    });
  }

  show() {
    if (!this.window) {
      this.createWindow();
    }
    this.window.showInactive();
    this.window.setAlwaysOnTop(true, 'screen-saver');
  }

  hide() {
    if (this.window) {
      this.window.hide();
    }
  }

  destroy() {
    if (this.window) {
      this.window.destroy();
      this.window = null;
    }
  }
}

module.exports = new OverlayService(); 