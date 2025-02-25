const { exec } = require('child_process');
const selectionService = require('../selectionService');

// Mock child_process exec
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

describe('SelectionService', () => {
  const originalPlatform = process.platform;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Use Object.defineProperty to mock platform
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
      configurable: true
    });
  });
  
  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
  });

  it('gets selected text successfully', async () => {
    exec.mockImplementation((cmd, callback) => callback(null, 'selected text\n'));
    
    const result = await selectionService.getSelectedText();
    
    expect(result).toBe('selected text');
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('osascript'),
      expect.any(Function)
    );
  });

  it('returns empty string on error', async () => {
    exec.mockImplementation((cmd, callback) => 
      callback(new Error('AppleScript failed'))
    );
    
    const result = await selectionService.getSelectedText();
    
    expect(result).toBe('');
  });

  it('returns empty string on non-macOS platforms', async () => {
    // Use Object.defineProperty to mock platform as win32
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
      configurable: true
    });
    
    const result = await selectionService.getSelectedText();
    
    expect(result).toBe('');
    expect(exec).not.toHaveBeenCalled();
  });

  it('handles empty selection', async () => {
    exec.mockImplementation((cmd, callback) => callback(null, '\n'));
    
    const result = await selectionService.getSelectedText();
    
    expect(result).toBe('');
  });
}); 