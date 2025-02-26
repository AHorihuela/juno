/**
 * Example test demonstrating how to use Electron dialog mocks
 */

const electron = require('electron');
const { dialog } = electron;

// Mock implementation of a file manager
class FileManager {
  constructor() {
    this.currentFilePath = null;
  }

  async openFile() {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return null;
    }

    this.currentFilePath = result.filePaths[0];
    return this.currentFilePath;
  }

  async saveFile(content, filePath = null) {
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        defaultPath: this.currentFilePath,
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'Markdown', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        return false;
      }

      filePath = result.filePath;
      this.currentFilePath = filePath;
    }

    // In a real implementation, this would write to the file
    console.log(`Saving content to ${filePath}`);
    return true;
  }

  async confirmClose() {
    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      title: 'Unsaved Changes',
      message: 'Do you want to save changes before closing?'
    });

    return result.response;
  }
}

describe('Dialog Interactions', () => {
  let fileManager;

  beforeEach(() => {
    jest.clearAllMocks();
    fileManager = new FileManager();
  });

  describe('openFile', () => {
    it('should return null if dialog is canceled', async () => {
      // Mock dialog to return canceled: true
      dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });

      const result = await fileManager.openFile();

      expect(result).toBeNull();
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
        filters: [
          { name: 'Text Files', extensions: ['txt', 'md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
    });

    it('should return file path if file is selected', async () => {
      const mockFilePath = '/path/to/file.txt';
      dialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: [mockFilePath]
      });

      const result = await fileManager.openFile();

      expect(result).toBe(mockFilePath);
      expect(fileManager.currentFilePath).toBe(mockFilePath);
    });
  });

  describe('saveFile', () => {
    it('should prompt for file path if not provided', async () => {
      const mockFilePath = '/path/to/save.txt';
      dialog.showSaveDialog.mockResolvedValueOnce({
        canceled: false,
        filePath: mockFilePath
      });

      const result = await fileManager.saveFile('content');

      expect(result).toBe(true);
      expect(dialog.showSaveDialog).toHaveBeenCalled();
      expect(fileManager.currentFilePath).toBe(mockFilePath);
    });

    it('should use provided file path without showing dialog', async () => {
      const mockFilePath = '/path/to/existing.txt';

      const result = await fileManager.saveFile('content', mockFilePath);

      expect(result).toBe(true);
      expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    });

    it('should return false if save dialog is canceled', async () => {
      dialog.showSaveDialog.mockResolvedValueOnce({
        canceled: true,
        filePath: undefined
      });

      const result = await fileManager.saveFile('content');

      expect(result).toBe(false);
    });
  });

  describe('confirmClose', () => {
    it('should return user response from message box', async () => {
      // Mock response: 0 = Save, 1 = Don't Save, 2 = Cancel
      dialog.showMessageBox.mockResolvedValueOnce({ response: 1 });

      const result = await fileManager.confirmClose();

      expect(result).toBe(1);
      expect(dialog.showMessageBox).toHaveBeenCalledWith({
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        title: 'Unsaved Changes',
        message: 'Do you want to save changes before closing?'
      });
    });
  });
}); 