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
      width: 96,
      height: 22,
      x: Math.floor(workArea.x + (workArea.width - 96) / 2),
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
              background: rgba(0, 0, 0, 0.75);
              border-radius: 11px;
              padding: 0 10px;
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
          </style>
          <script>
            let previousLevels = [0, 0, 0, 0, 0];
            let targetLevels = [0, 0, 0, 0, 0];
            
            // Update loop for smooth animations
            function animate() {
              const bars = document.querySelectorAll('.bar');
              const smoothingFactor = 0.6; // Even snappier response
              
              // Update each bar
              previousLevels = previousLevels.map((prev, i) => {
                const target = targetLevels[i];
                const next = prev + (target - prev) * smoothingFactor;
                
                if (bars[i]) {
                  // Scale to fit within container (0.15 to 1.2 range)
                  const scale = 0.15 + (next * 1.05);
                  bars[i].style.transform = 'scaleY(' + scale + ')';
                }
                
                return next;
              });
              
              requestAnimationFrame(animate);
            }
            
            // Start animation loop
            animate();

            function updateLevels(levels) {
              // Get the main level from the first value and amplify it more
              const mainLevel = Math.min(1, levels[0] * 2.0); // Double the input but cap at 1
              
              // Create a ripple effect with higher energy retention
              targetLevels = [
                mainLevel,                    // First bar gets amplified intensity
                targetLevels[0] * 0.95,      // Second bar gets 95% of previous bar
                targetLevels[1] * 0.9,       // Third bar gets 90% of previous bar
                targetLevels[2] * 0.85,      // Fourth bar gets 85% of previous bar
                targetLevels[3] * 0.8        // Fifth bar gets 80% of previous bar
              ];
            }
          </script>
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

    // Make the window click-through and prevent focus
    this.window.setIgnoreMouseEvents(true);
    this.window.setAlwaysOnTop(true, 'screen-saver', 1);
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Hide window initially
    this.window.hide();
  }

  updateAudioLevels(levels) {
    if (!this.window) return;
    this.window.webContents.executeJavaScript(`updateLevels(${JSON.stringify(levels)})`).catch(err => {
      console.error('Failed to update audio levels:', err);
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