const { ipcMain } = require('electron');
const serviceRegistry = require('../services/ServiceRegistry');

/**
 * Sets up all notification-related IPC handlers
 */
function setupNotificationHandlers() {
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
      console.error('Error showing notification:', error);
    }
  });
}

module.exports = setupNotificationHandlers; 