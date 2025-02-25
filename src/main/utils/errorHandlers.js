const { app } = require('electron');
const serviceRegistry = require('../services/ServiceRegistry');

/**
 * Sets up global error handlers for the application
 * @param {BrowserWindow} mainWindow - The main application window
 */
function setupErrorHandlers(mainWindow) {
  // Handle renderer process crashes
  app.on('render-process-crashed', (event, webContents, killed) => {
    console.error('Renderer process crashed:', { killed });
    
    const notificationService = serviceRegistry.get('notification');
    notificationService.showNotification(
      'Application Error',
      'A window crashed and will be restarted.',
      'error'
    );

    // Recreate the window
    const windowManager = serviceRegistry.get('windowManager');
    windowManager.recreateMainWindow();
  });

  // Handle GPU process crashes
  app.on('gpu-process-crashed', (event, killed) => {
    console.error('GPU process crashed:', { killed });
    
    const notificationService = serviceRegistry.get('notification');
    notificationService.showNotification(
      'Application Error',
      'The GPU process crashed. The application will restart.',
      'error'
    );

    // Restart the app
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 2000);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught exception:', error);
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('error', {
        message: 'An unexpected error occurred',
        error: error.message
      });
    }
    
    const notificationService = serviceRegistry.get('notification');
    if (notificationService) {
      notificationService.showNotification(
        'Application Error',
        'An unexpected error occurred: ' + error.message,
        'error'
      );
    }
  });
}

module.exports = {
  setupErrorHandlers
}; 