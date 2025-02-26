/**
 * Utility functions for testing Electron applications
 */

const electron = require('electron');

/**
 * Creates a mock event object for IPC handlers
 * @param {Object} options - Options for the event
 * @param {string} options.sender - The sender of the event
 * @returns {Object} A mock event object
 */
function createMockIpcEvent(options = {}) {
  return {
    sender: {
      send: jest.fn(),
      ...options.sender
    },
    returnValue: undefined,
    reply: jest.fn()
  };
}

/**
 * Creates a mock BrowserWindow with customizable options
 * @param {Object} options - Options for the window
 * @returns {Object} A mock BrowserWindow instance
 */
function createMockBrowserWindow(options = {}) {
  const window = new electron.BrowserWindow(options);
  
  // Allow overriding default mock implementations
  if (options.loadURL) {
    window.loadURL.mockImplementation(options.loadURL);
  }
  
  if (options.webContents) {
    Object.assign(window.webContents, options.webContents);
  }
  
  return window;
}

/**
 * Simulates an IPC message from renderer to main process
 * @param {string} channel - The IPC channel
 * @param {...any} args - Arguments to pass with the message
 */
function simulateIpcMessage(channel, ...args) {
  // Find the handler for this channel
  const handler = findIpcHandler(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  
  // Create a mock event
  const event = createMockIpcEvent();
  
  // Call the handler
  return handler(event, ...args);
}

/**
 * Finds an IPC handler for a given channel
 * @param {string} channel - The IPC channel to find a handler for
 * @returns {Function|null} The handler function or null if not found
 */
function findIpcHandler(channel) {
  // This is a simplification - in a real implementation, we would need to
  // track registered handlers when they're added via ipcMain.on/handle
  const mockCalls = electron.ipcMain.on.mock.calls.concat(
    electron.ipcMain.handle.mock.calls
  );
  
  const handlerCall = mockCalls.find(call => call[0] === channel);
  return handlerCall ? handlerCall[1] : null;
}

/**
 * Resets all Electron mocks
 */
function resetElectronMocks() {
  // Reset all mock functions
  jest.clearAllMocks();
  
  // Reset any custom implementations
  Object.values(electron).forEach(module => {
    if (typeof module === 'object' && module !== null) {
      Object.values(module).forEach(method => {
        if (typeof method === 'function' && method.mockReset) {
          method.mockReset();
        }
      });
    }
  });
}

module.exports = {
  createMockIpcEvent,
  createMockBrowserWindow,
  simulateIpcMessage,
  findIpcHandler,
  resetElectronMocks
}; 