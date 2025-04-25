/**
 * NotificationService for managing system and in-app notifications
 * 
 * This service:
 * - Manages system notifications
 * - Shows in-app toast notifications
 * - Handles notification permissions
 */

const { EventEmitter } = require('events');
const { Notification } = require('electron');
const path = require('path');
const logger = require('../../logger');

class NotificationService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.options = {
      appIcon: null,
      defaultTitle: 'Juno',
      defaultTimeout: 5000, // 5 seconds
      ...options
    };
    
    this.services = null;
    this.mainWindow = null;
    this.notificationQueue = [];
    this.maxQueueSize = 5;
    
    // Keep track of active notifications
    this.activeNotifications = new Map();
  }
  
  /**
   * Initialize the service
   * @param {ServiceRegistry} services Service registry
   * @returns {Promise<void>}
   */
  async initialize(services) {
    if (this.initialized) {
      return;
    }
    
    logger.info('Initializing notification service');
    this.services = services;
    
    try {
      // Load configuration
      const configService = services.get('config');
      if (configService) {
        const notificationConfig = await configService.getConfig('notification') || {};
        
        // Merge notification settings
        if (notificationConfig.defaultTimeout) {
          this.options.defaultTimeout = notificationConfig.defaultTimeout;
        }
        
        if (notificationConfig.maxQueueSize) {
          this.maxQueueSize = notificationConfig.maxQueueSize;
        }
        
        // Set app icon
        if (notificationConfig.appIcon) {
          this.options.appIcon = path.resolve(process.cwd(), notificationConfig.appIcon);
        }
        
        logger.debug('Notification service configured with timeout:', this.options.defaultTimeout);
      } else {
        logger.warn('Config service not available, using default notification settings');
      }
      
      // Get main window reference for rendering in-app notifications
      const windowService = services.get('window');
      if (windowService) {
        this.mainWindow = windowService.getMainWindow();
      }
      
      this.initialized = true;
      logger.info('Notification service initialized successfully');
    } catch (error) {
      logger.error('Error initializing notification service:', error);
      throw error;
    }
  }
  
  /**
   * Shutdown the service
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('Shutting down notification service');
    
    // Close any active notifications
    for (const notification of this.activeNotifications.values()) {
      if (notification && typeof notification.close === 'function') {
        notification.close();
      }
    }
    
    this.activeNotifications.clear();
    this.notificationQueue = [];
    this.initialized = false;
  }
  
  /**
   * Show a notification
   * @param {Object} options Notification options
   * @param {string} options.title Notification title
   * @param {string} options.body Notification body
   * @param {string} options.type Notification type (info, success, warning, error)
   * @param {number} options.timeout Notification timeout in ms
   * @param {boolean} options.useNative Whether to use native notifications
   * @param {function} options.onClick Callback for notification click
   * @returns {string} Notification ID
   */
  show(options = {}) {
    try {
      const notificationOptions = {
        title: options.title || this.options.defaultTitle,
        body: options.body || '',
        type: options.type || 'info',
        timeout: options.timeout || this.options.defaultTimeout,
        useNative: options.useNative !== undefined ? options.useNative : true,
        onClick: options.onClick || null
      };
      
      logger.debug(`Showing notification: ${notificationOptions.title} - ${notificationOptions.body}`);
      
      // Generate a unique ID for this notification
      const id = `notification-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // If queue is full, remove oldest notification
      if (this.notificationQueue.length >= this.maxQueueSize) {
        const oldestNotification = this.notificationQueue.shift();
        this._clearNotification(oldestNotification.id);
      }
      
      // Add to queue
      this.notificationQueue.push({
        id,
        options: notificationOptions,
        timestamp: Date.now()
      });
      
      // Show the notification
      this._showNotification(id, notificationOptions);
      
      // Return the notification ID for reference
      return id;
    } catch (error) {
      logger.error('Error showing notification:', error);
      return null;
    }
  }
  
  /**
   * Update an existing notification
   * @param {string} id Notification ID
   * @param {Object} options Updated notification options
   * @returns {boolean} Success status
   */
  update(id, options = {}) {
    try {
      if (!id || !this.activeNotifications.has(id)) {
        logger.warn(`Cannot update notification with ID ${id}: not found`);
        return false;
      }
      
      // Find the notification in the queue
      const notificationIndex = this.notificationQueue.findIndex(n => n.id === id);
      if (notificationIndex === -1) {
        logger.warn(`Cannot update notification with ID ${id}: not in queue`);
        return false;
      }
      
      // Update the notification
      const existing = this.notificationQueue[notificationIndex].options;
      const updated = {
        ...existing,
        ...options
      };
      
      // Update queue
      this.notificationQueue[notificationIndex] = {
        id,
        options: updated,
        timestamp: Date.now()
      };
      
      // Clear existing notification
      this._clearNotification(id);
      
      // Show updated notification
      this._showNotification(id, updated);
      
      return true;
    } catch (error) {
      logger.error(`Error updating notification ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Close a notification
   * @param {string} id Notification ID
   * @returns {boolean} Success status
   */
  close(id) {
    try {
      if (!id) {
        logger.warn('Cannot close notification: no ID provided');
        return false;
      }
      
      // Remove from queue
      this.notificationQueue = this.notificationQueue.filter(n => n.id !== id);
      
      // Clear the notification
      this._clearNotification(id);
      
      return true;
    } catch (error) {
      logger.error(`Error closing notification ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Close all notifications
   * @returns {boolean} Success status
   */
  closeAll() {
    try {
      // Close all active notifications
      for (const id of this.activeNotifications.keys()) {
        this._clearNotification(id);
      }
      
      // Clear the queue
      this.notificationQueue = [];
      
      return true;
    } catch (error) {
      logger.error('Error closing all notifications:', error);
      return false;
    }
  }
  
  /**
   * Shows a progress notification that can be updated
   * @param {string} title Notification title
   * @param {string} initialMessage Initial message
   * @param {number} progressValue Initial progress value (0-100)
   * @returns {Object} Progress notification controller
   */
  showProgress(title, initialMessage, progressValue = 0) {
    const id = this.show({
      title: title,
      body: `${initialMessage} (${progressValue}%)`,
      type: 'info',
      timeout: 0 // No auto-close
    });
    
    return {
      update: (message, progress) => {
        const progressPercent = Math.min(100, Math.max(0, progress));
        return this.update(id, {
          body: `${message} (${progressPercent}%)`,
        });
      },
      complete: (message) => {
        const result = this.update(id, {
          body: message,
          type: 'success',
          timeout: this.options.defaultTimeout
        });
        
        // Auto-close after timeout
        setTimeout(() => {
          this.close(id);
        }, this.options.defaultTimeout);
        
        return result;
      },
      error: (message) => {
        const result = this.update(id, {
          body: message,
          type: 'error',
          timeout: this.options.defaultTimeout
        });
        
        // Auto-close after timeout
        setTimeout(() => {
          this.close(id);
        }, this.options.defaultTimeout);
        
        return result;
      },
      close: () => {
        return this.close(id);
      }
    };
  }
  
  /**
   * Show system notification for AI processing
   * @param {string} message Notification message
   * @returns {Object} Progress notification controller
   */
  showAIProcessing(message = 'Processing your request...') {
    return this.showProgress('AI Assistant', message, 0);
  }
  
  /**
   * Show a success notification
   * @param {string} message Success message
   * @param {string} title Notification title
   * @returns {string} Notification ID
   */
  showSuccess(message, title = 'Success') {
    return this.show({
      title,
      body: message,
      type: 'success'
    });
  }
  
  /**
   * Show an error notification
   * @param {string} message Error message
   * @param {string} title Notification title
   * @returns {string} Notification ID
   */
  showError(message, title = 'Error') {
    return this.show({
      title,
      body: message,
      type: 'error'
    });
  }
  
  /**
   * Implementation to show a notification
   * @param {string} id Notification ID
   * @param {Object} options Notification options
   * @private
   */
  _showNotification(id, options) {
    try {
      // Clean up previous notification with same ID if exists
      this._clearNotification(id);
      
      // Determine if we should use native notifications or in-app
      if (options.useNative) {
        this._showNativeNotification(id, options);
      } else {
        this._showInAppNotification(id, options);
      }
      
      // Auto-close notification after timeout if specified
      if (options.timeout > 0) {
        const timeoutId = setTimeout(() => {
          this.close(id);
        }, options.timeout);
        
        // Store the timeout ID for cleanup
        this.activeNotifications.set(`${id}-timeout`, timeoutId);
      }
      
      // Emit event for notification shown
      this.emit('notification-shown', { id, options });
      
    } catch (error) {
      logger.error(`Error showing notification ${id}:`, error);
    }
  }
  
  /**
   * Show a native system notification
   * @param {string} id Notification ID
   * @param {Object} options Notification options
   * @private
   */
  _showNativeNotification(id, options) {
    try {
      // Create native notification
      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: this.options.appIcon,
        silent: options.silent || false
      });
      
      // Handle notification click
      if (options.onClick) {
        notification.on('click', () => {
          options.onClick();
          this.emit('notification-clicked', { id, options });
        });
      }
      
      // Handle notification close
      notification.on('close', () => {
        this.close(id);
        this.emit('notification-closed', { id });
      });
      
      // Show the notification
      notification.show();
      
      // Store the notification for later reference
      this.activeNotifications.set(id, notification);
      
    } catch (error) {
      logger.error(`Error showing native notification ${id}:`, error);
      // Fall back to in-app notification
      this._showInAppNotification(id, options);
    }
  }
  
  /**
   * Show an in-app notification
   * @param {string} id Notification ID
   * @param {Object} options Notification options
   * @private
   */
  _showInAppNotification(id, options) {
    try {
      // Check if we have a main window to show in-app notification
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        logger.warn('Cannot show in-app notification: no main window available');
        return;
      }
      
      // Send notification to renderer process
      this.mainWindow.webContents.send('show-notification', {
        id,
        title: options.title,
        body: options.body,
        type: options.type,
        timeout: options.timeout
      });
      
      // Store a reference to the notification
      this.activeNotifications.set(id, { isInApp: true });
      
    } catch (error) {
      logger.error(`Error showing in-app notification ${id}:`, error);
    }
  }
  
  /**
   * Clear a notification
   * @param {string} id Notification ID
   * @private
   */
  _clearNotification(id) {
    try {
      // Clear any associated timeout
      const timeoutId = this.activeNotifications.get(`${id}-timeout`);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.activeNotifications.delete(`${id}-timeout`);
      }
      
      // Get the notification
      const notification = this.activeNotifications.get(id);
      if (!notification) {
        return;
      }
      
      // Handle native vs in-app notifications
      if (notification.isInApp) {
        // Send close event to renderer
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('close-notification', { id });
        }
      } else if (typeof notification.close === 'function') {
        // Close native notification
        notification.close();
      }
      
      // Remove from active notifications
      this.activeNotifications.delete(id);
      
    } catch (error) {
      logger.error(`Error clearing notification ${id}:`, error);
    }
  }
}

/**
 * Factory function for creating NotificationService instances
 * @param {Object} options Service options
 * @returns {NotificationService} Notification service instance
 */
module.exports = (options = {}) => {
  return new NotificationService(options);
};

module.exports.NotificationService = NotificationService; 