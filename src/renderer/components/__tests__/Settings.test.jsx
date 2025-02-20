import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Settings from '../Settings';
import { getIpcRenderer } from '../../utils/electron';

// Mock electron utils
jest.mock('../../utils/electron', () => ({
  getIpcRenderer: jest.fn(),
}));

describe('Settings Component', () => {
  const mockIpcRenderer = {
    send: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getIpcRenderer.mockReturnValue(mockIpcRenderer);
  });

  it('loads and displays settings', async () => {
    const mockSettings = {
      openaiApiKey: 'test-key',
      aiTriggerWord: 'test-trigger',
      aiModel: 'gpt-4',
      aiTemperature: 0.7,
      startupBehavior: 'minimized',
      defaultMicrophone: 'default',
    };

    render(<Settings />);

    // Find the settings-loaded callback
    const settingsCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'settings-loaded'
    )[1];

    // Simulate settings loaded
    await act(async () => {
      settingsCallback(null, mockSettings);
    });

    // Verify settings are displayed
    expect(screen.getByDisplayValue('test-trigger')).toBeInTheDocument();
    expect(screen.getByDisplayValue('gpt-4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.7')).toBeInTheDocument();
  });

  it('handles settings save', async () => {
    render(<Settings />);

    // Load initial settings
    const settingsCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'settings-loaded'
    )[1];

    await act(async () => {
      settingsCallback(null, {
        openaiApiKey: '',
        aiTriggerWord: 'juno',
        aiModel: 'gpt-4',
        aiTemperature: 0.7,
        startupBehavior: 'minimized',
        defaultMicrophone: '',
      });
    });

    // Update a setting
    const triggerInput = screen.getByPlaceholderText('juno');
    fireEvent.change(triggerInput, { target: { value: 'assistant' } });

    // Submit the form
    const submitButton = screen.getByText('Save Settings');
    fireEvent.click(submitButton);

    // Verify save was called
    expect(mockIpcRenderer.send).toHaveBeenCalledWith(
      'save-settings',
      expect.objectContaining({
        aiTriggerWord: 'assistant',
      })
    );
  });

  it('displays error message', async () => {
    render(<Settings />);

    // Find the error callback
    const errorCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'settings-error'
    )[1];

    // Simulate error
    await act(async () => {
      errorCallback(null, 'Failed to load settings');
    });

    expect(screen.getByText('Failed to load settings')).toBeInTheDocument();
  });

  it('loads and displays microphones', async () => {
    const mockMicrophones = [
      { id: 'mic1', label: 'Microphone 1' },
      { id: 'mic2', label: 'Microphone 2' },
    ];

    render(<Settings />);

    // Find the microphones-loaded callback
    const microphonesCallback = mockIpcRenderer.on.mock.calls.find(
      call => call[0] === 'microphones-loaded'
    )[1];

    // Simulate microphones loaded
    await act(async () => {
      microphonesCallback(null, mockMicrophones);
    });

    // Verify microphones are in the select
    expect(screen.getByText('Microphone 1')).toBeInTheDocument();
    expect(screen.getByText('Microphone 2')).toBeInTheDocument();
  });

  it('cleans up listeners on unmount', () => {
    const { unmount } = render(<Settings />);
    unmount();

    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith('settings-loaded');
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith('settings-error');
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith('microphones-loaded');
  });
}); 