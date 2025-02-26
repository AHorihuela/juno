/**
 * Tests for the Electron test utilities
 */

const electron = require('electron');
const utils = require('./electron-test-utils');

describe('Electron Test Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMockIpcEvent', () => {
    it('should create a default mock IPC event', () => {
      const event = utils.createMockIpcEvent();
      
      expect(event).toBeDefined();
      expect(event.sender).toBeDefined();
      expect(event.sender.send).toBeDefined();
      expect(event.reply).toBeDefined();
    });

    it('should allow customizing the sender', () => {
      const customSender = {
        send: jest.fn(),
        id: 'custom-sender'
      };
      
      const event = utils.createMockIpcEvent({ sender: customSender });
      
      expect(event.sender.id).toBe('custom-sender');
      expect(event.sender.send).toBe(customSender.send);
    });
  });

  describe('createMockBrowserWindow', () => {
    it('should create a mock BrowserWindow with default options', () => {
      const window = utils.createMockBrowserWindow();
      
      expect(window).toBeDefined();
      expect(window.loadURL).toBeDefined();
      expect(window.webContents).toBeDefined();
    });

    it('should allow customizing window options', () => {
      const options = { width: 1200, height: 800 };
      const window = utils.createMockBrowserWindow(options);
      
      expect(window.options).toEqual(options);
    });

    it('should allow overriding loadURL implementation', async () => {
      const customLoadURL = jest.fn().mockResolvedValue('custom-result');
      const window = utils.createMockBrowserWindow({ loadURL: customLoadURL });
      
      const result = await window.loadURL('https://example.com');
      
      expect(result).toBe('custom-result');
      expect(customLoadURL).toHaveBeenCalledWith('https://example.com');
    });

    it('should allow customizing webContents', () => {
      const customWebContents = {
        id: 'custom-web-contents',
        customMethod: jest.fn()
      };
      
      const window = utils.createMockBrowserWindow({ webContents: customWebContents });
      
      expect(window.webContents.id).toBe('custom-web-contents');
      expect(window.webContents.customMethod).toBeDefined();
      expect(window.webContents.send).toBeDefined(); // Original method should still exist
    });
  });

  describe('findIpcHandler and simulateIpcMessage', () => {
    it('should find a registered handler for a channel', () => {
      const handler = jest.fn();
      electron.ipcMain.on('test-channel', handler);
      
      const foundHandler = utils.findIpcHandler('test-channel');
      
      expect(foundHandler).toBe(handler);
    });

    it('should return null if no handler is found', () => {
      const handler = utils.findIpcHandler('non-existent-channel');
      
      expect(handler).toBeNull();
    });

    it('should simulate an IPC message and call the handler', () => {
      const handler = jest.fn();
      electron.ipcMain.on('test-channel', handler);
      
      utils.simulateIpcMessage('test-channel', 'arg1', 'arg2');
      
      expect(handler).toHaveBeenCalledWith(expect.any(Object), 'arg1', 'arg2');
    });

    it('should throw an error if no handler is registered for the channel', () => {
      expect(() => {
        utils.simulateIpcMessage('non-existent-channel');
      }).toThrow('No handler registered for channel: non-existent-channel');
    });
  });

  describe('resetElectronMocks', () => {
    it('should reset all electron mocks', () => {
      // Set up some mocks with custom implementations
      electron.app.getPath.mockImplementation(() => 'custom-path');
      electron.dialog.showOpenDialog.mockResolvedValue({ custom: true });
      
      // Call some methods to record calls
      electron.app.getPath('userData');
      electron.dialog.showOpenDialog();
      
      // Verify calls were recorded
      expect(electron.app.getPath).toHaveBeenCalled();
      expect(electron.dialog.showOpenDialog).toHaveBeenCalled();
      
      // Reset mocks
      utils.resetElectronMocks();
      
      // Verify calls were cleared
      expect(electron.app.getPath).not.toHaveBeenCalled();
      expect(electron.dialog.showOpenDialog).not.toHaveBeenCalled();
      
      // Verify custom implementations were reset
      const path = electron.app.getPath('userData');
      expect(path).toBe('/mock/user/data'); // Back to default
    });
  });
}); 