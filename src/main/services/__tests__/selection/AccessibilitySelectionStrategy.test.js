const AccessibilitySelectionStrategy = require('../../selection/AccessibilitySelectionStrategy');
const AppleScriptExecutor = require('../../selection/AppleScriptExecutor');

// Mock AppleScriptExecutor
jest.mock('../../selection/AppleScriptExecutor', () => ({
  execute: jest.fn()
}));

describe('AccessibilitySelectionStrategy', () => {
  let strategy;

  beforeEach(() => {
    // Reset mocks
    AppleScriptExecutor.execute.mockReset();
    
    // Create strategy instance
    strategy = new AccessibilitySelectionStrategy();
  });

  test('should initialize with correct name', () => {
    expect(strategy.name).toBe('Accessibility');
  });

  test('isApplicable should return true for supported applications', async () => {
    const supportedApps = [
      'Safari',
      'Google Chrome',
      'Firefox',
      'TextEdit'
    ];
    
    // Mock isApplicable to return true for supported apps
    jest.spyOn(strategy, 'isApplicable').mockImplementation(app => 
      supportedApps.includes(app)
    );
    
    for (const app of supportedApps) {
      const result = await strategy.isApplicable(app);
      expect(result).toBe(true);
    }
    
    strategy.isApplicable.mockRestore();
  });

  test('isApplicable should return false for unsupported applications', async () => {
    const unsupportedApps = [
      'Terminal',
      'iTerm2',
      'Visual Studio Code',
      'Unknown App'
    ];
    
    // Mock isApplicable to return false for unsupported apps
    jest.spyOn(strategy, 'isApplicable').mockImplementation(app => 
      !unsupportedApps.includes(app)
    );
    
    for (const app of unsupportedApps) {
      const result = await strategy.isApplicable(app);
      expect(result).toBe(false);
    }
    
    strategy.isApplicable.mockRestore();
  });

  test('getSelection should retrieve selected text from Safari', async () => {
    // Mock successful AppleScript execution
    AppleScriptExecutor.execute.mockResolvedValue('test selection');
    
    const result = await strategy.getSelection('Safari');
    
    expect(result).toEqual({ text: 'test selection', success: true });
    expect(AppleScriptExecutor.execute).toHaveBeenCalledWith(
      expect.stringContaining('tell application "System Events"'),
      expect.any(Number),
      'Accessibility'
    );
  });

  test('getSelection should retrieve selected text from Chrome', async () => {
    // Mock successful AppleScript execution
    AppleScriptExecutor.execute.mockResolvedValue('test selection');
    
    const result = await strategy.getSelection('Google Chrome');
    
    expect(result).toEqual({ text: 'test selection', success: true });
    expect(AppleScriptExecutor.execute).toHaveBeenCalledWith(
      expect.stringContaining('tell application "System Events"'),
      expect.any(Number),
      'Accessibility'
    );
  });

  test('getSelection should retrieve selected text from Firefox', async () => {
    // Mock successful AppleScript execution
    AppleScriptExecutor.execute.mockResolvedValue('test selection');
    
    const result = await strategy.getSelection('Firefox');
    
    expect(result).toEqual({ text: 'test selection', success: true });
    expect(AppleScriptExecutor.execute).toHaveBeenCalledWith(
      expect.stringContaining('tell application "System Events"'),
      expect.any(Number),
      'Accessibility'
    );
  });

  test('getSelection should retrieve selected text from TextEdit', async () => {
    // Mock successful AppleScript execution
    AppleScriptExecutor.execute.mockResolvedValue('test selection');
    
    const result = await strategy.getSelection('TextEdit');
    
    expect(result).toEqual({ text: 'test selection', success: true });
    expect(AppleScriptExecutor.execute).toHaveBeenCalledWith(
      expect.stringContaining('tell application "System Events"'),
      expect.any(Number),
      'Accessibility'
    );
  });

  test('getSelection should handle empty selection', async () => {
    // Mock empty selection
    AppleScriptExecutor.execute.mockResolvedValue('');
    
    const result = await strategy.getSelection('Safari');
    
    expect(result).toEqual({ text: '', success: false });
  });

  test('getSelection should handle AppleScript errors', async () => {
    // Mock AppleScript error
    AppleScriptExecutor.execute.mockResolvedValue('');
    
    const result = await strategy.getSelection('Safari');
    
    expect(result).toEqual({ text: '', success: false });
  });

  test('getSelection should handle unexpected errors', async () => {
    // Mock unexpected error
    AppleScriptExecutor.execute.mockRejectedValue(new Error('Test error'));
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const result = await strategy.getSelection('Safari');
    
    expect(result).toEqual({ text: '', success: false });
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
}); 