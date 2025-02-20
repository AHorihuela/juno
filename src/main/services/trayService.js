const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');
const recorder = require('./recorder');

// Simple monochrome icon as base64
const ICON_BASE64 = `
iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABYSURBVDiNY2AYBaNgFDACIYLk/0yMDAyM/xkYGP6zMDIwMDEyMPxnYmJgYGZkYPjHxMTAwMLEwMDIxMTAwMrMwMDIzMzAwMbCwMDIxsrAwM7GwsA+GkQDDwAh8QaqUGYYYgAAAABJRU5ErkJggg==
`;

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
    
    // Create tray icon from base64
    const icon = nativeImage.createFromDataURL('data:image/png;base64,' + ICON_BASE64.trim());
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
            }
          }
        });
      }
    }
  }

  updateContextMenu() {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: recorder.isRecording() ? 'Stop Recording' : 'Start Recording',
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
        label: 'Settings',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          if (recorder.isRecording()) {
            recorder.stop();
          }
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