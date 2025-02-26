/**
 * OverlayManager.js
 * 
 * This module handles the creation and management of the overlay window.
 * It provides methods for creating, showing, hiding, and updating the overlay.
 */

const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const overlayUI = require('./OverlayUI');

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
      console.log('[OverlayManager] Creating overlay window');
      
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
      
      // Load the HTML content
      this.overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayUI.getHTML())}`);
      
      // Set up the overlay behavior
      this._setupOverlayBehavior();
      
      // Set up IPC handlers for the overlay window
      this._setupIPCHandlers();
      
      return this.overlayWindow;
    } catch (error) {
      console.error('[OverlayManager] Error creating overlay window:', error);
      return null;
    }
  }

  /**
   * Set up the behavior of the overlay window
   * @private
   */
  _setupOverlayBehavior() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
      
      // Make the window click-through
      this.overlayWindow.setIgnoreMouseEvents(true);
      
      // Ensure it's always on top
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      
      // Make it visible on all workspaces
      this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      
      // Ensure it doesn't appear in the taskbar
      this.overlayWindow.setSkipTaskbar(true);
      
      // Position the window at the bottom center of the screen
      const { workArea } = screen.getPrimaryDisplay();
      this.overlayWindow.setPosition(
        Math.floor(workArea.x + (workArea.width - this.overlayWindow.getSize()[0]) / 2),
        workArea.height - 100 // Positioned near the bottom of the screen
      );
      
      // Set initial state
      this.setOverlayState('idle');
      
      // Handle window events
      this.overlayWindow.on('closed', () => {
        this.overlayWindow = null;
      });
    } catch (error) {
      console.error('[OverlayManager] Error setting up overlay behavior:', error);
    }
  }

  /**
   * Set up IPC handlers for the overlay window
   * @private
   */
  _setupIPCHandlers() {
    this.overlayWindow.webContents.on('did-finish-load', () => {
      this.overlayWindow.webContents.executeJavaScript(overlayUI.getIPCHandlerScript())
        .catch(err => {
          console.error('[OverlayManager] Error setting up overlay message handler:', err);
        });
    });
  }

  /**
   * Show the overlay window with a fade-in effect
   */
  showOverlay() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        this.createOverlayWindow();
      }
      
      console.log('[OverlayManager] Showing overlay with fade-in effect');
      
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
          clearInterval(fadeIn);
          return;
        }
        
        this.overlayWindow.setOpacity(Math.min(1, opacity));
        
        if (opacity >= 1) {
          clearInterval(fadeIn);
        }
      }, 16);
    } catch (error) {
      console.error('[OverlayManager] Error showing overlay:', error);
    }
  }

  /**
   * Hide the overlay window with a fade-out effect
   */
  hideOverlay() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        console.log('[OverlayManager] Cannot hide overlay - no valid overlay window');
        return;
      }
      
      console.log('[OverlayManager] Hiding overlay with fade-out effect');
      
      // Fade out effect
      let opacity = 1;
      const fadeOut = setInterval(() => {
        opacity -= 0.1;
        
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
          clearInterval(fadeOut);
          return;
        }
        
        this.overlayWindow.setOpacity(Math.max(0, opacity));
        
        if (opacity <= 0) {
          clearInterval(fadeOut);
          this.overlayWindow.hide();
        }
      }, 16);
    } catch (error) {
      console.error('[OverlayManager] Error hiding overlay:', error);
    }
  }

  /**
   * Destroy the overlay window
   */
  destroyOverlay() {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        console.log('[OverlayManager] Cannot destroy overlay - no valid overlay window');
        return;
      }
      
      console.log('[OverlayManager] Destroying overlay window');
      this.overlayWindow.destroy();
      this.overlayWindow = null;
    } catch (error) {
      console.error('[OverlayManager] Error destroying overlay:', error);
    }
  }

  /**
   * Update the audio levels in the overlay
   * @param {Array<number>} levels Array of audio level values between 0 and 1
   */
  updateOverlayAudioLevels(levels) {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        console.log('[OverlayManager] Cannot update overlay audio levels - no valid overlay window');
        return;
      }
      
      // Log the max level for debugging (only occasionally to avoid flooding logs)
      if (Math.random() < 0.05) {
        const maxLevel = Math.max(...levels);
        console.log(`[OverlayManager] Audio levels - max: ${maxLevel.toFixed(2)}, avg: ${(levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(2)}`);
      }
      
      this.overlayWindow.webContents.executeJavaScript(`
        if (window.updateState) {
          window.updateState('active', ${JSON.stringify(levels)});
        } else {
          window.postMessage({ type: 'update-levels', data: { levels: ${JSON.stringify(levels)} } }, '*');
        }
      `).catch(err => {
        console.error('[OverlayManager] Error updating overlay audio levels:', err);
      });
    } catch (error) {
      console.error('[OverlayManager] Error in updateOverlayAudioLevels:', error);
    }
  }

  /**
   * Update the state of the overlay
   * @param {string} state The state to set ('idle', 'active', 'paused')
   */
  updateOverlayState(state) {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        console.log('[OverlayManager] Cannot update overlay state - no valid overlay window');
        return;
      }
      
      console.log('[OverlayManager] Updating overlay state to:', state);
      this.overlayWindow.webContents.executeJavaScript(`
        if (window.updateState) {
          window.updateState('${state}');
        } else {
          window.postMessage({ type: 'set-state', data: { state: '${state}' } }, '*');
        }
      `).catch(err => {
        console.error('[OverlayManager] Error updating overlay state:', err);
      });
    } catch (error) {
      console.error('[OverlayManager] Error in updateOverlayState:', error);
    }
  }

  /**
   * Set the initial state of the overlay
   * @param {string} state The state to set ('idle', 'active', 'paused')
   */
  setOverlayState(state) {
    try {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
        console.log('[OverlayManager] Cannot set overlay state - no valid overlay window');
        return;
      }
      
      console.log('[OverlayManager] Setting overlay state:', state);
      this.overlayWindow.webContents.executeJavaScript(`
        if (window.updateState) {
          window.updateState('${state}');
        } else {
          window.postMessage({ type: 'set-state', data: { state: '${state}' } }, '*');
        }
      `).catch(err => {
        console.error('[OverlayManager] Error setting overlay state:', err);
      });
    } catch (error) {
      console.error('[OverlayManager] Error in setOverlayState:', error);
    }
  }

  /**
   * Check if the overlay window exists and is visible
   * @returns {boolean} True if the overlay exists and is visible
   */
  isOverlayVisible() {
    return this.overlayWindow && !this.overlayWindow.isDestroyed() && this.overlayWindow.isVisible();
  }
}

module.exports = new OverlayManager(); 