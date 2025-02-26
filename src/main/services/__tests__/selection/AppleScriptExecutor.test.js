const AppleScriptExecutor = require('../../selection/AppleScriptExecutor');
const { exec } = require('child_process');

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

describe('AppleScriptExecutor', () => {
  beforeEach(() => {
    // Reset mocks
    exec.mockReset();
    
    // Set default timeout for tests
    jest.setTimeout(1000);
  });

  test('execute should run AppleScript and return result', async () => {
    // Mock successful execution
    exec.mockImplementation((cmd, callback) => {
      callback(null, 'test result', '');
    });

    const result = await AppleScriptExecutor.execute('tell application "System Events" to return "test"', 1000, 'Test');
    
    expect(result).toBe('test result');
    expect(exec).toHaveBeenCalledWith(
      'osascript -e \'tell application "System Events" to return "test"\'',
      expect.any(Function)
    );
  });

  test('execute should handle errors', async () => {
    // Mock failed execution
    exec.mockImplementation((cmd, callback) => {
      callback(new Error('Test error'), '', 'Error: Test error');
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const result = await AppleScriptExecutor.execute('tell application "System Events" to return "test"', 1000, 'Test');
    
    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  test('execute should handle warnings', async () => {
    // Mock execution with warning
    exec.mockImplementation((cmd, callback) => {
      callback(null, 'test result', 'Warning: Some warning');
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    const result = await AppleScriptExecutor.execute('tell application "System Events" to return "test"', 1000, 'Test');
    
    expect(result).toBe('test result');
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  test('execute should handle timeouts', async () => {
    // Mock timeout by not calling the callback
    exec.mockImplementation(() => {});
    
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Use a short timeout for the test
    const result = await AppleScriptExecutor.execute('tell application "System Events" to return "test"', 100, 'Test');
    
    // Wait for the timeout to occur
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('timed out'));
    
    consoleSpy.mockRestore();
  });

  test('executeWithRetry should retry on failure', async () => {
    // Mock execute to fail first, then succeed
    const executeSpy = jest.spyOn(AppleScriptExecutor, 'execute')
      .mockImplementationOnce(() => Promise.resolve(''))
      .mockImplementationOnce(() => Promise.resolve('success'));
    
    const result = await AppleScriptExecutor.executeWithRetry(
      'tell application "System Events" to return "test"',
      { timeoutMs: 100, retries: 3, retryDelayMs: 10, logPrefix: 'Test' }
    );
    
    expect(result).toBe('success');
    expect(executeSpy).toHaveBeenCalledTimes(2);
    
    executeSpy.mockRestore();
  });

  test('executeWithRetry should give up after all retries fail', async () => {
    // Mock execute to always fail
    const executeSpy = jest.spyOn(AppleScriptExecutor, 'execute')
      .mockImplementation(() => Promise.resolve(''));
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const result = await AppleScriptExecutor.executeWithRetry(
      'tell application "System Events" to return "test"',
      { timeoutMs: 100, retries: 3, retryDelayMs: 10, logPrefix: 'Test' }
    );
    
    expect(result).toBe('');
    expect(executeSpy).toHaveBeenCalledTimes(4); // Initial + 3 retries
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('All retry attempts failed'));
    
    executeSpy.mockRestore();
    consoleSpy.mockRestore();
  });
}); 