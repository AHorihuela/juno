const { clipboard, globalShortcut } = require('electron');
const textInsertionService = require('../textInsertionService');
const notificationService = require('../notificationService');

// Mock dependencies
jest.mock('electron', () => ({
  clipboard: {
    readText: jest.fn(),
    writeText: jest.fn(),
  },
  globalShortcut: {
    register: jest.fn(),
    unregister: jest.fn(),
  },
}));
jest.mock('../notificationService');

describe('TextInsertionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    textInsertionService.originalClipboard = null;
    
    // Default mock values
    clipboard.readText.mockReturnValue('original clipboard');
    globalShortcut.register.mockReturnValue(true);
  });

  describe('clipboard management', () => {
    it('saves and restores clipboard content', () => {
      const originalText = 'original text';
      clipboard.readText.mockReturnValue(originalText);

      textInsertionService.saveClipboard();
      expect(textInsertionService.originalClipboard).toBe(originalText);

      textInsertionService.restoreClipboard();
      expect(clipboard.writeText).toHaveBeenCalledWith(originalText);
      expect(textInsertionService.originalClipboard).toBeNull();
    });

    it('only restores if there is saved content', () => {
      textInsertionService.originalClipboard = null;
      textInsertionService.restoreClipboard();
      expect(clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('text insertion', () => {
    it('successfully inserts text', async () => {
      const text = 'test text';
      
      const success = await textInsertionService.insertText(text);
      
      expect(success).toBe(true);
      expect(clipboard.writeText).toHaveBeenCalledWith(text);
      expect(globalShortcut.register).toHaveBeenCalledWith(
        'CommandOrControl+V',
        expect.any(Function)
      );
      expect(clipboard.writeText).toHaveBeenCalledWith('original clipboard');
    });

    it('handles shortcut registration failure', async () => {
      const text = 'test text';
      globalShortcut.register.mockReturnValue(false);

      const success = await textInsertionService.insertText(text);
      
      expect(success).toBe(false);
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        'Text Insertion Failed',
        'Click here to copy the text to clipboard',
        'info'
      );
      expect(clipboard.writeText).toHaveBeenLastCalledWith(text);
    });

    it('cleans up shortcuts after insertion', async () => {
      const text = 'test text';
      
      await textInsertionService.insertText(text);
      
      // Fast-forward timers to trigger cleanup
      jest.advanceTimersByTime(1000);
      
      expect(globalShortcut.unregister).toHaveBeenCalledWith('CommandOrControl+V');
    });
  });

  describe('copy popup', () => {
    it('shows notification and copies text', () => {
      const text = 'popup text';
      
      textInsertionService.showCopyPopup(text);
      
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        'Text Available',
        'Click here to copy the text to clipboard',
        'info'
      );
      expect(clipboard.writeText).toHaveBeenCalledWith(text);
    });
  });
}); 