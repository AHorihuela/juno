/**
 * OverlayService.js
 * 
 * This service acts as an adapter between the application's service architecture
 * and the overlay UI module. It handles the communication between the recorder service
 * and the overlay UI.
 */

const BaseService = require('./BaseService');
const overlayManager = require('../ui/overlay/OverlayManager');
const { ipcMain } = require('electron');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('OverlayService');

class OverlayService extends BaseService {
  constructor() {
    super('OverlayService');
    this._setupIPCHandlers();
  }

  async _initialize() {
    logger.info('Initializing OverlayService...');
    // Nothing to initialize yet
  }

  async _shutdown() {
    logger.info('Shutting down OverlayService...');
    try {
      this.destroyOverlay();
      
      // Remove IPC handlers
      ipcMain.removeAllListeners('control-action');
      logger.info('OverlayService shutdown complete');
    } catch (error) {
      logger.error('Error during OverlayService shutdown:', { metadata: { error } });
    }
  }

  /**
   * Set up IPC handlers for the overlay window
   * @private
   */
  _setupIPCHandlers() {
    ipcMain.on('control-action', (event, data) => {
      try {
        if (data && data.action) {
          this._handleControlAction(data.action);
        } else {
          logger.warn('Received control-action event with invalid data', { metadata: { data } });
        }
      } catch (error) {
        logger.error('Error handling control-action event:', { metadata: { error } });
      }
    });
    
    logger.debug('OverlayService IPC handlers set up');
  }

  /**
   * Handle control actions from the overlay
   * @param {string} action The action to handle ('pause', 'resume', 'cancel')
   * @private
   */
  _handleControlAction(action) {
    logger.info('Received control action:', { metadata: { action } });
    
    try {
      const recorderService = this.getService('recorder');
      if (!recorderService) {
        logger.error('Recorder service not available for control action');
        return;
      }
      
      switch (action) {
        case 'pause':
          logger.debug('Pausing recording via overlay control');
          recorderService.pause();
          break;
        case 'resume':
          logger.debug('Resuming recording via overlay control');
          recorderService.resume();
          break;
        case 'cancel':
          logger.debug('Cancelling recording via overlay control');
          recorderService.cancel();
          break;
        default:
          logger.warn('Unknown control action received:', { metadata: { action } });
      }
    } catch (error) {
      logger.error('Error handling control action:', { metadata: { error, action } });
    }
  }

  /**
   * Create and show the overlay window
   */
  createOverlay() {
    logger.debug('Creating overlay window');
    try {
      overlayManager.createOverlayWindow();
    } catch (error) {
      logger.error('Error creating overlay window:', { metadata: { error } });
    }
  }

  /**
   * Show the overlay window
   */
  showOverlay() {
    logger.info('Showing overlay window');
    try {
      // Ensure overlay window is created before showing
      if (!overlayManager.isOverlayVisible()) {
        this.createOverlay();
      }
      overlayManager.showOverlay();
    } catch (error) {
      logger.error('Error showing overlay window:', { metadata: { error } });
    }
  }

  /**
   * Hide the overlay window
   */
  hideOverlay() {
    logger.info('Hiding overlay window');
    try {
      overlayManager.hideOverlay();
    } catch (error) {
      logger.error('Error hiding overlay window:', { metadata: { error } });
    }
  }

  /**
   * Destroy the overlay window
   */
  destroyOverlay() {
    logger.info('Destroying overlay window');
    try {
      overlayManager.destroyOverlay();
    } catch (error) {
      logger.error('Error destroying overlay window:', { metadata: { error } });
    }
  }

  /**
   * Update the audio levels displayed in the overlay
   * @param {Array<number>} levels Array of audio level values (0-1)
   */
  updateOverlayAudioLevels(levels) {
    try {
      overlayManager.updateOverlayAudioLevels(levels);
    } catch (error) {
      logger.error('Error updating overlay audio levels:', { metadata: { error } });
    }
  }

  /**
   * Update the overlay state
   * @param {string} state The new state ('idle', 'active', 'paused')
   */
  updateOverlayState(state) {
    logger.debug('Updating overlay state:', { metadata: { state } });
    try {
      overlayManager.updateOverlayState(state);
    } catch (error) {
      logger.error('Error updating overlay state:', { metadata: { error, state } });
    }
  }

  /**
   * Set the overlay state
   * @param {string} state The new state ('idle', 'active', 'paused')
   */
  setOverlayState(state) {
    logger.debug('Setting overlay state:', { metadata: { state } });
    try {
      overlayManager.setOverlayState(state);
    } catch (error) {
      logger.error('Error setting overlay state:', { metadata: { error, state } });
    }
  }

  /**
   * Check if the overlay is currently visible
   * @returns {boolean} True if the overlay is visible
   */
  isOverlayVisible() {
    try {
      return overlayManager.isOverlayVisible();
    } catch (error) {
      logger.error('Error checking overlay visibility:', { metadata: { error } });
      return false;
    }
  }
}

// Export a factory function
module.exports = () => new OverlayService(); 