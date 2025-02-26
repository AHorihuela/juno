/**
 * Tests for the MemoryManager component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoryManager from '../../components/MemoryManager';

// Mock electron IPC
const mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Mock window.require
window.require = jest.fn(() => ({
  ipcRenderer: mockIpcRenderer
}));

describe('MemoryManager Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful responses
    mockIpcRenderer.invoke.mockImplementation((channel, ...args) => {
      if (channel === 'memory:getStats') {
        return Promise.resolve({
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
      } else if (channel === 'memory:getAIStats') {
        return Promise.resolve({
          totalTokens: 15000,
          promptTokens: 10000,
          completionTokens: 5000,
          totalRequests: 100,
          lastRequestTime: new Date().toISOString()
        });
      } else if (channel === 'memory:getItems') {
        return Promise.resolve([
          { id: 'item1', content: 'Memory item 1', tier: 'working', addedAt: Date.now() - 60000 },
          { id: 'item2', content: 'Memory item 2', tier: 'short-term', addedAt: Date.now() - 3600000 },
          { id: 'item3', content: 'Memory item 3', tier: 'long-term', addedAt: Date.now() - 86400000 }
        ]);
      } else if (channel === 'memory:clearMemory') {
        return Promise.resolve(true);
      } else if (channel === 'memory:deleteItem') {
        return Promise.resolve(true);
      }
      return Promise.resolve(null);
    });
  });
  
  it('renders the memory manager component', async () => {
    render(<MemoryManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getStats');
    });
    
    // Check that the component renders with the correct title
    expect(screen.getByText('Memory Management')).toBeInTheDocument();
    
    // Check that memory stats are displayed
    expect(screen.getByText(/Total Items:/)).toBeInTheDocument();
    expect(screen.getByText(/25/)).toBeInTheDocument();
    
    // Check that memory tiers are displayed
    expect(screen.getByText(/Working Memory:/)).toBeInTheDocument();
    expect(screen.getByText(/Short-Term Memory:/)).toBeInTheDocument();
    expect(screen.getByText(/Long-Term Memory:/)).toBeInTheDocument();
  });
  
  it('displays memory items when expanded', async () => {
    render(<MemoryManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getItems');
    });
    
    // Find and click the expand button for memory items
    const expandButton = screen.getByRole('button', { name: /Show Memory Items/i });
    fireEvent.click(expandButton);
    
    // Check that memory items are displayed
    expect(screen.getByText('Memory item 1')).toBeInTheDocument();
    expect(screen.getByText('Memory item 2')).toBeInTheDocument();
    expect(screen.getByText('Memory item 3')).toBeInTheDocument();
  });
  
  it('handles memory clearing', async () => {
    const user = userEvent.setup();
    render(<MemoryManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getStats');
    });
    
    // Find and click the clear memory button
    const clearButton = screen.getByRole('button', { name: /Clear All Memory/i });
    await user.click(clearButton);
    
    // Find and click the confirm button in the confirmation dialog
    const confirmButton = screen.getByRole('button', { name: /Confirm/i });
    await user.click(confirmButton);
    
    // Check that the clear memory function was called
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:clearMemory');
    
    // Check that stats are refreshed
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getStats');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getItems');
  });
  
  it('handles memory tier clearing', async () => {
    const user = userEvent.setup();
    render(<MemoryManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getStats');
    });
    
    // Find and click the clear working memory button
    const clearWorkingButton = screen.getByRole('button', { name: /Clear Working Memory/i });
    await user.click(clearWorkingButton);
    
    // Check that the clear memory function was called with the correct tier
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:clearMemory', 'working');
    
    // Check that stats are refreshed
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getStats');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getItems');
  });
  
  it('handles item deletion', async () => {
    const user = userEvent.setup();
    render(<MemoryManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getItems');
    });
    
    // Find and click the expand button for memory items
    const expandButton = screen.getByRole('button', { name: /Show Memory Items/i });
    await user.click(expandButton);
    
    // Find and click the delete button for the first item
    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
    await user.click(deleteButtons[0]);
    
    // Check that the delete item function was called with the correct ID
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:deleteItem', 'item1');
    
    // Check that items are refreshed
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getItems');
  });
  
  it('displays AI usage statistics', async () => {
    render(<MemoryManager />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getAIStats');
    });
    
    // Find and click the expand button for AI stats
    const expandButton = screen.getByRole('button', { name: /Show AI Usage/i });
    fireEvent.click(expandButton);
    
    // Check that AI stats are displayed
    expect(screen.getByText(/Total Tokens:/)).toBeInTheDocument();
    expect(screen.getByText(/15,000/)).toBeInTheDocument();
    expect(screen.getByText(/Prompt Tokens:/)).toBeInTheDocument();
    expect(screen.getByText(/10,000/)).toBeInTheDocument();
    expect(screen.getByText(/Completion Tokens:/)).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
    expect(screen.getByText(/Total Requests:/)).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });
  
  it('handles error states gracefully', async () => {
    // Mock error response
    mockIpcRenderer.invoke.mockRejectedValueOnce(new Error('Failed to fetch memory stats'));
    
    render(<MemoryManager />);
    
    // Wait for error to be handled
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getStats');
    });
    
    // Check that error message is displayed
    expect(screen.getByText(/Error loading memory statistics/i)).toBeInTheDocument();
  });
  
  it('refreshes data periodically', async () => {
    // Mock timer
    jest.useFakeTimers();
    
    render(<MemoryManager />);
    
    // Wait for initial data load
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getStats');
    });
    
    // Clear mock calls
    mockIpcRenderer.invoke.mockClear();
    
    // Advance timer by refresh interval (30 seconds)
    jest.advanceTimersByTime(30000);
    
    // Check that data is refreshed
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getStats');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('memory:getAIStats');
    
    // Restore timer
    jest.useRealTimers();
  });
  
  it('cleans up on unmount', () => {
    const { unmount } = render(<MemoryManager />);
    
    unmount();
    
    // Check that event listeners are removed
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalled();
  });
}); 