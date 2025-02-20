const { app, BrowserWindow } = require('electron');

// Mock electron
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    quit: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn().mockResolvedValue(),
    webContents: {
      openDevTools: jest.fn(),
    },
    on: jest.fn(),
  })),
}));

describe('Main Process', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a browser window', async () => {
    require('../../../main.js');
    
    expect(app.whenReady).toHaveBeenCalled();
    await app.whenReady.mock.results[0].value;
    
    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 800,
        height: 600,
        webPreferences: expect.objectContaining({
          nodeIntegration: true,
          contextIsolation: false,
        }),
      })
    );
  });

  it('quits when all windows are closed (non-darwin)', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });
    
    require('../../../main.js');
    
    const windowAllClosedCallback = app.on.mock.calls.find(
      call => call[0] === 'window-all-closed'
    )[1];
    
    windowAllClosedCallback();
    expect(app.quit).toHaveBeenCalled();
  });
}); 