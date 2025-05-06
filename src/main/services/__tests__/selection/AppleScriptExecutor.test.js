const AppleScriptExecutor = require('../../selection/AppleScriptExecutor');
const { execFile } = require('child_process');

// Mock child_process
jest.mock('child_process', () => ({
  execFile: jest.fn()
}));

// Mock logger
jest.mock('../../../utils/LogManager', () => ({
  getLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn()
  }))
}));

describe('AppleScriptExecutor', () => {
  beforeEach(() => {
    // Reset mocks
    execFile.mockReset();
    
    // Set default timeout for tests
    jest.setTimeout(1000);
  });

  test('execute should run AppleScript and return result', async () => {
    // Mock successful execution
    execFile.mockImplementation((cmd, args, options, callback) => {
      callback(null, 'test result', '');
    });

    const result = await AppleScriptExecutor.execute('tell application "System Events" to return "test"', 1000, 'Test');
    
    expect(result).toBe('test result');
    expect(execFile).toHaveBeenCalledWith(
      'osascript',
      ['-e', 'tell application "System Events" to return "test"'],
      expect.any(Object),
      expect.any(Function)
    );
  });

  test('execute should handle errors', async () => {
    // Mock failed execution
    execFile.mockImplementation((cmd, args, options, callback) => {
      callback(new Error('Test error'), '', 'Error: Test error');
    });
    
    const result = await AppleScriptExecutor.execute('tell application "System Events" to return "test"', 1000, 'Test');
    
    expect(result).toBe('');
    expect(execFile).toHaveBeenCalled();
  });

  test('execute should handle warnings', async () => {
    // Mock execution with warning
    execFile.mockImplementation((cmd, args, options, callback) => {
      callback(null, 'test result', 'Warning: Some warning');
    });
    
    const result = await AppleScriptExecutor.execute('tell application "System Events" to return "test"', 1000, 'Test');
    
    expect(result).toBe('test result');
    expect(execFile).toHaveBeenCalled();
  });

  test('execute should handle timeouts', async () => {
    // Set up a real timeout
    jest.useFakeTimers();
    
    // Mock timeout by not calling the callback
    execFile.mockImplementation(() => {
      // Return a mock child process
      return {
        on: jest.fn(),
        kill: jest.fn()
      };
    });
    
    // Start the execution but don't await it yet
    const resultPromise = AppleScriptExecutor.execute('tell application "System Events" to return "test"', 100, 'Test');
    
    // Fast-forward until the timeout happens
    jest.advanceTimersByTime(150);
    
    // Now await the result
    const result = await resultPromise;
    
    // Verify the result
    expect(result).toBe('');
    expect(execFile).toHaveBeenCalled();
    
    // Clean up
    jest.useRealTimers();
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
    
    const result = await AppleScriptExecutor.executeWithRetry(
      'tell application "System Events" to return "test"',
      { timeoutMs: 100, retries: 3, retryDelayMs: 10, logPrefix: 'Test' }
    );
    
    expect(result).toBe('');
    expect(executeSpy).toHaveBeenCalledTimes(4); // Initial + 3 retries
    
    executeSpy.mockRestore();
  });
}); 