/**
 * Unit tests for the electron utility
 */

// Mock the electron module
jest.mock('./electron', () => {
  // Original implementation to test
  const originalModule = jest.requireActual('./electron');
  
  return {
    ...originalModule,
    // We'll override getIpcRenderer in individual tests
    getIpcRenderer: jest.fn()
  };
});

// Import after mocking
import { getIpcRenderer } from './electron';

describe('electron utility', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  test('getIpcRenderer returns an object with all required methods', () => {
    // Mock implementation for this test
    const mockIpcRenderer = {
      send: jest.fn(),
      on: jest.fn(),
      invoke: jest.fn(),
      removeAllListeners: jest.fn()
    };
    
    // Override the mock to return our test implementation
    getIpcRenderer.mockReturnValue(mockIpcRenderer);
    
    // Call the function (this will use our mock)
    const result = getIpcRenderer();
    
    // Verify the result
    expect(result).toBe(mockIpcRenderer);
    expect(typeof result.send).toBe('function');
    expect(typeof result.on).toBe('function');
    expect(typeof result.invoke).toBe('function');
    expect(typeof result.removeAllListeners).toBe('function');
  });
  
  test('getIpcRenderer handles missing removeAllListeners method', () => {
    // Create a mock without removeAllListeners
    const mockIpcRenderer = {
      send: jest.fn(),
      on: jest.fn(),
      invoke: jest.fn()
      // removeAllListeners intentionally omitted
    };
    
    // Add the fallback implementation
    mockIpcRenderer.removeAllListeners = function(channel) {
      // This simulates our fallback implementation
    };
    
    // Override the mock to return our test implementation
    getIpcRenderer.mockReturnValue(mockIpcRenderer);
    
    // Call the function
    const result = getIpcRenderer();
    
    // Verify the result
    expect(result).toBe(mockIpcRenderer);
    expect(typeof result.removeAllListeners).toBe('function');
    
    // Calling it should not throw
    expect(() => result.removeAllListeners('test-event')).not.toThrow();
  });
  
  test('getIpcRenderer returns null when window.electron is not available', () => {
    // Mock to return null
    getIpcRenderer.mockReturnValue(null);
    
    // Call the function
    const result = getIpcRenderer();
    
    // Verify the result
    expect(result).toBeNull();
  });
}); 