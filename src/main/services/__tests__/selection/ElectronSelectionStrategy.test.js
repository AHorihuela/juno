const { BrowserWindow } = require('electron');
const ElectronSelectionStrategy = require('../../selection/ElectronSelectionStrategy');

// Mock the electron module
jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: jest.fn()
  }
}));

describe('ElectronSelectionStrategy', () => {
  let strategy;
  let mockWindow;

  beforeEach(() => {
    strategy = new ElectronSelectionStrategy();
    
    // Create a mock window
    mockWindow = {
      isFocused: jest.fn().mockReturnValue(true),
      webContents: {
        executeJavaScript: jest.fn()
      }
    };
    
    // Reset mocks
    BrowserWindow.getAllWindows.mockReset();
    mockWindow.isFocused.mockReset();
    mockWindow.webContents.executeJavaScript.mockReset();
    
    // Default mock implementations
    BrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
    mockWindow.isFocused.mockReturnValue(true);
  });

  test('should initialize with the correct name', () => {
    expect(strategy.name).toBe('Electron');
  });

  test('isApplicable should return true for Electron apps', () => {
    expect(strategy.isApplicable('Cursor')).toBe(true);
    expect(strategy.isApplicable('Electron')).toBe(true);
    expect(strategy.isApplicable('Some Electron App')).toBe(true);
  });

  test('isApplicable should return false for non-Electron apps', () => {
    expect(strategy.isApplicable('Safari')).toBe(false);
    expect(strategy.isApplicable('Chrome')).toBe(false);
    expect(strategy.isApplicable('TextEdit')).toBe(false);
  });

  test('getSelection should return text from focused window', async () => {
    mockWindow.webContents.executeJavaScript.mockResolvedValue('Selected text');
    
    const result = await strategy.getSelection('Cursor');
    
    expect(result).toEqual({ text: 'Selected text', success: true });
    expect(mockWindow.isFocused).toHaveBeenCalled();
    expect(mockWindow.webContents.executeJavaScript).toHaveBeenCalled();
  });

  test('getSelection should return empty result when no text is selected', async () => {
    mockWindow.webContents.executeJavaScript.mockResolvedValue('');
    
    const result = await strategy.getSelection('Cursor');
    
    expect(result).toEqual({ text: '', success: false });
  });

  test('getSelection should handle errors from executeJavaScript', async () => {
    mockWindow.webContents.executeJavaScript.mockRejectedValue(new Error('Test error'));
    
    const result = await strategy.getSelection('Cursor');
    
    expect(result).toEqual({ text: '', success: false });
  });

  test('getSelection should try non-focused windows if no selection in focused windows', async () => {
    // First window is focused but has no selection
    const mockFocusedWindow = {
      isFocused: jest.fn().mockReturnValue(true),
      webContents: {
        executeJavaScript: jest.fn().mockResolvedValue('')
      }
    };
    
    // Second window is not focused but has selection
    const mockNonFocusedWindow = {
      isFocused: jest.fn().mockReturnValue(false),
      webContents: {
        executeJavaScript: jest.fn().mockResolvedValue('Selected text in non-focused window')
      }
    };
    
    BrowserWindow.getAllWindows.mockReturnValue([mockFocusedWindow, mockNonFocusedWindow]);
    
    const result = await strategy.getSelection('Cursor');
    
    expect(result).toEqual({ text: 'Selected text in non-focused window', success: true });
    expect(mockFocusedWindow.webContents.executeJavaScript).toHaveBeenCalled();
    expect(mockNonFocusedWindow.webContents.executeJavaScript).toHaveBeenCalled();
  });

  test('getSelection should return empty result when no windows have selection', async () => {
    BrowserWindow.getAllWindows.mockReturnValue([]);
    
    const result = await strategy.getSelection('Cursor');
    
    expect(result).toEqual({ text: '', success: false });
  });
}); 