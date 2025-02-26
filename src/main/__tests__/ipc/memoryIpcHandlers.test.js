/**
 * Tests for memory IPC handlers
 */

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  }
}));

// Mock MemoryManager service
const mockMemoryManager = {
  getStats: jest.fn().mockReturnValue({
    totalItems: 25,
    workingMemorySize: 5,
    shortTermMemorySize: 10,
    longTermMemorySize: 10,
    totalSizeBytes: 51200,
    totalSizeMB: 0.05,
    avgItemSizeKB: 2,
    memoryLimitMB: 100,
    usagePercentage: 0.05,
    status: 'Good'
  }),
  getAIStats: jest.fn().mockReturnValue({
    totalTokens: 15000,
    promptTokens: 10000,
    completionTokens: 5000,
    totalRequests: 100,
    lastRequestTime: new Date().toISOString()
  }),
  getAllItems: jest.fn().mockReturnValue([
    { id: 'item1', content: 'Memory item 1', tier: 'working', addedAt: Date.now() - 60000 },
    { id: 'item2', content: 'Memory item 2', tier: 'short-term', addedAt: Date.now() - 3600000 },
    { id: 'item3', content: 'Memory item 3', tier: 'long-term', addedAt: Date.now() - 86400000 }
  ]),
  clearMemory: jest.fn().mockReturnValue(true),
  deleteItem: jest.fn().mockReturnValue(true),
  addItem: jest.fn().mockImplementation((item) => ({
    ...item,
    id: 'new-item-id',
    addedAt: Date.now(),
    tier: 'working'
  })),
  getContextForCommand: jest.fn().mockReturnValue({
    primaryContext: { id: 'item1', content: 'Primary context' },
    secondaryContext: [{ id: 'item2', content: 'Secondary context' }]
  }),
  recordItemUsage: jest.fn()
};

// Mock service registry
jest.mock('../../../main/services/ServiceRegistry', () => ({
  get: jest.fn().mockImplementation((serviceName) => {
    if (serviceName === 'memory') {
      return mockMemoryManager;
    }
    return null;
  })
}));

// Import the module under test
const setupMemoryIpcHandlers = require('../../../main/ipc/memoryIpcHandlers');
const { ipcMain } = require('electron');
const serviceRegistry = require('../../../main/services/ServiceRegistry');

