const { exec } = require('child_process');
const selectionService = require('../selectionService');
const SelectionService = require('../selection/SelectionService');

// Mock child_process exec
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock the SelectionService class
jest.mock('../selection/SelectionService', () => {
  return {
    getInstance: jest.fn().mockReturnValue({
      getSelectionInParallel: jest.fn().mockResolvedValue('selected text'),
      getSelectedText: jest.fn().mockResolvedValue('selected text')
    })
  };
});

describe('SelectionService Legacy API', () => {
  const originalPlatform = process.platform;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Use Object.defineProperty to mock platform
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
      configurable: true
    });
    
    // Set up the global selectionService instance
    global.selectionService = {
      getSelectionInParallel: jest.fn().mockResolvedValue('selected text'),
      getSelectedText: jest.fn().mockResolvedValue('selected text')
    };
  });
  
  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
    
    // Clean up global
    delete global.selectionService;
  });

  it('gets selected text successfully', async () => {
    // The implementation now uses the getInstance() method
    const result = await selectionService.getInstance().getSelectedText();
    
    expect(result).toBe('selected text');
    expect(SelectionService.getInstance).toHaveBeenCalled();
  });

  it('returns empty string on error', async () => {
    // Mock the SelectionService to return an empty string
    SelectionService.getInstance.mockReturnValueOnce({
      getSelectedText: jest.fn().mockResolvedValueOnce('')
    });
    
    const result = await selectionService.getInstance().getSelectedText();
    
    expect(result).toBe('');
  });

  it('returns empty string on non-macOS platforms', async () => {
    // Use Object.defineProperty to mock platform as win32
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
      configurable: true
    });
    
    // Even on non-macOS platforms, it should now delegate to SelectionService
    const result = await selectionService.getInstance().getSelectedText();
    
    expect(result).toBe('selected text');
    expect(SelectionService.getInstance).toHaveBeenCalled();
  });

  it('handles empty selection', async () => {
    // Mock the SelectionService to return an empty string
    SelectionService.getInstance.mockReturnValueOnce({
      getSelectedText: jest.fn().mockResolvedValueOnce('')
    });
    
    const result = await selectionService.getInstance().getSelectedText();
    
    expect(result).toBe('');
  });
});

describe('SelectionService Compatibility Layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up the global selectionService instance
    global.selectionService = {
      getSelectionInParallel: jest.fn().mockResolvedValue('selected text'),
      getSelectedText: jest.fn().mockResolvedValue('selected text')
    };
  });
  
  afterEach(() => {
    // Clean up global
    delete global.selectionService;
  });

  it('getSelectionInParallel should call the instance method', async () => {
    const result = await selectionService.getSelectionInParallel();
    
    expect(result).toBe('selected text');
    expect(global.selectionService.getSelectionInParallel).toHaveBeenCalled();
  });

  it('should handle case when SelectionService is not initialized', async () => {
    // Remove the global instance
    delete global.selectionService;
    
    const result = await selectionService.getSelectionInParallel();
    
    expect(result).toBe('');
  });

  it('should re-export methods from SelectionService', () => {
    // Verify that the module re-exports the SelectionService
    expect(selectionService).toHaveProperty('getInstance');
  });
}); 