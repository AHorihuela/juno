/**
 * OverlayManager.js
 * 
 * This module handles the creation and management of the overlay window.
 * It provides methods for creating, showing, hiding, and updating the overlay.
 */

const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const overlayUI = require('./OverlayUI');
const LogManager = require('../../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('OverlayManager');

class OverlayManager {
  constructor() {
    this.overlayWindow = null;
    this.isDev = process.env.NODE_ENV === 'development';
  }

  /**
   * Create the overlay window
   * @returns {BrowserWindow} The created overlay window
   */
  createOverlayWindow() {
    try {
      logger.info('Creating overlay window');
      
      // If window already exists, return it
      if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
        logger.debug('Overlay window already exists, returning existing window');
        return this.overlayWindow;
      }
      
      // Create a new BrowserWindow for the overlay
      this.overlayWindow = new BrowserWindow({
        width: 280,
        height: 60,
        frame: false,
        transparent: true,
        hasShadow: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        parent: null, // Set to null to ensure it's not attached to main window
        modal: false, // Set to false to ensure it doesn't behave like a modal dialog
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, '../../../renderer/preload.js'),
        }
      });
      
      // Load the overlay HTML content
      const overlayHTML = overlayUI.generateOverlayHTML();
      this.overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHTML)}`);
      
      // Set up overlay behavior
      this._setupOverlayBehavior();
      
      // Set up IPC handlers
      this._setupIPCHandlers();
      
      logger.info('Overlay window created successfully');
      
      return this.overlayWindow;
    } catch (error) {
      logger.error('Error creating overlay window:', { metadata: { error } });
      return null;
    }
  }

  /**
   * Set up overlay window behavior
   * @private
   */
  _setupOverlayBehavior() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        logger.warn('Cannot set up overlay behavior - no valid overlay window');
        return;
      }
      
      // Position the overlay at the top center of the primary display
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth } = primaryDisplay.workAreaSize;
      const windowWidth = this.overlayWindow.getBounds().width;
      
      // Calculate position (centered horizontally, 40px from top)
      const x = Math.floor((screenWidth - windowWidth) / 2);
      const y = 40;
      
      this.overlayWindow.setPosition(x, y);
      
      // Handle window closed event
      this.overlayWindow.on('closed', () => {
        logger.debug('Overlay window closed event received');
        this.overlayWindow = null;
      });
      
      logger.debug('Overlay behavior set up successfully', { 
        metadata: { position: { x, y } } 
      });
    } catch (error) {
      logger.error('Error setting up overlay behavior:', { metadata: { error } });
    }
  }

  /**
   * Set up IPC handlers for the overlay window
   * @private
   */
  _setupIPCHandlers() {
    try {
      // No specific IPC handlers needed here yet
      logger.debug('Overlay IPC handlers set up');
    } catch (error) {
      logger.error('Error setting up overlay IPC handlers:', { metadata: { error } });
    }
  }

  /**
   * Show the overlay window with a fade-in effect
   */
  showOverlay() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        logger.debug('No valid overlay window, creating new one');
        this.createOverlayWindow();
      }
      
      logger.info('Showing overlay with fade-in effect');
      
      // Set initial opacity to 0
      this.overlayWindow.setOpacity(0);
      
      // Show the window without activating it (no focus stealing)
      this.overlayWindow.showInactive();
      
      // Ensure it's always on top without activating
      this.overlayWindow.setAlwaysOnTop(true, 'floating', 1);
      
      // Fade in effect
      let opacity = 0;
      const fadeIn = setInterval(() => {
        opacity += 0.1;
        
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
          logger.warn('Overlay window destroyed during fade-in, clearing interval');
          clearInterval(fadeIn);
          return;
        }
        
        this.overlayWindow.setOpacity(Math.min(1, opacity));
        
        if (opacity >= 1) {
          logger.debug('Fade-in complete');
          clearInterval(fadeIn);
        }
      }, 16);
    } catch (error) {
      logger.error('Error showing overlay:', { metadata: { error } });
    }
  }

  /**
   * Hide the overlay window with a fade-out effect
   */
  hideOverlay() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        logger.debug('Cannot hide overlay - no valid overlay window');
        return;
      }
      
      logger.info('Hiding overlay with fade-out effect');
      
      // Get current opacity
      const startOpacity = this.overlayWindow.getOpacity();
      let opacity = startOpacity;
      
      // Fade out effect
      const fadeOut = setInterval(() => {
        opacity -= 0.1;
        
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
          logger.warn('Overlay window destroyed during fade-out, clearing interval');
          clearInterval(fadeOut);
          return;
        }
        
        this.overlayWindow.setOpacity(Math.max(0, opacity));
        
        if (opacity <= 0) {
          logger.debug('Fade-out complete, hiding window');
          clearInterval(fadeOut);
          this.overlayWindow.hide();
        }
      }, 16);
    } catch (error) {
      logger.error('Error hiding overlay:', { metadata: { error } });
    }
  }

  /**
   * Destroy the overlay window
   */
  destroyOverlay() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        logger.debug('Cannot destroy overlay - no valid overlay window');
        return;
      }
      
      logger.info('Destroying overlay window');
      
      // Close the window
      this.overlayWindow.close();
      this.overlayWindow = null;
      
      logger.debug('Overlay window destroyed successfully');
    } catch (error) {
      logger.error('Error destroying overlay:', { metadata: { error } });
      this.overlayWindow = null;
    }
  }

  /**
   * Update the audio levels displayed in the overlay
   * @param {Array<number>} levels Array of audio level values (0-1)
   */
  updateOverlayAudioLevels(levels) {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed() || !this.overlayWindow.isVisible()) {
        // Skip updates if window is not visible
        return;
      }
      
      // Send the levels to the renderer process
      this.overlayWindow.webContents.send('update-audio-levels', { levels });
    } catch (error) {
      logger.error('Error updating overlay audio levels:', { metadata: { error } });
    }
  }

  /**
   * Update the state of the overlay
   * @param {string} state The state to set ('idle', 'active', 'paused')
   */
  updateOverlayState(state) {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed() || !this.overlayWindow.isVisible()) {
        logger.debug('Cannot update overlay state - window not visible');
        return;
      }
      
      logger.debug('Updating overlay state:', { metadata: { state } });
      
      // Send the state to the renderer process
      this.overlayWindow.webContents.send('update-state', { state });
    } catch (error) {
      logger.error('Error updating overlay state:', { metadata: { error, state } });
    }
  }

  /**
   * Set the initial state of the overlay
   * @param {string} state The state to set ('idle', 'active', 'paused')
   */
  setOverlayState(state) {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        logger.debug('Cannot set overlay state - no valid overlay window');
        return;
      }
      
      logger.debug('Setting overlay state:', { metadata: { state } });
      
      // Send the state to the renderer process
      this.overlayWindow.webContents.send('set-state', { state });
    } catch (error) {
      logger.error('Error setting overlay state:', { metadata: { error, state } });
    }
  }

  /**
   * Check if the overlay window exists and is visible
   * @returns {boolean} True if the overlay exists and is visible
   */
  isOverlayVisible() {
    try {
      return !!(this.overlayWindow && !this.overlayWindow.isDestroyed() && this.overlayWindow.isVisible());
    } catch (error) {
      logger.error('Error checking overlay visibility:', { metadata: { error } });
      return false;
    }
  }
}

// Export a singleton instance
module.exports = new OverlayManager(); 