const SelectionStrategy = require('../../selection/SelectionStrategy');

describe('SelectionStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new SelectionStrategy('Test');
  });

  test('should initialize with the correct name', () => {
    expect(strategy.name).toBe('Test');
  });

  test('should throw error when getSelection is not implemented', async () => {
    await expect(strategy.getSelection('TestApp')).rejects.toThrow(
      'SelectionStrategy.getSelection must be implemented by subclasses'
    );
  });

  test('isApplicable should return true by default', () => {
    expect(strategy.isApplicable('TestApp')).toBe(true);
  });

  test('log should call console.log with correct prefix', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    strategy.log('test message');
    expect(consoleSpy).toHaveBeenCalledWith('[TestStrategy] test message');
    consoleSpy.mockRestore();
  });

  test('log should include data when provided', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const data = { key: 'value' };
    strategy.log('test message', data);
    expect(consoleSpy).toHaveBeenCalledWith('[TestStrategy] test message', data);
    consoleSpy.mockRestore();
  });

  test('logError should call console.error with correct prefix', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    strategy.logError('test error');
    expect(consoleSpy).toHaveBeenCalledWith('[TestStrategy] test error');
    consoleSpy.mockRestore();
  });

  test('logError should include error when provided', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const error = new Error('test error');
    strategy.logError('error message', error);
    expect(consoleSpy).toHaveBeenCalledWith('[TestStrategy] error message', error);
    consoleSpy.mockRestore();
  });
}); 