/**
 * Example test demonstrating how to use Electron mocks for testing window creation
 */

const electron = require('electron');

// Mock implementation of a window creator function
function createAppWindow(options = {}) {
  const defaultOptions = {
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };

  const windowOptions = { ...defaultOptions, ...options };
  const window = new electron.BrowserWindow(windowOptions);
  
  window.loadURL('file://index.html');
  
  window.once('ready-to-show', () => {
    window.show();
  });
  
  window.on('closed', () => {
    // Clean up window reference
  });
  
  return window;
}

describe('Window Creation', () => {
  let originalBrowserWindow;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Store the original BrowserWindow constructor
    originalBrowserWindow = electron.BrowserWindow;
    
    // Replace BrowserWindow with a Jest mock function that returns a mock window
    electron.BrowserWindow = jest.fn(options => {
      // Create a window with the same API as the original mock
      const window = new originalBrowserWindow();
      window.options = options; // Store options for verification
      return window;
    });
  });
  
  afterEach(() => {
    // Restore the original BrowserWindow constructor
    electron.BrowserWindow = originalBrowserWindow;
  });
  
  it('should create a window with default options', () => {
    const window = createAppWindow();
    
    // Verify BrowserWindow was called with correct options
    expect(electron.BrowserWindow).toHaveBeenCalledWith({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    // Verify window methods were called
    expect(window.loadURL).toHaveBeenCalledWith('file://index.html');
    expect(window.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
    expect(window.on).toHaveBeenCalledWith('closed', expect.any(Function));
  });
  
  it('should override default options with provided options', () => {
    const customOptions = {
      width: 800,
      height: 600,
      fullscreen: true
    };
    
    createAppWindow(customOptions);
    
    // Verify BrowserWindow was called with merged options
    expect(electron.BrowserWindow).toHaveBeenCalledWith({
      width: 800,
      height: 600,
      fullscreen: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
  });
  
  it('should show the window when ready', () => {
    const window = createAppWindow();
    
    // Get the ready-to-show callback
    const readyToShowCallback = window.once.mock.calls.find(
      call => call[0] === 'ready-to-show'
    )[1];
    
    // Call the callback
    readyToShowCallback();
    
    // Verify window.show was called
    expect(window.show).toHaveBeenCalled();
  });
}); 