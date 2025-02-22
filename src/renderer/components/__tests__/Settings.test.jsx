import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Settings from '../Settings';

// Mock the IPC renderer
const mockIpcRenderer = {
  invoke: jest.fn((channel, ...args) => {
    console.log('IPC invoke called:', { channel, args });
    switch (channel) {
      case 'get-settings':
        console.log('Returning mock settings');
        return Promise.resolve({
          openaiApiKey: 'test-key',
          aiModel: 'gpt-4',
          aiTemperature: 0.7,
          aiTriggerWord: 'juno',
          startupBehavior: 'minimized',
          defaultMicrophone: 'default'
        });
      case 'get-microphones':
        console.log('Returning mock microphones');
        return Promise.resolve([
          { id: 'default', label: 'Default', isDefault: true },
          { id: 'mic1', label: 'Microphone 1', isDefault: false }
        ]);
      case 'change-microphone':
        console.log('Handling change-microphone:', args[0]);
        return Promise.resolve({ success: true });
      default:
        console.log('Unknown channel:', channel);
        return Promise.resolve(null);
    }
  }),
  on: jest.fn((event, handler) => {
    console.log('IPC on called:', event);
  }),
  send: jest.fn((channel, ...args) => {
    console.log('IPC send called:', { channel, args });
  }),
  removeListener: jest.fn()
};

// Mock the getIpcRenderer function
jest.mock('../../utils/electron', () => ({
  getIpcRenderer: () => mockIpcRenderer
}));

describe('Settings Component', () => {
  beforeEach(() => {
    console.log('Setting up test case');
    jest.clearAllMocks();
  });

  afterEach(() => {
    console.log('Cleaning up test case');
  });

  it('loads settings and microphones on mount', async () => {
    render(<Settings />);

    // Wait for both IPC calls to be made
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-settings');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-microphones');
    });

    // Check that the microphone select is populated
    await waitFor(() => {
      const micSelect = screen.getByLabelText(/default microphone/i);
      expect(micSelect).toBeInTheDocument();
      expect(screen.getByText('Default')).toBeInTheDocument();
      expect(screen.getByText('Microphone 1')).toBeInTheDocument();
    });
  });

  it('shows spinner while changing microphone', async () => {
    render(<Settings />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByLabelText(/default microphone/i)).toBeInTheDocument();
    });

    // Mock a delay when changing microphone
    mockIpcRenderer.invoke.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    // Change microphone
    const select = screen.getByLabelText(/default microphone/i);
    fireEvent.change(select, { target: { value: 'mic1' } });

    // Check for spinner
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows success notification on successful microphone change', async () => {
    render(<Settings />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByLabelText(/default microphone/i)).toBeInTheDocument();
    });

    // Change microphone
    const select = screen.getByLabelText(/default microphone/i);
    fireEvent.change(select, { target: { value: 'mic1' } });

    // Check for success message
    await waitFor(() => {
      expect(screen.getByText(/microphone changed successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error message when microphone change fails', async () => {
    render(<Settings />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByLabelText(/default microphone/i)).toBeInTheDocument();
    });

    // Mock error when changing microphone
    mockIpcRenderer.invoke.mockRejectedValueOnce(new Error('Failed to change microphone'));
    
    // Change microphone
    const select = screen.getByLabelText(/default microphone/i);
    fireEvent.change(select, { target: { value: 'mic1' } });

    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/failed to change microphone/i)).toBeInTheDocument();
    });
  });

  it('shows microphone permission denied message', async () => {
    // Mock permission denied error
    mockIpcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'get-microphones') {
        throw new Error('NotAllowedError: Permission denied');
      }
      return channel === 'get-settings' ? {
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.7,
        triggerWord: 'juno'
      } : null;
    });

    render(<Settings />);

    // Wait for error state and check UI elements
    await waitFor(() => {
      expect(screen.getByText(/microphone access is required/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry access/i })).toBeInTheDocument();
    });
  });

  it('shows helpful microphone selection tip', async () => {
    render(<Settings />);

    // Wait for microphones to load
    await waitFor(() => {
      expect(screen.getByLabelText(/default microphone/i)).toBeInTheDocument();
    });

    // Check for tip text
    const tipText = screen.getByText((content, element) => {
      return element.tagName.toLowerCase() === 'p' && 
             content.includes('💡') && 
             content.includes('Use "Default" if you frequently switch between microphones');
    });
    expect(tipText).toBeInTheDocument();
  });
}); 