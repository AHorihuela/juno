const { app, dialog } = require('electron');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('ErrorHandlers');

/**
 * Sets up global error handlers for the application
 * @param {BrowserWindow} mainWindow - The main application window
 * @param {Object} serviceRegistry - The service registry instance
 */
function setupErrorHandlers(mainWindow, serviceRegistry) {
  // Handle renderer process crashes
  app.on('render-process-crashed', (event, webContents, killed) => {
    logger.error('Renderer process crashed', { metadata: { killed } });
    
    // Only try to use services if they're available
    if (serviceRegistry && serviceRegistry.initialized) {
      try {
        const notificationService = serviceRegistry.get('notification');
        if (notificationService && notificationService.initialized) {
          notificationService.show(
            'Application Error',
            'A window crashed and will be restarted.',
            'error'
          );
        }

        // Recreate the window
        const windowManager = serviceRegistry.get('windowManager');
        if (windowManager && windowManager.initialized) {
          windowManager.recreateMainWindow();
        }
      } catch (error) {
        logger.error('Error handling renderer crash', { metadata: { error } });
        // Show a native dialog as fallback
        dialog.showErrorBox(
          'Application Error',
          'A window crashed and could not be restarted automatically. Please restart the application.'
        );
      }
    } else {
      // Show a native dialog as fallback
      dialog.showErrorBox(
        'Application Error',
        'A window crashed and could not be restarted automatically. Please restart the application.'
      );
    }
  });

  // Handle GPU process crashes
  app.on('gpu-process-crashed', (event, killed) => {
    logger.error('GPU process crashed', { metadata: { killed } });
    
    // Only try to use services if they're available
    if (serviceRegistry && serviceRegistry.initialized) {
      try {
        const notificationService = serviceRegistry.get('notification');
        if (notificationService && notificationService.initialized) {
          notificationService.show(
            'Application Error',
            'The GPU process crashed. The application will restart.',
            'error'
          );
        }
      } catch (error) {
        logger.error('Error handling GPU crash', { metadata: { error } });
      }
    }

    // Restart the app
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 2000);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception in main process', { metadata: { error } });
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('error', {
          message: 'An unexpected error occurred',
          error: error.message
        });
      } catch (sendError) {
        logger.error('Error sending error to renderer', { metadata: { error: sendError } });
      }
    }
    
    // Only try to use services if they're available
    if (serviceRegistry && serviceRegistry.initialized) {
      try {
        const notificationService = serviceRegistry.get('notification');
        if (notificationService && notificationService.initialized) {
          notificationService.show(
            'Application Error',
            'An unexpected error occurred: ' + error.message,
            'error'
          );
        }
      } catch (notifyError) {
        logger.error('Error showing notification', { metadata: { error: notifyError } });
        // Show a native dialog as fallback
        dialog.showErrorBox(
          'Application Error',
          'An unexpected error occurred: ' + error.message
        );
      }
    } else {
      // Show a native dialog as fallback
      dialog.showErrorBox(
        'Application Error',
        'An unexpected error occurred: ' + error.message
      );
    }
  });
}

module.exports = {
  setupErrorHandlers
}; 