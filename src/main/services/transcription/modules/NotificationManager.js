/**
 * NotificationManager - Manages notifications for the transcription service
 * 
 * This module:
 * - Sends notifications to the user
 * - Handles different notification types
 * - Provides consistent notification formatting
 */

const { EventEmitter } = require('events');
const logger = require('../../../logger');

class NotificationManager extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.services = null;
    this.notificationService = null;
    this.audioService = null;
    this.lastNotification = null;
    this.suppressDuplicates = true;
    this.duplicateTimeThreshold = 3000; // 3 seconds
  }

  /**
   * Initialize the notification manager
   * @param {ServiceRegistry} services Service registry
   * @returns {Promise<void>}
   */
  async initialize(services) {
    if (this.initialized) {
      return;
    }

    logger.debug('Initializing notification manager');
    this.services = services;

    try {
      // Get notification service
      try {
        this.notificationService = services.get('notification');
      } catch (error) {
        logger.warn('Notification service not available, visual notifications will be disabled');
      }
      
      // Get audio service (optional)
      try {
        this.audioService = services.get('audio');
      } catch (error) {
        logger.warn('Audio service not available, audio feedback will be disabled');
      }
      
      this.initialized = true;
      logger.debug('Notification manager initialized successfully');
    } catch (error) {
      logger.error('Error initializing notification manager:', error);
      throw error;
    }
  }

  /**
   * Shutdown the notification manager
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.debug('Shutting down notification manager');
    
    try {
      this.lastNotification = null;
      this.initialized = false;
      logger.debug('Notification manager shutdown complete');
    } catch (error) {
      logger.error('Error shutting down notification manager:', error);
    }
  }

  /**
   * Show a notification to the user
   * @param {string} message Notification message
   * @param {string} type Notification type (info, warning, error, success)
   * @param {Object} options Additional options
   * @returns {Promise<boolean>} Success status
   */
  async showNotification(message, type = 'info', options = {}) {
    if (!message && !options.audioFeedback) {
      return false;
    }

    try {
      // Check for duplicate notification if not audio-only
      if (message && this.suppressDuplicates && this._isDuplicateNotification(message, type)) {
        logger.debug(`Suppressing duplicate notification: ${message}`);
        return false;
      }
      
      if (message) {
        logger.debug(`Showing notification (${type}): ${message}`);
        
        // Track this notification
        this.lastNotification = {
          message,
          type,
          timestamp: Date.now()
        };
      }
      
      // Show visual notification if service available and not disabled
      let visualSuccess = false;
      if (this.notificationService && message && options.visual !== false) {
        visualSuccess = await this._showVisualNotification(message, type, options);
      }
      
      // Play audio feedback if enabled and service available
      let audioSuccess = false;
      if (this.audioService && options.audioFeedback !== false) {
        audioSuccess = await this._playAudioFeedback(
          options.soundId || this._getSoundIdForType(type)
        );
      }
      
      // Emit notification event
      this.emit('notification', {
        message,
        type,
        visualSuccess,
        audioSuccess,
        timestamp: Date.now()
      });
      
      return visualSuccess || audioSuccess;
    } catch (error) {
      logger.error('Error showing notification:', error);
      return false;
    }
  }

  /**
   * Show a visual notification using the notification service
   * @param {string} message Notification message
   * @param {string} type Notification type
   * @param {Object} options Additional options
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _showVisualNotification(message, type, options) {
    try {
      if (!this.notificationService) {
        return false;
      }
      
      // Format notification based on type
      const title = this._getNotificationTitle(type);
      
      // Build notification options
      const notificationOptions = {
        title,
        body: message,
        type
      };
      
      // Add additional options
      if (options.icon) {
        notificationOptions.icon = options.icon;
      }
      
      if (options.timeout) {
        notificationOptions.timeout = options.timeout;
      }
      
      // Show the notification
      const result = await this.notificationService.show(notificationOptions);
      
      return result !== false;
    } catch (error) {
      logger.warn('Error showing visual notification:', error);
      return false;
    }
  }

  /**
   * Play audio feedback based on notification type
   * @param {string} soundId Sound ID to play
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async _playAudioFeedback(soundId) {
    try {
      if (!this.audioService) {
        return false;
      }
      
      if (!soundId) {
        return false;
      }
      
      logger.debug(`Playing audio feedback: ${soundId}`);
      
      // Play the sound
      if (typeof this.audioService.playFeedback === 'function') {
        await this.audioService.playFeedback(soundId);
        return true;
      } else if (typeof this.audioService.play === 'function') {
        await this.audioService.play(soundId);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.warn('Error playing audio feedback:', error);
      return false;
    }
  }

  /**
   * Get notification title based on type
   * @param {string} type Notification type
   * @returns {string} Notification title
   * @private
   */
  _getNotificationTitle(type) {
    switch (type) {
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'success':
        return 'Success';
      case 'info':
      default:
        return 'Voice Recognition';
    }
  }

  /**
   * Get sound ID for notification type
   * @param {string} type Notification type
   * @returns {string} Sound ID or null
   * @private
   */
  _getSoundIdForType(type) {
    switch (type) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'success':
        return 'success';
      case 'info':
        return 'info';
      case 'start':
        return 'start-recording';
      case 'stop':
        return 'stop-recording';
      default:
        return null;
    }
  }

  /**
   * Check if notification is a duplicate of the last one
   * @param {string} message Notification message
   * @param {string} type Notification type
   * @returns {boolean} Whether notification is a duplicate
   * @private
   */
  _isDuplicateNotification(message, type) {
    if (!this.lastNotification) {
      return false;
    }
    
    const now = Date.now();
    const elapsed = now - this.lastNotification.timestamp;
    
    // Check if the notification is within the time threshold
    if (elapsed < this.duplicateTimeThreshold) {
      // Check if message and type match
      return (
        this.lastNotification.message === message &&
        this.lastNotification.type === type
      );
    }
    
    return false;
  }
}

module.exports = NotificationManager; 