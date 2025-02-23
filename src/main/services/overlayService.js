const { BrowserWindow, screen } = require('electron');
const path = require('path');

class OverlayService {
  constructor() {
    this.window = null;
  }

  createWindow() {
    if (this.window) return;

    // Get the primary display's work area
    const { workArea } = screen.getPrimaryDisplay();

    this.window = new BrowserWindow({
      width: 120,
      height: 40,
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
    });

    // Load the overlay HTML
    this.window.loadURL(`data:text/html;charset=utf-8,
      <html>
        <head>
          <style>
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
              background: rgba(0, 0, 0, 0.8);
              border-radius: 20px;
              padding: 8px 16px;
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .bar {
              width: 2px;
              height: 12px;
              border-radius: 4px;
              background: white;
              animation: wave 1s ease-in-out infinite;
            }
            .bar:nth-child(2) { animation-delay: 0.1s; }
            .bar:nth-child(3) { animation-delay: 0.2s; }
            .bar:nth-child(4) { animation-delay: 0.3s; }
            .bar:nth-child(5) { animation-delay: 0.4s; }
            @keyframes wave {
              0%, 100% { transform: scaleY(0.5); }
              50% { transform: scaleY(1); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
        </body>
      </html>
    `);

    // Make the window click-through
    this.window.setIgnoreMouseEvents(true);

    // Prevent the window from stealing focus when shown
    this.window.setAlwaysOnTop(true, 'screen-saver');

    // Hide window initially
    this.window.hide();
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