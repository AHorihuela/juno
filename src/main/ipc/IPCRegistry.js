/**
 * IPCRegistry - Centralized registry for IPC handlers with validation
 * 
 * This module provides a structured way to register and manage IPC handlers
 * with consistent validation and error handling.
 */

const { ipcMain } = require('electron');

class IPCRegistry {
  constructor() {
    this.handlers = new Map();
    this.validChannels = new Set();
  }

  /**
   * Register an IPC handler with validation
   * @param {string} channel - The IPC channel name
   * @param {Function} handler - The handler function
   * @param {Object} options - Options for the handler
   * @param {boolean} options.requiresWindow - Whether the handler requires a valid window
   * @param {boolean} options.isAsync - Whether the handler is async (invoke vs on)
   */
  register(channel, handler, options = { requiresWindow: false, isAsync: true }) {
    if (this.handlers.has(channel)) {
      console.warn(`[IPCRegistry] Handler for channel '${channel}' is being overwritten`);
    }
    
    this.handlers.set(channel, { handler, options });
    this.validChannels.add(channel);
    
    if (options.isAsync) {
      ipcMain.handle(channel, async (event, ...args) => {
        try {
          if (options.requiresWindow && (!event.sender || event.sender.isDestroyed())) {
            throw new Error('Window is not available');
          }
          
          return await handler(event, ...args);
        } catch (error) {
          console.error(`[IPCRegistry] Error in handler for '${channel}':`, error);
          throw error;
        }
      });
    } else {
      ipcMain.on(channel, (event, ...args) => {
        try {
          if (options.requiresWindow && (!event.sender || event.sender.isDestroyed())) {
            console.error(`[IPCRegistry] Window not available for channel '${channel}'`);
            return;
          }
          
          handler(event, ...args);
        } catch (error) {
          console.error(`[IPCRegistry] Error in handler for '${channel}':`, error);
          // For non-async handlers, we can't throw, so we'll send an error response if possible
          if (event.sender && !event.sender.isDestroyed()) {
            event.reply(`${channel}-error`, error.message);
          }
        }
      });
    }
    
    return this;
  }

  /**
   * Unregister an IPC handler
   * @param {string} channel - The IPC channel name
   */
  unregister(channel) {
    if (!this.handlers.has(channel)) {
      console.warn(`[IPCRegistry] No handler registered for channel '${channel}'`);
      return this;
    }
    
    const { options } = this.handlers.get(channel);
    
    if (options.isAsync) {
      ipcMain.removeHandler(channel);
    } else {
      // For non-async handlers, we can't easily remove specific handlers
      // This is a limitation of Electron's IPC system
      console.warn(`[IPCRegistry] Cannot specifically remove non-async handler for '${channel}'`);
    }
    
    this.handlers.delete(channel);
    this.validChannels.delete(channel);
    
    return this;
  }

  /**
   * Check if a channel is valid
   * @param {string} channel - The IPC channel name
   * @returns {boolean} Whether the channel is valid
   */
  isValidChannel(channel) {
    return this.validChannels.has(channel);
  }

  /**
   * Get all registered channels
   * @returns {string[]} Array of registered channel names
   */
  getRegisteredChannels() {
    return Array.from(this.validChannels);
  }

  /**
   * Unregister all handlers
   */
  unregisterAll() {
    for (const [channel, { options }] of this.handlers.entries()) {
      if (options.isAsync) {
        ipcMain.removeHandler(channel);
      }
    }
    
    this.handlers.clear();
    this.validChannels.clear();
    
    return this;
  }
}

module.exports = new IPCRegistry(); 