describe('Memory IPC Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('registers all memory IPC handlers', () => {
    setupMemoryIpcHandlers();
    
    // Check that all expected handlers are registered
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:getStats', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:getAIStats', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:getItems', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:clearMemory', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:deleteItem', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:addItem', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:getContextForCommand', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('memory:recordItemUsage', expect.any(Function));
  });
  
  it('handles memory:getStats requests', async () => {
    setupMemoryIpcHandlers();
    
    // Get the handler function
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'memory:getStats'
    )[1];
    
    // Call the handler
    const result = await handler({}, {});
    
    // Check that the service was called
    expect(serviceRegistry.get).toHaveBeenCalledWith('memory');
    expect(mockMemoryManager.getStats).toHaveBeenCalled();
    
    // Check the result
    expect(result).toEqual({
      totalItems: 25,
      workingMemorySize: 5,
      shortTermMemorySize: 10,
      longTermMemorySize: 10,
      totalSizeBytes: 51200,
      totalSizeMB: 0.05,
      avgItemSizeKB: 2,
      memoryLimitMB: 100,
      usagePercentage: 0.05,
      status: 'Good'
    });
  });
  
  it('handles memory:getAIStats requests', async () => {
    setupMemoryIpcHandlers();
    
    // Get the handler function
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'memory:getAIStats'
    )[1];
    
    // Call the handler
    const result = await handler({}, {});
    
    // Check that the service was called
    expect(serviceRegistry.get).toHaveBeenCalledWith('memory');
    expect(mockMemoryManager.getAIStats).toHaveBeenCalled();
    
    // Check the result
    expect(result).toEqual({
      totalTokens: 15000,
      promptTokens: 10000,
      completionTokens: 5000,
      totalRequests: 100,
      lastRequestTime: expect.any(String)
    });
  });
  
  it('handles memory:getItems requests', async () => {
    setupMemoryIpcHandlers();
    
    // Get the handler function
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'memory:getItems'
    )[1];
    
    // Call the handler
    const result = await handler({}, {});
    
    // Check that the service was called
    expect(serviceRegistry.get).toHaveBeenCalledWith('memory');
    expect(mockMemoryManager.getAllItems).toHaveBeenCalled();
    
    // Check the result
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('item1');
    expect(result[1].id).toBe('item2');
    expect(result[2].id).toBe('item3');
  });
  
  it('handles memory:clearMemory requests', async () => {
    setupMemoryIpcHandlers();
    
    // Get the handler function
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'memory:clearMemory'
    )[1];
    
    // Call the handler with no tier (clear all)
    const result1 = await handler({}, {});
    
    // Check that the service was called correctly
    expect(serviceRegistry.get).toHaveBeenCalledWith('memory');
    expect(mockMemoryManager.clearMemory).toHaveBeenCalledWith();
    
    // Call the handler with a specific tier
    const result2 = await handler({}, 'working');
    
    // Check that the service was called with the tier
    expect(mockMemoryManager.clearMemory).toHaveBeenCalledWith('working');
    
    // Check the results
    expect(result1).toBe(true);
    expect(result2).toBe(true);
  });
  
  it('handles memory:deleteItem requests', async () => {
    setupMemoryIpcHandlers();
    
    // Get the handler function
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'memory:deleteItem'
    )[1];
    
    // Call the handler
    const result = await handler({}, 'item1');
    
    // Check that the service was called
    expect(serviceRegistry.get).toHaveBeenCalledWith('memory');
    expect(mockMemoryManager.deleteItem).toHaveBeenCalledWith('item1');
    
    // Check the result
    expect(result).toBe(true);
  });
  
  it('handles memory:addItem requests', async () => {
    setupMemoryIpcHandlers();
    
    // Get the handler function
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'memory:addItem'
    )[1];
    
    // Call the handler
    const item = { content: 'New memory item' };
    const result = await handler({}, item);
    
    // Check that the service was called
    expect(serviceRegistry.get).toHaveBeenCalledWith('memory');
    expect(mockMemoryManager.addItem).toHaveBeenCalledWith(item);
    
    // Check the result
    expect(result).toEqual({
      content: 'New memory item',
      id: 'new-item-id',
      addedAt: expect.any(Number),
      tier: 'working'
    });
  });
  
  it('handles memory:getContextForCommand requests', async () => {
    setupMemoryIpcHandlers();
    
    // Get the handler function
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'memory:getContextForCommand'
    )[1];
    
    // Call the handler
    const result = await handler({}, 'test command');
    
    // Check that the service was called
    expect(serviceRegistry.get).toHaveBeenCalledWith('memory');
    expect(mockMemoryManager.getContextForCommand).toHaveBeenCalledWith('test command');
    
    // Check the result
    expect(result).toEqual({
      primaryContext: { id: 'item1', content: 'Primary context' },
      secondaryContext: [{ id: 'item2', content: 'Secondary context' }]
    });
  });
  
  it('handles memory:recordItemUsage requests', async () => {
    setupMemoryIpcHandlers();
    
    // Get the handler function
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'memory:recordItemUsage'
    )[1];
    
    // Call the handler
    await handler({}, 'item1', 8);
    
    // Check that the service was called
    expect(serviceRegistry.get).toHaveBeenCalledWith('memory');
    expect(mockMemoryManager.recordItemUsage).toHaveBeenCalledWith('item1', 8);
  });
  
  it('handles errors gracefully', async () => {
    // Mock an error in the service
    mockMemoryManager.getStats.mockImplementationOnce(() => {
      throw new Error('Test error');
    });
    
    setupMemoryIpcHandlers();
    
    // Get the handler function
    const handler = ipcMain.handle.mock.calls.find(
      call => call[0] === 'memory:getStats'
    )[1];
    
    // Call the handler and expect it to reject
    await expect(handler({}, {})).rejects.toThrow('Test error');
  });
}); 