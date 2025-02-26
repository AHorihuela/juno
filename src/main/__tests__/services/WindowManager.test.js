/**
 * Tests for the WindowManager service
 */

// Mock electron
jest.mock('electron', () => {
  const mockShow = jest.fn();
  const mockHide = jest.fn();
  const mockFocus = jest.fn();
  const mockSetSize = jest.fn();
  const mockCenter = jest.fn();
  const mockSetFullScreenable = jest.fn();
  const mockSetWindowButtonVisibility = jest.fn();
  const mockIsDestroyed = jest.fn().mockReturnValue(false);
  const mockOn = jest.fn();
  const mockOpenDevTools = jest.fn();
  
  return {
    BrowserWindow: jest.fn().mockImplementation(() => ({
      id: 'mock-window-id',
      type: 'normal',
      show: mockShow,
      hide: mockHide,
      focus: mockFocus,
      setSize: mockSetSize,
      center: mockCenter,
      setFullScreenable: mockSetFullScreenable,
      setWindowButtonVisibility: mockSetWindowButtonVisibility,
      isDestroyed: mockIsDestroyed,
      webContents: {
        on: mockOn,
        openDevTools: mockOpenDevTools
      }
    })),
    screen: {
      getPrimaryDisplay: jest.fn().mockReturnValue({
        workAreaSize: { width: 1920, height: 1080 }
      })
    },
    app: {
      on: jest.fn()
    },
    ipcMain: {
      on: jest.fn(),
      handle: jest.fn()
    }
  };
});

// Mock BaseService
jest.mock('../../../main/services/BaseService', () => {
  return class MockBaseService {
    constructor(name) {
      this.name = name;
      this.getService = jest.fn();
      this.emitError = jest.fn();
    }
  };
});

// Mock overlay service
const mockOverlayService = {
  createOverlay: jest.fn(),
  showOverlay: jest.fn(),
  hideOverlay: jest.fn(),
  destroyOverlay: jest.fn(),
  updateOverlayAudioLevels: jest.fn(),
  updateOverlayState: jest.fn(),
  setOverlayState: jest.fn()
};

// Mock MainWindowManager
jest.mock('../../../main/services/MainWindowManager', () => {
  return jest.fn().mockImplementation(() => ({
    mainWindow: null,
    isDev: true,
    setMainWindow: jest.fn(function(window) {
      try {
        this.mainWindow = window;
        window.setFullScreenable.mockClear();
        window.setFullScreenable(false);
        window.show.mockClear();
        window.show();
        if (process.platform === 'darwin') {
          window.setWindowButtonVisibility(true);
        }
      } catch (error) {
        console.error('[MainWindowManager] Error setting main window:', error.message);
        // Don't set the window if there's an error
        this.mainWindow = null;
        // Call emitError on the windowManager
        this.windowManager.emitError('MainWindowManager', error);
      }
    }),
    showWindow: jest.fn(function() {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.show();
        this.mainWindow.focus();
      } else {
        console.log('[MainWindowManager] Cannot show window - no valid window reference');
      }
    }),
    hideWindow: jest.fn(function() {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.hide();
      } else {
        console.log('[MainWindowManager] Cannot hide window - no valid window reference');
      }
    }),
    restoreWindow: jest.fn(function() {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.setSize(800, 600);
        this.mainWindow.center();
        this.mainWindow.show();
      } else {
        console.log('[MainWindowManager] Cannot restore window - no valid window reference');
      }
    }),
    getMainWindow: jest.fn(function() {
      return this.mainWindow;
    }),
    clearMainWindow: jest.fn(function() {
      console.log('[MainWindowManager] Clearing main window reference');
      this.mainWindow = null;
    }),
    recreateMainWindow: jest.fn()
  }));
});

// Import the module under test
const WindowManagerFactory = require('../../../main/services/WindowManager');

