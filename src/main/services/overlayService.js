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

class OverlayService extends BaseService {
  constructor() {
    super('OverlayService');
    this._setupIPCHandlers();
  }

  async _initialize() {
    console.log('[OverlayService] Initializing...');
    // Nothing to initialize yet
  }

  async _shutdown() {
    console.log('[OverlayService] Shutting down...');
    this.destroyOverlay();
    
    // Remove IPC handlers
    ipcMain.removeAllListeners('control-action');
  }

  /**
   * Set up IPC handlers for the overlay window
   * @private
   */
  _setupIPCHandlers() {
    ipcMain.on('control-action', (event, data) => {
      if (data && data.action) {
        this._handleControlAction(data.action);
      }
    });
  }

  /**
   * Handle control actions from the overlay
   * @param {string} action The action to handle ('pause', 'resume', 'cancel')
   * @private
   */
  _handleControlAction(action) {
    console.log('[OverlayService] Received control action:', action);
    
    const recorderService = this.getService('recorder');
    if (!recorderService) {
      console.error('[OverlayService] Recorder service not available');
      return;
    }
    
    switch (action) {
      case 'pause':
        recorderService.pause();
        break;
      case 'resume':
        recorderService.resume();
        break;
      case 'cancel':
        recorderService.cancel();
        break;
      default:
        console.warn('[OverlayService] Unknown control action:', action);
    }
  }

  /**
   * Create and show the overlay window
   */
  createOverlay() {
    overlayManager.createOverlayWindow();
  }

  /**
   * Show the overlay window
   */
  showOverlay() {
    overlayManager.showOverlay();
  }

  /**
   * Hide the overlay window
   */
  hideOverlay() {
    overlayManager.hideOverlay();
  }

  /**
   * Destroy the overlay window
   */
  destroyOverlay() {
    overlayManager.destroyOverlay();
  }

  /**
   * Update the audio levels in the overlay
   * @param {Array<number>} levels Array of audio level values between 0 and 1
   */
  updateOverlayAudioLevels(levels) {
    overlayManager.updateOverlayAudioLevels(levels);
  }

  /**
   * Update the state of the overlay
   * @param {string} state The state to set ('idle', 'active', 'paused')
   */
  updateOverlayState(state) {
    overlayManager.updateOverlayState(state);
  }

  /**
   * Set the initial state of the overlay
   * @param {string} state The state to set ('idle', 'active', 'paused')
   */
  setOverlayState(state) {
    overlayManager.setOverlayState(state);
  }

  /**
   * Check if the overlay window exists and is visible
   * @returns {boolean} True if the overlay exists and is visible
   */
  isOverlayVisible() {
    return overlayManager.isOverlayVisible();
  }
}

// Export a factory function
module.exports = () => new OverlayService(); 