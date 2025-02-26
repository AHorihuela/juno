const AppNameProvider = require('../../selection/AppNameProvider');
const AppleScriptExecutor = require('../../selection/AppleScriptExecutor');

// Mock the AppleScriptExecutor
jest.mock('../../selection/AppleScriptExecutor', () => ({
  execute: jest.fn()
}));

describe('AppNameProvider', () => {
  let appNameProvider;
  
  beforeEach(() => {
    // Reset mocks
    AppleScriptExecutor.execute.mockReset();
    
    // Create a new instance for each test
    appNameProvider = new AppNameProvider();
  });

  test('should initialize with default cache TTL', () => {
    expect(appNameProvider.cacheTTL).toBe(5000);
    expect(appNameProvider.cache).toEqual({ name: '', timestamp: 0 });
  });

  test('getActiveAppName should execute AppleScript and return app name', async () => {
    // Mock AppleScript execution to return app name
    AppleScriptExecutor.execute.mockResolvedValue('Safari');
    
    const result = await appNameProvider.getActiveAppName();
    
    expect(result).toBe('Safari');
    expect(AppleScriptExecutor.execute).toHaveBeenCalledWith(
      expect.stringContaining('tell application "System Events"'),
      500,
      'AppNameProvider'
    );
    expect(appNameProvider.cache.name).toBe('Safari');
    expect(appNameProvider.cache.timestamp).toBeGreaterThan(0);
  });

  test('getActiveAppName should handle AppleScript errors', async () => {
    // Mock AppleScript execution to fail
    AppleScriptExecutor.execute.mockRejectedValue(new Error('AppleScript error'));
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const result = await appNameProvider.getActiveAppName();
    
    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error getting app name'),
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });

  test('getActiveAppName should handle empty result', async () => {
    // Mock AppleScript execution to return empty string
    AppleScriptExecutor.execute.mockResolvedValue('');
    
    const result = await appNameProvider.getActiveAppName();
    
    expect(result).toBe('');
    expect(appNameProvider.cache.name).toBe('');
  });

  test('getActiveAppName should return cached app name if available', async () => {
    // Set up cache
    appNameProvider.cache = { name: 'Safari', timestamp: Date.now() };
    
    const result = await appNameProvider.getActiveAppName();
    
    expect(result).toBe('Safari');
    expect(AppleScriptExecutor.execute).not.toHaveBeenCalled();
  });

  test('getActiveAppName should refresh cache if expired', async () => {
    // Set up expired cache
    appNameProvider.cache = { name: 'Safari', timestamp: Date.now() - 6000 }; // Expired by 1s
    
    // Mock AppleScript execution to return new app name
    AppleScriptExecutor.execute.mockResolvedValue('Google Chrome');
    
    const result = await appNameProvider.getActiveAppName();
    
    expect(result).toBe('Google Chrome');
    expect(AppleScriptExecutor.execute).toHaveBeenCalled();
    expect(appNameProvider.cache.name).toBe('Google Chrome');
    expect(appNameProvider.cache.timestamp).toBeGreaterThan(Date.now() - 100);
  });

  test('preloadAppName should update cache', async () => {
    // Mock AppleScript execution to return app name
    AppleScriptExecutor.execute.mockResolvedValue('Firefox');
    
    const result = await appNameProvider.preloadAppName();
    
    expect(result).toBe('Firefox');
    expect(AppleScriptExecutor.execute).toHaveBeenCalled();
    expect(appNameProvider.cache.name).toBe('Firefox');
    expect(appNameProvider.cache.timestamp).toBeGreaterThan(Date.now() - 100);
  });

  test('invalidateCache should reset cache variables', () => {
    // Set up cache
    appNameProvider.cache = { name: 'Safari', timestamp: Date.now() };
    
    appNameProvider.invalidateCache();
    
    expect(appNameProvider.cache.name).toBe('');
    expect(appNameProvider.cache.timestamp).toBe(0);
  });
}); 