const { ipcMain } = require('electron');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('NotificationHandlers');

/**
 * Sets up all notification-related IPC handlers
 * @param {Object} serviceRegistry - The service registry instance
 */
function setupNotificationHandlers(serviceRegistry) {
  logger.info('Setting up notification handlers...');
  
  // Add notification handler
  ipcMain.on('show-notification', (_, notification) => {
    try {
      const notificationService = serviceRegistry.get('notification');
      notificationService.showNotification(
        notification.title,
        notification.message,
        notification.type
      );
    } catch (error) {
      logger.error('Error showing notification:', { metadata: { error } });
    }
  });
  
  logger.info('Notification handlers setup complete');
}

module.exports = setupNotificationHandlers; 