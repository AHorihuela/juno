import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

// Helper function to render App with Router
const renderWithRouter = () => {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );
};

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders initial state correctly', () => {
    renderWithRouter();
    expect(screen.getByText(/Status: Ready/)).toBeInTheDocument();
    expect(screen.getByText(/Double-tap F6: Start recording/)).toBeInTheDocument();
  });

  it('shows recording status when recording starts', async () => {
    renderWithRouter();
    
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
    renderWithRouter();
    
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

  it('displays transcription when received', async () => {
    renderWithRouter();
    
    // Get the transcription callback
    const transcriptionCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'transcription'
    )[1];
    
    // Simulate transcription received
    await act(async () => {
      transcriptionCallback(null, 'This is a stub transcription.');
    });
    
    expect(screen.getByText(/This is a stub transcription./)).toBeInTheDocument();
  });

  it('cleans up listeners on unmount', () => {
    const { unmount } = renderWithRouter();
    unmount();
    
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith('recording-status');
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith('recording-error');
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith('error');
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith('transcription');
  });
}); 