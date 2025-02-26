/**
 * Overlay Window Manager for the Juno application.
 * 
 * This class is responsible for managing overlay windows, including:
 * - Creating, showing, hiding, and destroying overlay windows
 * - Updating overlay window state and audio levels
 * 
 * It is used by the WindowManager service to delegate overlay-specific functionality,
 * improving separation of concerns and maintainability.
 */

/**
 * OverlayWindowManager class responsible for managing overlay windows
 * @class
 */
class OverlayWindowManager {
  /**
   * Creates a new OverlayWindowManager instance
   * @constructor
   * @param {WindowManager} windowManager - The parent WindowManager instance
   */
  constructor(windowManager) {
    this.windowManager = windowManager;
    console.log('[OverlayWindowManager] Initialized');
  }

  /**
   * Get the overlay service from the service registry
   * @private
   * @returns {Object|null} The overlay service or null if not available
   */
  _getOverlayService() {
    try {
      const overlayService = this.windowManager.getService('overlay');
      if (!overlayService) {
        console.error('[OverlayWindowManager] Overlay service not available');
        return null;
      }
      return overlayService;
    } catch (error) {
      console.error('[OverlayWindowManager] Error getting overlay service:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
      return null;
    }
  }

  /**
   * Create an overlay window
   */
  createOverlay() {
    try {
      const overlayService = this._getOverlayService();
      if (!overlayService) return;
      
      overlayService.createOverlay();
    } catch (error) {
      console.error('[OverlayWindowManager] Error creating overlay:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
    }
  }

  /**
   * Show the overlay window
   */
  showOverlay() {
    try {
      const overlayService = this._getOverlayService();
      if (!overlayService) return;
      
      overlayService.showOverlay();
    } catch (error) {
      console.error('[OverlayWindowManager] Error showing overlay:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
    }
  }

  /**
   * Hide the overlay window
   */
  hideOverlay() {
    try {
      const overlayService = this._getOverlayService();
      if (!overlayService) return;
      
      overlayService.hideOverlay();
    } catch (error) {
      console.error('[OverlayWindowManager] Error hiding overlay:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
    }
  }

  /**
   * Destroy the overlay window
   */
  destroyOverlay() {
    try {
      const overlayService = this._getOverlayService();
      if (!overlayService) return;
      
      overlayService.destroyOverlay();
    } catch (error) {
      console.error('[OverlayWindowManager] Error destroying overlay:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
    }
  }

  /**
   * Update the audio levels displayed in the overlay
   * @param {Object} levels - Audio level data to display in the overlay
   */
  updateOverlayAudioLevels(levels) {
    try {
      const overlayService = this._getOverlayService();
      if (!overlayService) return;
      
      overlayService.updateOverlayAudioLevels(levels);
    } catch (error) {
      console.error('[OverlayWindowManager] Error updating overlay audio levels:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
    }
  }
  
  /**
   * Update the state of the overlay window
   * @param {Object} state - State data to update in the overlay
   */
  updateOverlayState(state) {
    try {
      const overlayService = this._getOverlayService();
      if (!overlayService) return;
      
      overlayService.updateOverlayState(state);
    } catch (error) {
      console.error('[OverlayWindowManager] Error updating overlay state:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
    }
  }

  /**
   * Set the state of the overlay window
   * @param {Object} state - State data to set in the overlay
   */
  setOverlayState(state) {
    try {
      const overlayService = this._getOverlayService();
      if (!overlayService) return;
      
      overlayService.setOverlayState(state);
    } catch (error) {
      console.error('[OverlayWindowManager] Error setting overlay state:', {
        error: error.message,
        stack: error.stack,
      });
      this.windowManager.emitError(error);
    }
  }
}

module.exports = OverlayWindowManager; 