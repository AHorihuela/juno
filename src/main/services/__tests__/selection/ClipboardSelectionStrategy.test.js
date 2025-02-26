const ClipboardSelectionStrategy = require('../../selection/ClipboardSelectionStrategy');
const AppleScriptExecutor = require('../../selection/AppleScriptExecutor');

// Mock AppleScriptExecutor
jest.mock('../../selection/AppleScriptExecutor', () => ({
  executeWithRetry: jest.fn()
}));

describe('ClipboardSelectionStrategy', () => {
  let strategy;
  let mockContextService;

  beforeEach(() => {
    // Reset mocks
    AppleScriptExecutor.executeWithRetry.mockReset();
    
    // Create mock context service
    mockContextService = {
      getActiveApplication: jest.fn().mockResolvedValue('TestApp'),
      startInternalOperation: jest.fn(),
      endInternalOperation: jest.fn()
    };
    
    // Create strategy instance
    strategy = new ClipboardSelectionStrategy(mockContextService);
    
    // Add logging methods to the strategy
    strategy.log = jest.fn();
    strategy.logError = jest.fn();
  });

  test('should initialize with correct name', () => {
    expect(strategy.name).toBe('Clipboard');
  });

  test('isApplicable should return true for all applications', async () => {
    const result = await strategy.isApplicable('TestApp');
    expect(result).toBe(true);
  });

  test('getSelection should copy selection to clipboard and return it', async () => {
    // Mock successful AppleScript execution
    AppleScriptExecutor.executeWithRetry.mockResolvedValue('test selection');
    
    const result = await strategy.getSelection('TestApp');
    
    expect(result).toEqual({ text: 'test selection', success: true });
    expect(AppleScriptExecutor.executeWithRetry).toHaveBeenCalledWith(
      expect.stringContaining('tell application "System Events"'),
      expect.objectContaining({
        timeoutMs: expect.any(Number),
        retries: expect.any(Number),
        retryDelayMs: expect.any(Number),
        logPrefix: 'Clipboard'
      })
    );
    expect(mockContextService.startInternalOperation).toHaveBeenCalled();
    expect(mockContextService.endInternalOperation).toHaveBeenCalled();
  });

  test('getSelection should handle empty selection', async () => {
    // Mock empty selection
    AppleScriptExecutor.executeWithRetry.mockResolvedValue('');
    
    const result = await strategy.getSelection('TestApp');
    
    expect(result).toEqual({ text: '', success: false });
    expect(mockContextService.startInternalOperation).toHaveBeenCalled();
    expect(mockContextService.endInternalOperation).toHaveBeenCalled();
  });

  test('getSelection should handle AppleScript errors', async () => {
    // Mock AppleScript error
    AppleScriptExecutor.executeWithRetry.mockResolvedValue('');
    
    const result = await strategy.getSelection('TestApp');
    
    expect(result).toEqual({ text: '', success: false });
    expect(mockContextService.startInternalOperation).toHaveBeenCalled();
    expect(mockContextService.endInternalOperation).toHaveBeenCalled();
  });

  test('getSelection should handle unexpected errors', async () => {
    // Mock unexpected error
    AppleScriptExecutor.executeWithRetry.mockRejectedValue(new Error('Test error'));
    
    const result = await strategy.getSelection('TestApp');
    
    expect(result).toEqual({ text: '', success: false });
    expect(strategy.logError).toHaveBeenCalled();
    expect(mockContextService.startInternalOperation).toHaveBeenCalled();
    expect(mockContextService.endInternalOperation).toHaveBeenCalled();
  });
}); 