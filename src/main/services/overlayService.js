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
      width: 110,
      height: 28,
      x: Math.floor(workArea.x + (workArea.width - 110) / 2),
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
              border-radius: 999px;
              padding: 6px 12px;
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 4px;
              height: 20px;
            }
            .bar {
              width: 2.5px;
              height: 12px;
              border-radius: 1px;
              background: white;
              transition: transform 0.08s ease-out;
              transform-origin: center;
              transform: scaleY(0.2);
            }
          </style>
          <script>
            let previousLevels = [0, 0, 0, 0, 0];
            let targetLevels = [0, 0, 0, 0, 0];
            
            // Update loop for smooth animations
            function animate() {
              const bars = document.querySelectorAll('.bar');
              const smoothingFactor = 0.4; // Faster response to changes
              
              // Update each bar
              previousLevels = previousLevels.map((prev, i) => {
                const target = targetLevels[i];
                const next = prev + (target - prev) * smoothingFactor;
                
                if (bars[i]) {
                  // More dramatic scaling: 0.2 to 4.0 range
                  const scale = 0.2 + (next * 3.8);
                  bars[i].style.transform = 'scaleY(' + scale + ')';
                }
                
                return next;
              });
              
              requestAnimationFrame(animate);
            }
            
            // Start animation loop
            animate();

            function updateLevels(levels) {
              // Get the main level from the first value
              const mainLevel = levels[0];
              
              // Create a ripple effect with higher energy retention
              targetLevels = [
                mainLevel,                    // First bar gets full intensity
                targetLevels[0] * 0.9,       // Second bar gets 90% of previous bar
                targetLevels[1] * 0.85,      // Third bar gets 85% of previous bar
                targetLevels[2] * 0.8,       // Fourth bar gets 80% of previous bar
                targetLevels[3] * 0.75       // Fifth bar gets 75% of previous bar
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