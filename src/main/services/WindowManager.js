/**
 * Window Manager Service for the Juno application.
 * 
 * This service is responsible for managing the application windows, including:
 * - Main window lifecycle (delegated to MainWindowManager)
 * - Overlay window management (delegated to OverlayWindowManager)
 * - Window state management
 * 
 * It works in conjunction with the windowManager utility (src/main/utils/windowManager.js)
 * which handles the initial window creation with specific configuration.
 * 
 * The separation of concerns allows for cleaner code organization:
 * - The utility handles the initial window creation and configuration
 * - This service coordinates the window managers
 * - The specialized managers handle specific window types
 */
const { BrowserWindow, screen, app, ipcMain } = require('electron');
const path = require('path');
const BaseService = require('./BaseService');
const OverlayWindowManager = require('./OverlayWindowManager');
const MainWindowManager = require('./MainWindowManager');

/**
 * WindowManager service class responsible for coordinating window management
 * @class
 * @extends BaseService
 */
class WindowManager extends BaseService {
  /**
   * Creates a new WindowManager instance
   * @constructor
   */
  constructor() {
    super('WindowManager');
    this.isRecording = false;
    this.mainWindowManager = null;
    this.overlayManager = null;
    console.log('[WindowManager] Initialized');
  }

  /**
   * Initialize the WindowManager service
   * @async
   * @private
   * @returns {Promise<void>}
   */
  async _initialize() {
    console.log('[WindowManager] Initializing...');
    this.mainWindowManager = new MainWindowManager(this);
    this.overlayManager = new OverlayWindowManager(this);
    console.log('[WindowManager] Window managers initialized');
  }

  /**
   * Shutdown the WindowManager service
   * @async
   * @private
   * @returns {Promise<void>}
   */
  async _shutdown() {
    console.log('[WindowManager] Shutting down...');
    
    if (this.mainWindowManager) {
      this.mainWindowManager.clearMainWindow();
    }
    console.log('[WindowManager] Windows cleared');
  }

  // Main Window Management (delegated to MainWindowManager)
  
  /**
   * Set the main application window and configure its properties
   * @param {BrowserWindow} window - The Electron BrowserWindow instance
   */
  setMainWindow(window) {
    this.mainWindowManager.setMainWindow(window);
  }

  /**
   * Show the main application window and bring it to focus
   */
  showWindow() {
    this.mainWindowManager.showWindow();
  }

  /**
   * Hide the main application window
   */
  hideWindow() {
    this.mainWindowManager.hideWindow();
  }

  /**
   * Restore the main window to its default size and position
   */
  restoreWindow() {
    this.mainWindowManager.restoreWindow();
  }

  // Overlay Window Management (delegated to OverlayWindowManager)

  /**
   * Create an overlay window
   */
  createOverlay() {
    this.overlayManager.createOverlay();
  }

  /**
   * Show the overlay window
   */
  showOverlay() {
    this.overlayManager.showOverlay();
  }

  /**
   * Hide the overlay window
   */
  hideOverlay() {
    this.overlayManager.hideOverlay();
  }

  /**
   * Destroy the overlay window
   */
  destroyOverlay() {
    this.overlayManager.destroyOverlay();
  }

  /**
   * Update the audio levels displayed in the overlay
   * @param {Object} levels - Audio level data to display in the overlay
   */
  updateOverlayAudioLevels(levels) {
    this.overlayManager.updateOverlayAudioLevels(levels);
  }
  
  /**
   * Update the state of the overlay window
   * @param {Object} state - State data to update in the overlay
   */
  updateOverlayState(state) {
    this.overlayManager.updateOverlayState(state);
  }

  /**
   * Set the state of the overlay window
   * @param {Object} state - State data to set in the overlay
   */
  setOverlayState(state) {
    this.overlayManager.setOverlayState(state);
  }

  /**
   * Gets the main window instance
   * @returns {BrowserWindow|null} The main window or null if not set
   */
  getMainWindow() {
    return this.mainWindowManager.getMainWindow();
  }
  
  /**
   * Clears the main window reference
   */
  clearMainWindow() {
    this.mainWindowManager.clearMainWindow();
  }
  
  /**
   * Recreates the main window if it was destroyed
   */
  recreateMainWindow() {
    this.mainWindowManager.recreateMainWindow();
  }
}

// Export a factory function instead of a singleton
module.exports = () => new WindowManager(); 