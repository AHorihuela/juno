/**
 * Example test demonstrating how to use Electron IPC mocks
 */

const electron = require('electron');
const { ipcMain, ipcRenderer } = electron;

// Mock implementation of an IPC handler in the main process
function setupIpcHandlers() {
  // Simple echo handler
  ipcMain.handle('echo', (event, message) => {
    return `Echo: ${message}`;
  });

  // Handler with async operation
  ipcMain.handle('fetch-data', async (event, id) => {
    // In a real implementation, this would fetch data from a database or API
    return { id, name: 'Test Item', timestamp: Date.now() };
  });

  // Handler with error
  ipcMain.handle('validate', (event, data) => {
    if (!data || !data.value) {
      throw new Error('Invalid data: value is required');
    }
    return { valid: true, data };
  });
}

// Mock implementation of IPC calls from the renderer process
function rendererSendMessage(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args);
}

describe('IPC Communication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupIpcHandlers();
  });

  it('should handle echo messages', async () => {
    // Override the default mock implementation for this test
    ipcRenderer.invoke.mockImplementationOnce((channel, message) => {
      if (channel === 'echo') {
        return Promise.resolve(`Echo: ${message}`);
      }
      return Promise.resolve({});
    });
    
    // Call the handler through the renderer
    const result = await rendererSendMessage('echo', 'Hello World');
    
    // Verify the result
    expect(result).toBe('Echo: Hello World');
    
    // Verify ipcRenderer.invoke was called with the correct arguments
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('echo', 'Hello World');
  });

  it('should handle async data fetching', async () => {
    // Mock the implementation for testing
    const mockData = { id: '123', name: 'Test Item', timestamp: 1613456789 };
    ipcRenderer.invoke.mockResolvedValueOnce(mockData);
    
    // Call the handler
    const result = await rendererSendMessage('fetch-data', '123');
    
    // Verify the result
    expect(result).toEqual(mockData);
    
    // Verify ipcRenderer.invoke was called with the correct arguments
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('fetch-data', '123');
  });

  it('should handle validation errors', async () => {
    // Mock implementation to simulate an error
    ipcRenderer.invoke.mockRejectedValueOnce(new Error('Invalid data: value is required'));
    
    // Call the handler and expect it to reject
    await expect(rendererSendMessage('validate', {})).rejects.toThrow(
      'Invalid data: value is required'
    );
    
    // Verify ipcRenderer.invoke was called with the correct arguments
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('validate', {});
  });

  it('should handle successful validation', async () => {
    const validData = { value: 'test' };
    const expectedResult = { valid: true, data: validData };
    
    // Mock implementation for successful validation
    ipcRenderer.invoke.mockResolvedValueOnce(expectedResult);
    
    // Call the handler
    const result = await rendererSendMessage('validate', validData);
    
    // Verify the result
    expect(result).toEqual(expectedResult);
    
    // Verify ipcRenderer.invoke was called with the correct arguments
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('validate', validData);
  });
}); 