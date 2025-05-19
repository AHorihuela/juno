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
const LogManager = require('./LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('windowManagerUtil');

/**
 * Creates the main application window
 * @param {Object} serviceRegistry - The service registry instance
 * @returns {BrowserWindow} The created window
 */
function createMainWindow(serviceRegistry) {
  try {
    logger.info('Creating window...');
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

    logger.info('Loading index.html...');
    mainWindow.loadFile('dist/index.html');

    // Show window when ready to show
    mainWindow.once('ready-to-show', async () => {
      logger.debug('Window ready to show');
      
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
        logger.info('Applying startup behavior', { metadata: { startupBehavior } });
        
        // In development mode, always show the window
        if (process.env.NODE_ENV === 'development' || startupBehavior === 'normal') {
          mainWindow.show();
          logger.debug('Window shown due to development mode or normal startup behavior');
        } else {
          // Only minimize in production with minimized setting
          mainWindow.hide();
          logger.debug('Window hidden due to minimized startup behavior in production');
        }
      } catch (error) {
        logger.error('Error applying startup behavior', { metadata: { error } });
        // Default to showing the window if there's an error
        mainWindow.show();
      }
      
      // Open DevTools in development
      if (process.env.NODE_ENV === 'development') {
        logger.info('Opening DevTools in development mode');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });

    mainWindow.on('closed', () => {
      // Clear the reference in the window manager
      logger.debug("'closed' event triggered for main window.");
      if (serviceRegistry) {
        const windowMgr = serviceRegistry.get('windowManager');
        logger.debug("Retrieved 'windowManager' from serviceRegistry:", windowMgr ? 'Exists' : 'null or undefined');
        if (windowMgr) {
          logger.debug("Calling windowMgr.clearMainWindow()...");
          windowMgr.clearMainWindow();
          logger.debug("Finished calling windowMgr.clearMainWindow().");
        } else {
          logger.error('Cannot call clearMainWindow because windowMgr is null or undefined.');
        }
      } else {
        logger.error("serviceRegistry is not available in 'closed' event handler.");
      }
    });

    return mainWindow;
  } catch (error) {
    logger.error('Error creating window', { metadata: { error } });
    throw error;
  }
}

module.exports = {
  createMainWindow
}; 