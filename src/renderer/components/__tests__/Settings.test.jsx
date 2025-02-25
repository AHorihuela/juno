import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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

// Helper function to render Settings with Router
const renderWithRouter = (initialRoute = '/settings') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/settings/*" element={<Settings />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Settings Component', () => {
  beforeEach(() => {
    console.log('Setting up test case');
    jest.clearAllMocks();
  });

  afterEach(() => {
    console.log('Cleaning up test case');
  });

  it('loads settings and microphones on mount', async () => {
    console.log('Setting up test case');
    
    // Reset mock function calls
    mockIpcRenderer.invoke.mockClear();
    
    // Render with router
    renderWithRouter();
    
    // Wait for settings to load
    await waitFor(() => {
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-settings');
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-microphones');
    });
    
    console.log('Cleaning up test case');
  });

  it('shows spinner while changing microphone', async () => {
    // Mock a delayed response for microphone change
    mockIpcRenderer.invoke.mockImplementation((channel, ...args) => {
      if (channel === 'change-microphone') {
        return new Promise(resolve => setTimeout(() => resolve({ success: true }), 100));
      }
      return Promise.resolve(null);
    });
    
    renderWithRouter();
    
    // Wait for microphones to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Select Microphone/i)).toBeInTheDocument();
    });
    
    // Change microphone
    fireEvent.change(screen.getByLabelText(/Select Microphone/i), { target: { value: 'mic1' } });
    
    // Check for spinner
    expect(screen.getByText(/Changing microphone/i)).toBeInTheDocument();
    
    // Wait for change to complete
    await waitFor(() => {
      expect(screen.queryByText(/Changing microphone/i)).not.toBeInTheDocument();
    });
  });

  it('shows success notification on successful microphone change', async () => {
    renderWithRouter();
    
    // Wait for microphones to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Select Microphone/i)).toBeInTheDocument();
    });
    
    // Change microphone
    fireEvent.change(screen.getByLabelText(/Select Microphone/i), { target: { value: 'mic1' } });
    
    // Wait for success notification
    await waitFor(() => {
      expect(screen.getByText(/Microphone changed successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error message when microphone change fails', async () => {
    // Mock error response
    mockIpcRenderer.invoke.mockImplementation((channel, ...args) => {
      if (channel === 'change-microphone') {
        return Promise.resolve({ success: false, error: 'Failed to change microphone' });
      }
      return Promise.resolve(null);
    });
    
    renderWithRouter();
    
    // Wait for microphones to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Select Microphone/i)).toBeInTheDocument();
    });
    
    // Change microphone
    fireEvent.change(screen.getByLabelText(/Select Microphone/i), { target: { value: 'mic1' } });
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to change microphone/i)).toBeInTheDocument();
    });
  });

  it('shows microphone permission denied message', async () => {
    // Mock permission denied response
    mockIpcRenderer.invoke.mockImplementation((channel, ...args) => {
      if (channel === 'get-microphones') {
        return Promise.resolve({ error: 'Permission denied' });
      }
      return Promise.resolve(null);
    });
    
    renderWithRouter();
    
    // Wait for error state and check UI elements
    await waitFor(() => {
      expect(screen.getByText(/Microphone access denied/i)).toBeInTheDocument();
    });
  });

  it('shows helpful microphone selection tip', async () => {
    renderWithRouter();
    
    // Wait for microphones to load
    await waitFor(() => {
      expect(screen.getByLabelText(/Select Microphone/i)).toBeInTheDocument();
    });
    
    // Check for help text
    expect(screen.getByText(/Select the microphone you want to use for dictation/i)).toBeInTheDocument();
  });
}); 