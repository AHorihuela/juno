/**
 * Utility functions for testing Electron applications
 */

const electron = require('electron');

/**
 * Creates a mock event object for IPC handlers
 * @param {Object} options - Options for the event
 * @param {Object} [options.sender] - The sender of the event
 * @returns {Object} A mock event object
 */
function createMockIpcEvent(options = {}) {
  return {
    sender: {
      send: jest.fn(),
      ...(options.sender || {})
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
  const defaultWebContents = {
    id: 'mock-web-contents',
    send: jest.fn(),
    executeJavaScript: jest.fn(),
    on: jest.fn()
  };

  const window = {
    id: 'mock-window',
    webContents: {
      ...defaultWebContents,
      ...(options.webContents || {})
    },
    loadURL: options.loadURL || jest.fn().mockResolvedValue(undefined),
    loadFile: jest.fn().mockResolvedValue(undefined),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    isVisible: jest.fn().mockReturnValue(true),
    on: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
    setSize: jest.fn(),
    getSize: jest.fn().mockReturnValue([800, 600]),
    setPosition: jest.fn(),
    getPosition: jest.fn().mockReturnValue([0, 0]),
    setBounds: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
    setTitle: jest.fn(),
    getTitle: jest.fn().mockReturnValue('Mock Window'),
    flashFrame: jest.fn(),
    options: options
  };
  
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
  // Access the mock call history to find handlers registered with on or handle
  const onCalls = electron.ipcMain.on.mock?.calls || [];
  const handleCalls = electron.ipcMain.handle.mock?.calls || [];
  
  const allCalls = [...onCalls, ...handleCalls];
  const handlerCall = allCalls.find(call => call[0] === channel);
  
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