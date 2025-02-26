/**
 * Tests to verify that the Electron mock is working correctly
 */

const electron = require('electron');

describe('Electron Mock', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('app', () => {
    it('should mock app.getPath', () => {
      const userDataPath = electron.app.getPath('userData');
      expect(userDataPath).toBe('/mock/user/data');
      expect(electron.app.getPath).toHaveBeenCalledWith('userData');
    });

    it('should mock app.getName', () => {
      const appName = electron.app.getName();
      expect(appName).toBe('Juno AI Dictation');
      expect(electron.app.getName).toHaveBeenCalled();
    });
  });

  describe('BrowserWindow', () => {
    it('should create a BrowserWindow instance', () => {
      const options = { width: 800, height: 600 };
      const window = new electron.BrowserWindow(options);
      
      expect(window.options).toEqual(options);
      expect(window.id).toBeDefined();
      expect(typeof window.id).toBe('number');
    });

    it('should mock BrowserWindow methods', async () => {
      const window = new electron.BrowserWindow();
      
      await window.loadURL('https://example.com');
      window.show();
      window.setSize(1024, 768);
      
      expect(window.loadURL).toHaveBeenCalledWith('https://example.com');
      expect(window.show).toHaveBeenCalled();
      expect(window.setSize).toHaveBeenCalledWith(1024, 768);
    });

    it('should have a webContents property', () => {
      const window = new electron.BrowserWindow();
      
      expect(window.webContents).toBeDefined();
      expect(window.webContents.send).toBeDefined();
      
      window.webContents.send('test-channel', { data: 'test' });
      expect(window.webContents.send).toHaveBeenCalledWith('test-channel', { data: 'test' });
    });
  });

  describe('ipcMain', () => {
    it('should mock ipcMain.on', () => {
      const handler = jest.fn();
      electron.ipcMain.on('test-channel', handler);
      
      expect(electron.ipcMain.on).toHaveBeenCalledWith('test-channel', handler);
    });

    it('should mock ipcMain.handle', () => {
      const handler = jest.fn();
      electron.ipcMain.handle('test-channel', handler);
      
      expect(electron.ipcMain.handle).toHaveBeenCalledWith('test-channel', handler);
    });
  });

  describe('ipcRenderer', () => {
    it('should mock ipcRenderer.send', () => {
      electron.ipcRenderer.send('test-channel', { data: 'test' });
      
      expect(electron.ipcRenderer.send).toHaveBeenCalledWith('test-channel', { data: 'test' });
    });

    it('should mock ipcRenderer.invoke', async () => {
      // Default mock returns empty object
      let result = await electron.ipcRenderer.invoke('test-channel');
      expect(result).toEqual({});
      
      // Custom mock implementation
      electron.ipcRenderer.invoke.mockResolvedValueOnce({ custom: 'data' });
      result = await electron.ipcRenderer.invoke('test-channel');
      expect(result).toEqual({ custom: 'data' });
    });
  });

  describe('dialog', () => {
    it('should mock dialog.showOpenDialog', async () => {
      const result = await electron.dialog.showOpenDialog({ properties: ['openFile'] });
      
      expect(result).toEqual({ canceled: false, filePaths: ['/mock/file/path'] });
      expect(electron.dialog.showOpenDialog).toHaveBeenCalledWith({ properties: ['openFile'] });
    });

    it('should allow custom mock implementations', async () => {
      // Override the default mock for a specific test
      electron.dialog.showOpenDialog.mockResolvedValueOnce({ 
        canceled: true, 
        filePaths: [] 
      });
      
      const result = await electron.dialog.showOpenDialog();
      expect(result).toEqual({ canceled: true, filePaths: [] });
    });
  });
}); 