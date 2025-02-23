const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');
const recorder = require('./recorder');

class TrayService {
  constructor() {
    this.tray = null;
    this.mainWindow = null;
  }

  initialize(mainWindow) {
    if (this.tray) {
      return; // Already initialized
    }

    this.mainWindow = mainWindow;
    
    // Create tray icon from the no-background icon
    const iconPath = path.join(__dirname, '../../../assets/images/juno_nobg.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
    
    // Create the tray icon
    this.tray = new Tray(icon);
    this.tray.setToolTip('Juno - AI Dictation');
    
    this.updateContextMenu();

    // Handle window visibility
    if (this.mainWindow) {
      this.mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
          event.preventDefault();
          this.mainWindow.hide();
        }
        return false;
      });

      // Show window on tray icon click (macOS)
      if (process.platform === 'darwin') {
        this.tray.on('click', () => {
          if (this.mainWindow) {
            if (this.mainWindow.isVisible()) {
              this.mainWindow.hide();
            } else {
              this.mainWindow.show();
              // Ensure we're on the home page when showing via tray click
              this.mainWindow.webContents.send('navigate', '/');
            }
          }
        });
      }
    }
  }

  showAndNavigate(route) {
    if (!this.mainWindow) return;
    
    // First show and focus the window
    this.mainWindow.show();
    this.mainWindow.focus();
    
    // Use a small delay to ensure the window is ready before navigation
    setTimeout(() => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        console.log('Navigating to route:', route);
        this.mainWindow.webContents.send('navigate', route);
      }
    }, 100);
  }

  updateContextMenu() {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Juno AI Dictation',
        enabled: false
      },
      { type: 'separator' },
      {
        label: recorder.isRecording() ? 'Stop Recording' : 'Start Recording',
        accelerator: process.platform === 'darwin' ? '⌘⇧ Space' : 'CommandOrControl+Shift+Space',
        click: () => {
          if (recorder.isRecording()) {
            recorder.stop();
          } else {
            recorder.start();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Home',
        click: () => this.showAndNavigate('/')
      },
      {
        label: 'Dictionary',
        click: () => this.showAndNavigate('/dictionary')
      },
      {
        label: 'AI Rules',
        click: () => this.showAndNavigate('/ai-rules')
      },
      {
        label: 'History',
        click: () => this.showAndNavigate('/history')
      },
      {
        label: 'Settings',
        click: () => this.showAndNavigate('/settings')
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: process.platform === 'darwin' ? '⌘Q' : 'CommandOrControl+Q',
        click: () => {
          if (recorder.isRecording()) {
            recorder.stop();
          }
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  updateRecordingStatus(isRecording) {
    if (this.tray) {
      this.updateContextMenu();
    }
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = new TrayService(); 