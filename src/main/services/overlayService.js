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
          </style>
          <script>
            let previousLevels = [0, 0, 0, 0, 0, 0, 0];
            let targetLevels = [0, 0, 0, 0, 0, 0, 0];
            
            // Update loop for smooth animations
            function animate() {
              const bars = document.querySelectorAll('.bar');
              const smoothingFactor = 0.6; // Snappy response
              
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
              // Get the main level from the first value and amplify it
              const mainLevel = Math.min(1, levels[0] * 2.0); // Double the input but cap at 1
              
              // Center bar (index 3) gets the main intensity
              const centerIdx = 3;
              targetLevels[centerIdx] = mainLevel;
              
              // Propagate outwards with decreasing intensity
              const decayFactor = 0.7; // Sharper decay for more contrast
              
              // Propagate left
              for (let i = centerIdx - 1; i >= 0; i--) {
                targetLevels[i] = targetLevels[i + 1] * decayFactor;
              }
              
              // Propagate right
              for (let i = centerIdx + 1; i < 7; i++) {
                targetLevels[i] = targetLevels[i - 1] * decayFactor;
              }
              
              // Add slight randomization for more natural look
              targetLevels = targetLevels.map(level => 
                level * (0.9 + Math.random() * 0.2)
              );
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