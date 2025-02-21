const { clipboard } = require('electron');
const { exec } = require('child_process');
const notificationService = require('../../main/services/notificationService');
const textInsertionService = require('../../main/services/textInsertionService');

// Mock dependencies
jest.mock('electron', () => ({
  clipboard: {
    readText: jest.fn(),
    writeText: jest.fn()
  }
}));

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('../../main/services/notificationService', () => ({
  showNotification: jest.fn()
}));

describe('TextInsertionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    textInsertionService.isInserting = false;
    textInsertionService.originalClipboard = null;
  });

  describe('clipboard management', () => {
    it('saves and restores clipboard content', () => {
      const originalContent = 'original content';
      clipboard.readText.mockReturnValue(originalContent);

      textInsertionService.saveClipboard();
      expect(textInsertionService.originalClipboard).toBe(originalContent);

      textInsertionService.restoreClipboard();
      expect(clipboard.writeText).toHaveBeenCalledWith(originalContent);
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
      clipboard.readText
        .mockReturnValueOnce('original')  // For saveClipboard
        .mockReturnValueOnce(text);       // For verification
      
      exec.mockImplementation((cmd, callback) => callback(null));
      
      const success = await textInsertionService.insertText(text);
      
      expect(success).toBe(true);
      expect(clipboard.writeText).toHaveBeenCalledWith(text);
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('osascript'),
        expect.any(Function)
      );
    });

    it('handles AppleScript failure', async () => {
      const text = 'test text';
      clipboard.readText
        .mockReturnValueOnce('original')
        .mockReturnValueOnce(text);
      
      exec.mockImplementation((cmd, callback) => 
        callback(new Error('AppleScript failed'))
      );
      
      const success = await textInsertionService.insertText(text);
      
      expect(success).toBe(false);
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        'Text Insertion Failed',
        'Click here to copy the text to clipboard',
        'info'
      );
      expect(clipboard.writeText).toHaveBeenLastCalledWith(text);
    });

    it('prevents concurrent insertions', async () => {
      textInsertionService.isInserting = true;
      const success = await textInsertionService.insertText('test');
      expect(success).toBe(false);
    });
  });

  describe('copy popup', () => {
    it('shows notification and copies text', () => {
      const text = 'test text';
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