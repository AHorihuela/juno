import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TranscriptionHistory from '../components/TranscriptionHistory';

// Mock electron
const mockIpcRenderer = {
  on: jest.fn(),
  send: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Mock window.require
window.require = jest.fn(() => ({
  ipcRenderer: mockIpcRenderer
}));

describe('TranscriptionHistory Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when no transcriptions exist', () => {
    render(<TranscriptionHistory />);
    expect(screen.getByText('No transcriptions yet')).toBeInTheDocument();
  });

  it('displays transcription history when data is received', async () => {
    render(<TranscriptionHistory />);

    const mockHistory = [
      {
        id: 1,
        text: 'Test transcription 1',
        timestamp: '2024-02-20T00:00:00.000Z'
      },
      {
        id: 2,
        text: 'Test transcription 2',
        timestamp: '2024-02-20T00:01:00.000Z'
      }
    ];

    // Get the history callback
    const historyCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'transcription-history'
    )[1];

    // Simulate receiving history data
    await act(async () => {
      historyCallback(null, mockHistory);
    });

    expect(screen.getByText('Test transcription 1')).toBeInTheDocument();
    expect(screen.getByText('Test transcription 2')).toBeInTheDocument();
  });

  it('shows error message when error occurs', async () => {
    render(<TranscriptionHistory />);

    // Get the error callback
    const errorCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'transcription-history-error'
    )[1];

    // Simulate error
    await act(async () => {
      errorCallback(null, 'Failed to load history');
    });

    expect(screen.getByText('Error: Failed to load history')).toBeInTheDocument();
  });

  it('sends delete request when delete button is clicked', async () => {
    render(<TranscriptionHistory />);

    const mockHistory = [
      {
        id: 1,
        text: 'Test transcription',
        timestamp: '2024-02-20T00:00:00.000Z'
      }
    ];

    // Get the history callback
    const historyCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'transcription-history'
    )[1];

    // Simulate receiving history data
    await act(async () => {
      historyCallback(null, mockHistory);
    });

    // Find and click delete button
    const deleteButton = screen.getByTitle('Delete transcription');
    fireEvent.click(deleteButton);

    expect(mockIpcRenderer.send).toHaveBeenCalledWith('delete-transcription', 1);
  });

  it('sends clear request when clear all button is clicked', async () => {
    render(<TranscriptionHistory />);

    const mockHistory = [
      {
        id: 1,
        text: 'Test transcription',
        timestamp: '2024-02-20T00:00:00.000Z'
      }
    ];

    // Get the history callback
    const historyCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'transcription-history'
    )[1];

    // Simulate receiving history data
    await act(async () => {
      historyCallback(null, mockHistory);
    });

    // Find and click clear all button
    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);

    expect(mockIpcRenderer.send).toHaveBeenCalledWith('clear-transcription-history');
  });

  it('requests history update when new transcription is received', async () => {
    render(<TranscriptionHistory />);

    // Get the transcription callback
    const transcriptionCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'transcription'
    )[1];

    // Simulate receiving new transcription
    await act(async () => {
      transcriptionCallback(null, 'New transcription');
    });

    expect(mockIpcRenderer.send).toHaveBeenCalledWith('get-transcription-history');
  });
}); 