describe('WindowManager Service', () => {
  let windowManager;
  let mockWindow;
  
  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a new instance for each test
    windowManager = WindowManagerFactory();
    
    // Initialize the window manager
    await windowManager._initialize();
    
    // Create a mock window
    mockWindow = new (require('electron').BrowserWindow)();
    
    // Add a reference to the WindowManager in the MainWindowManager
    windowManager.mainWindowManager.windowManager = windowManager;
    
    // Mock the overlay service
    windowManager.getService.mockImplementation((serviceName) => {
      if (serviceName === 'overlay') {
        return mockOverlayService;
      }
      return null;
    });
    
    // Set development mode for testing
    process.env.NODE_ENV = 'development';
  });
  
  afterEach(() => {
    // Restore environment
    process.env.NODE_ENV = 'test';
  });
  
  describe('Initialization', () => {
    it('should initialize with correct default values', () => {
      expect(windowManager.mainWindowManager).not.toBeNull();
      expect(windowManager.overlayManager).not.toBeNull();
      expect(windowManager.isRecording).toBe(false);
      expect(windowManager.mainWindowManager.isDev).toBe(true);
    });
    
    it('should initialize and shutdown without errors', async () => {
      await windowManager._shutdown();
      expect(windowManager.mainWindowManager).not.toBeNull();
    });
  });
  
  describe('Main Window Management', () => {
    it('should set the main window with correct properties', () => {
      windowManager.setMainWindow(mockWindow);
      
      expect(windowManager.mainWindowManager.mainWindow).toBe(mockWindow);
      expect(mockWindow.setFullScreenable).toHaveBeenCalledWith(false);
      expect(mockWindow.show).toHaveBeenCalled();
    });
    
    it('should apply macOS-specific settings on macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      
      windowManager.setMainWindow(mockWindow);
      
      expect(mockWindow.setWindowButtonVisibility).toHaveBeenCalledWith(true);
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
    
    it('should handle errors when setting the main window', () => {
      mockWindow.setFullScreenable.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      windowManager.setMainWindow(mockWindow);
      
      expect(windowManager.emitError).toHaveBeenCalled();
    });
    
    it('should show the window', () => {
      windowManager.mainWindowManager.mainWindow = mockWindow;
      windowManager.showWindow();
      
      expect(mockWindow.show).toHaveBeenCalled();
      expect(mockWindow.focus).toHaveBeenCalled();
    });
    
    it('should not show the window if it is destroyed', () => {
      windowManager.mainWindowManager.mainWindow = mockWindow;
      mockWindow.isDestroyed.mockReturnValueOnce(true);
      
      windowManager.showWindow();
      
      expect(mockWindow.show).not.toHaveBeenCalled();
    });
    
    it('should hide the window', () => {
      windowManager.mainWindowManager.mainWindow = mockWindow;
      windowManager.hideWindow();
      
      expect(mockWindow.hide).toHaveBeenCalled();
    });
    
    it('should restore the window to default size and position', () => {
      windowManager.mainWindowManager.mainWindow = mockWindow;
      windowManager.restoreWindow();
      
      expect(mockWindow.setSize).toHaveBeenCalledWith(800, 600);
      expect(mockWindow.center).toHaveBeenCalled();
      expect(mockWindow.show).toHaveBeenCalled();
    });
    
    it('should get the main window', () => {
      windowManager.mainWindowManager.mainWindow = mockWindow;
      
      const result = windowManager.getMainWindow();
      
      expect(result).toBe(mockWindow);
    });
    
    it('should clear the main window reference', () => {
      windowManager.mainWindowManager.mainWindow = mockWindow;
      
      windowManager.clearMainWindow();
      
      expect(windowManager.mainWindowManager.mainWindow).toBeNull();
    });
  });
  
  describe('Overlay Management', () => {
    it('should create an overlay', () => {
      windowManager.createOverlay();
      
      expect(windowManager.getService).toHaveBeenCalledWith('overlay');
      expect(mockOverlayService.createOverlay).toHaveBeenCalled();
    });
    
    it('should show an overlay', () => {
      windowManager.showOverlay();
      
      expect(windowManager.getService).toHaveBeenCalledWith('overlay');
      expect(mockOverlayService.showOverlay).toHaveBeenCalled();
    });
    
    it('should hide an overlay', () => {
      windowManager.hideOverlay();
      
      expect(windowManager.getService).toHaveBeenCalledWith('overlay');
      expect(mockOverlayService.hideOverlay).toHaveBeenCalled();
    });
    
    it('should destroy an overlay', () => {
      windowManager.destroyOverlay();
      
      expect(windowManager.getService).toHaveBeenCalledWith('overlay');
      expect(mockOverlayService.destroyOverlay).toHaveBeenCalled();
    });
    
    it('should update overlay audio levels', () => {
      const levels = { level: 0.5 };
      windowManager.updateOverlayAudioLevels(levels);
      
      expect(windowManager.getService).toHaveBeenCalledWith('overlay');
      expect(mockOverlayService.updateOverlayAudioLevels).toHaveBeenCalledWith(levels);
    });
    
    it('should update overlay state', () => {
      const state = { isRecording: true };
      windowManager.updateOverlayState(state);
      
      expect(windowManager.getService).toHaveBeenCalledWith('overlay');
      expect(mockOverlayService.updateOverlayState).toHaveBeenCalledWith(state);
    });
    
    it('should set overlay state', () => {
      const state = { isRecording: true };
      windowManager.setOverlayState(state);
      
      expect(windowManager.getService).toHaveBeenCalledWith('overlay');
      expect(mockOverlayService.setOverlayState).toHaveBeenCalledWith(state);
    });
    
    it('should handle errors when overlay service is not available', () => {
      windowManager.getService.mockReturnValueOnce(null);
      
      windowManager.createOverlay();
      
      expect(mockOverlayService.createOverlay).not.toHaveBeenCalled();
    });
    
    it('should handle errors in overlay operations', () => {
      mockOverlayService.createOverlay.mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      windowManager.createOverlay();
      
      expect(windowManager.emitError).toHaveBeenCalled();
    });
  });
}); 