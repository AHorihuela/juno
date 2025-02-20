import React from 'react';
import { render, screen, act } from '@testing-library/react';
import App from '../App';

// Mock electron
const mockIpcRenderer = {
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Mock window.require
window.require = jest.fn(() => ({
  ipcRenderer: mockIpcRenderer
}));

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial state correctly', () => {
    render(<App />);
    expect(screen.getByText(/Status: Ready/)).toBeInTheDocument();
    expect(screen.getByText(/Double-tap F6: Start recording/)).toBeInTheDocument();
  });

  it('shows recording status when recording starts', async () => {
    render(<App />);
    
    // Get the recording status callback
    const statusCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'recording-status'
    )[1];
    
    // Simulate recording start
    await act(async () => {
      statusCallback(null, true);
    });
    
    expect(screen.getByText(/Recording/)).toBeInTheDocument();
  });

  it('shows error message when recording fails', async () => {
    render(<App />);
    
    // Get the error callback
    const errorCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'recording-error'
    )[1];
    
    // Simulate error
    await act(async () => {
      errorCallback(null, 'Microphone access denied');
    });
    
    expect(screen.getByText(/Microphone access denied/)).toBeInTheDocument();
  });

  it('cleans up listeners on unmount', () => {
    const { unmount } = render(<App />);
    unmount();
    
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith('recording-status');
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith('recording-error');
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith('error');
  });
}); 