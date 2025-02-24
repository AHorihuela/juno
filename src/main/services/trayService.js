const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');
const BaseService = require('./BaseService');

class TrayService extends BaseService {
  constructor() {
    super('Tray');
    this.tray = null;
    this.mainWindow = null;
  }

  async _initialize() {
    // Nothing to initialize yet - we wait for setMainWindow to be called
  }

  async _shutdown() {
    this.destroy();
  }

  /**
   * Set the main window and initialize the tray
   * @param {BrowserWindow} mainWindow - The main application window
   */
  setMainWindow(mainWindow) {
    try {
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
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Show the main window and navigate to a route
   * @param {string} route - The route to navigate to
   */
  showAndNavigate(route) {
    try {
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
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Update the tray context menu
   */
  updateContextMenu() {
    try {
      if (!this.tray) return;

      const recorder = this.getService('recorder');
      const isRecording = recorder.isRecording();

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Juno AI Dictation',
          enabled: false
        },
        { type: 'separator' },
        {
          label: isRecording ? 'Stop Recording' : 'Start Recording',
          accelerator: process.platform === 'darwin' ? '⌘⇧ Space' : 'CommandOrControl+Shift+Space',
          click: () => {
            if (isRecording) {
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
            if (isRecording) {
              recorder.stop();
            }
            app.isQuitting = true;
            app.quit();
          }
        }
      ]);

      this.tray.setContextMenu(contextMenu);
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Update the recording status in the tray menu
   * @param {boolean} isRecording - Whether recording is in progress
   */
  updateRecordingStatus(isRecording) {
    try {
      if (this.tray) {
        this.updateContextMenu();
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Clean up tray resources
   */
  destroy() {
    try {
      if (this.tray) {
        this.tray.destroy();
        this.tray = null;
      }
      this.mainWindow = null;
    } catch (error) {
      this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TrayService(); 