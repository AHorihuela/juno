/**
 * Window creation utility for the Juno application.
 * 
 * This module is responsible for creating the main application window with the correct
 * configuration. It is used by the WindowManager service (src/main/services/WindowManager.js)
 * which manages the window lifecycle and provides additional functionality.
 * 
 * The separation of concerns allows for cleaner code organization:
 * - This utility handles the initial window creation and configuration
 * - The WindowManager service manages the window lifecycle and state
 */
const { BrowserWindow } = require('electron');
const path = require('path');

/**
 * Creates the main application window
 * @param {Object} serviceRegistry - The service registry instance
 * @returns {BrowserWindow} The created window
 */
function createMainWindow(serviceRegistry) {
  try {
    console.log('Creating window...');
    const mainWindow = new BrowserWindow({
      width: 800,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../renderer/preload.js'),
        webSecurity: true,
      },
      show: false,
      frame: true,
      transparent: false,
      hasShadow: true,
      type: 'normal',
      skipTaskbar: false,
      focusable: true,
      alwaysOnTop: false,
      titleBarStyle: 'default',
      visualEffectState: 'active',
      roundedCorners: true,
      movable: true,
      minimizable: true,
      maximizable: false,
      closable: true,
      title: 'Juno',
      icon: path.join(__dirname, '../../../assets/icon.png')
    });

    // Set Content Security Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self';",
            `script-src 'self' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval' 'unsafe-inline'" : ''};`,
            "style-src 'self' 'unsafe-inline';", // Allow inline styles for Tailwind
            "font-src 'self' data:;",
            "img-src 'self' data:;",
            "connect-src 'self';",
          ].join(' ')
        }
      });
    });

    console.log('Loading index.html...');
    mainWindow.loadFile('dist/index.html');

    // Show window when ready to show
    mainWindow.once('ready-to-show', async () => {
      console.log('Window ready to show');
      
      // Initialize window manager first
      const windowMgr = serviceRegistry.get('windowManager');
      windowMgr.setMainWindow(mainWindow);
      
      // Initialize tray service with main window
      const trayService = serviceRegistry.get('tray');
      trayService.setMainWindow(mainWindow);
      
      // Check startup behavior setting
      try {
        const config = serviceRegistry.get('config');
        const startupBehavior = await config.getStartupBehavior();
        console.log('Applying startup behavior:', startupBehavior);
        
        // In development mode, always show the window
        if (process.env.NODE_ENV === 'development' || startupBehavior === 'normal') {
          mainWindow.show();
          console.log('Window shown due to development mode or normal startup behavior');
        } else {
          // Only minimize in production with minimized setting
          mainWindow.hide();
          console.log('Window hidden due to minimized startup behavior in production');
        }
      } catch (error) {
        console.error('Error applying startup behavior:', error);
        // Default to showing the window if there's an error
        mainWindow.show();
      }
      
      // Open DevTools in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Opening DevTools in development mode');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });

    mainWindow.on('closed', () => {
      // Clear the reference in the window manager
      if (serviceRegistry) {
        const windowMgr = serviceRegistry.get('windowManager');
        if (windowMgr) {
          windowMgr.clearMainWindow();
        }
      }
    });

    return mainWindow;
  } catch (error) {
    console.error('Error creating window:', error);
    throw error;
  }
}

module.exports = {
  createMainWindow
}; 