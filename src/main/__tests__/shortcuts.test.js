const electron = require('electron');

// Mock recorder service
jest.mock('../../main/services/recorder', () => ({
  isRecording: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  on: jest.fn(),
}));

// Mock electron
jest.mock('electron', () => {
  const mockWhenReady = jest.fn().mockResolvedValue();
  const mockOn = jest.fn();
  const mockQuit = jest.fn();
  const mockRegister = jest.fn();
  const mockUnregisterAll = jest.fn();
  
  return {
    app: {
      whenReady: mockWhenReady,
      on: mockOn,
      quit: mockQuit,
    },
    globalShortcut: {
      register: mockRegister,
      unregisterAll: mockUnregisterAll,
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
      loadFile: jest.fn().mockResolvedValue(),
      webContents: {
        openDevTools: jest.fn(),
      },
      on: jest.fn(),
    })),
  };
});

const { app, globalShortcut } = require('electron');
const recorder = require('../../main/services/recorder');

describe('Global Shortcuts', () => {
  let f6Handler;
  let escHandler;
  let quitHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Load main process code
    require('../../../main.js');

    // Wait for app ready
    await app.whenReady();

    // Store handlers for testing
    app.on.mock.calls.forEach(([event, handler]) => {
      if (event === 'will-quit') {
        quitHandler = handler;
      }
    });

    globalShortcut.register.mock.calls.forEach(([key, handler]) => {
      if (key === 'F6') {
        f6Handler = handler;
      } else if (key === 'Escape') {
        escHandler = handler;
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers shortcuts when app is ready', async () => {
    expect(globalShortcut.register).toHaveBeenCalledWith(
      'F6',
      expect.any(Function)
    );

    expect(globalShortcut.register).toHaveBeenCalledWith(
      'Escape',
      expect.any(Function)
    );
  });

  it('unregisters all shortcuts on quit', () => {
    expect(quitHandler).toBeDefined();
    quitHandler();
    expect(globalShortcut.unregisterAll).toHaveBeenCalled();
  });

  it('starts recording on double-tap F6', () => {
    expect(f6Handler).toBeDefined();

    // Simulate double tap within 300ms
    f6Handler();
    jest.advanceTimersByTime(200);
    f6Handler();

    expect(recorder.start).toHaveBeenCalled();
  });

  it('stops recording on Escape', () => {
    expect(escHandler).toBeDefined();

    // Simulate recording in progress
    recorder.isRecording.mockReturnValue(true);

    // Simulate Escape press
    escHandler();

    expect(recorder.stop).toHaveBeenCalled();
  });
}); 