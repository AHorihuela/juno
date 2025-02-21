const { clipboard } = require('electron');
const { exec } = require('child_process');
const notificationService = require('../notificationService');
const textInsertionService = require('../textInsertionService');

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

jest.mock('../notificationService', () => ({
  showNotification: jest.fn()
}));

describe('TextInsertionService', () => {
  const originalPlatform = process.platform;
  
  beforeEach(() => {
    jest.clearAllMocks();
    textInsertionService.isInserting = false;
    textInsertionService.originalClipboard = null;
    
    // Mock process.platform using Object.defineProperty
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });

  describe('Clipboard Management', () => {
    it('saves clipboard content correctly', () => {
      clipboard.readText.mockReturnValue('original content');
      
      textInsertionService.saveClipboard();
      
      expect(clipboard.readText).toHaveBeenCalled();
      expect(textInsertionService.originalClipboard).toBe('original content');
    });

    it('restores clipboard content correctly', () => {
      textInsertionService.originalClipboard = 'original content';
      
      textInsertionService.restoreClipboard();
      
      expect(clipboard.writeText).toHaveBeenCalledWith('original content');
      expect(textInsertionService.originalClipboard).toBeNull();
    });

    it('handles null clipboard content when restoring', () => {
      textInsertionService.originalClipboard = null;
      
      textInsertionService.restoreClipboard();
      
      expect(clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('Text Insertion', () => {
    it('adds space after inserted text', async () => {
      clipboard.readText
        .mockReturnValueOnce('original')  // For saveClipboard
        .mockReturnValueOnce('test text '); // For verification
      
      exec.mockImplementation((cmd, callback) => callback(null, ''));
      
      await textInsertionService.insertText('test text');
      
      expect(clipboard.writeText).toHaveBeenCalledWith('test text ');
    });

    it('handles empty text gracefully', async () => {
      clipboard.readText
        .mockReturnValueOnce('original')
        .mockReturnValueOnce('');
      
      exec.mockImplementation((cmd, callback) => callback(null, ''));
      
      await textInsertionService.insertText('');
      
      expect(clipboard.writeText).toHaveBeenCalledWith('');
    });

    it('handles null text gracefully', async () => {
      clipboard.readText
        .mockReturnValueOnce('original')
        .mockReturnValueOnce('');
      
      exec.mockImplementation((cmd, callback) => callback(null, ''));
      
      await textInsertionService.insertText(null);
      
      expect(clipboard.writeText).toHaveBeenCalledWith('');
    });

    it('prevents concurrent insertions', async () => {
      textInsertionService.isInserting = true;
      
      const result = await textInsertionService.insertText('test');
      
      expect(result).toBe(false);
      expect(clipboard.writeText).not.toHaveBeenCalled();
    });

    it('restores clipboard after successful insertion', async () => {
      const originalContent = 'original content';
      clipboard.readText
        .mockReturnValueOnce(originalContent)
        .mockReturnValueOnce('test text ');
      
      exec.mockImplementation((cmd, callback) => callback(null, ''));
      
      await textInsertionService.insertText('test text');
      
      expect(clipboard.writeText).toHaveBeenCalledWith(originalContent);
    });

    it('handles AppleScript errors gracefully', async () => {
      clipboard.readText.mockReturnValue('original');
      exec.mockImplementation((cmd, callback) => 
        callback(new Error('AppleScript failed'))
      );
      
      await textInsertionService.insertText('test text');
      
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        'Text Insertion Failed',
        'Click here to copy the text to clipboard',
        'info'
      );
      expect(clipboard.writeText).toHaveBeenCalledWith('test text ');
    });
  });

  describe('Copy Popup', () => {
    it('shows notification and copies text with space', () => {
      textInsertionService.showCopyPopup('test text');
      
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        'Text Available',
        'Click here to copy the text to clipboard',
        'info'
      );
      expect(clipboard.writeText).toHaveBeenCalledWith('test text ');
    });

    it('handles empty text in popup', () => {
      textInsertionService.showCopyPopup('');
      
      expect(clipboard.writeText).toHaveBeenCalledWith('');
    });

    it('handles null text in popup', () => {
      textInsertionService.showCopyPopup(null);
      
      expect(clipboard.writeText).toHaveBeenCalledWith('');
    });
  });

  describe('Platform Support', () => {
    let originalPlatform;
    
    beforeEach(() => {
      originalPlatform = process.platform;
    });
    
    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: false,
        enumerable: true,
        configurable: true
      });
    });

    it('throws error for non-macOS platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: false,
        enumerable: true,
        configurable: true
      });
      
      await expect(textInsertionService.insertText('test')).rejects.toThrow('Text insertion is only supported on macOS');
    });
  });
}); 