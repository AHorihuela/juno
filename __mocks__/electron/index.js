/**
 * Mock implementation of Electron for testing
 * This file mocks the core Electron modules and APIs used in the application
 */

// Mock IPC for main process
const ipcMain = {
  on: jest.fn(),
  once: jest.fn(),
  handle: jest.fn(),
  removeHandler: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock IPC for renderer process
const ipcRenderer = {
  on: jest.fn(),
  once: jest.fn(),
  send: jest.fn(),
  invoke: jest.fn().mockResolvedValue({}),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock app module
const app = {
  getPath: jest.fn().mockImplementation((name) => {
    const paths = {
      userData: '/mock/user/data',
      documents: '/mock/documents',
      temp: '/mock/temp',
      logs: '/mock/logs'
    };
    return paths[name] || '/mock/unknown';
  }),
  on: jest.fn(),
  quit: jest.fn(),
  exit: jest.fn(),
  getAppPath: jest.fn().mockReturnValue('/mock/app/path'),
  getName: jest.fn().mockReturnValue('Juno AI Dictation'),
  getVersion: jest.fn().mockReturnValue('1.0.0')
};

// Mock BrowserWindow
class BrowserWindow {
  constructor(options) {
    this.id = Math.floor(Math.random() * 10000);
    this.options = options || {};
    this.webContents = {
      id: this.id,
      send: jest.fn(),
      on: jest.fn(),
      openDevTools: jest.fn(),
      session: {
        on: jest.fn()
      }
    };
  }

  loadURL = jest.fn().mockResolvedValue(undefined);
  loadFile = jest.fn().mockResolvedValue(undefined);
  on = jest.fn();
  once = jest.fn();
  show = jest.fn();
  hide = jest.fn();
  close = jest.fn();
  destroy = jest.fn();
  isDestroyed = jest.fn().mockReturnValue(false);
  isVisible = jest.fn().mockReturnValue(true);
  setSize = jest.fn();
  getSize = jest.fn().mockReturnValue([800, 600]);
  setPosition = jest.fn();
  getPosition = jest.fn().mockReturnValue([0, 0]);
  setTitle = jest.fn();
  focus = jest.fn();
  blur = jest.fn();
  maximize = jest.fn();
  unmaximize = jest.fn();
  isMaximized = jest.fn().mockReturnValue(false);
  minimize = jest.fn();
  restore = jest.fn();
  setMenu = jest.fn();
  setMenuBarVisibility = jest.fn();
  setAutoHideMenuBar = jest.fn();
}

// Mock dialog
const dialog = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: ['/mock/file/path'] }),
  showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: '/mock/save/path' }),
  showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
  showErrorBox: jest.fn()
};

// Mock Menu and MenuItem
const Menu = {
  buildFromTemplate: jest.fn().mockImplementation((template) => ({
    popup: jest.fn(),
    closePopup: jest.fn(),
    items: template.map((item, i) => ({ ...item, id: i }))
  })),
  setApplicationMenu: jest.fn(),
  getApplicationMenu: jest.fn().mockReturnValue(null)
};

const MenuItem = jest.fn().mockImplementation((options) => options);

// Mock shell
const shell = {
  openExternal: jest.fn().mockResolvedValue(undefined),
  openPath: jest.fn().mockResolvedValue({ success: true }),
  showItemInFolder: jest.fn()
};

// Mock clipboard
const clipboard = {
  writeText: jest.fn(),
  readText: jest.fn().mockReturnValue(''),
  clear: jest.fn()
};

// Mock screen
const screen = {
  getPrimaryDisplay: jest.fn().mockReturnValue({
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
    rotation: 0
  }),
  getAllDisplays: jest.fn().mockReturnValue([
    {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      rotation: 0
    }
  ]),
  getDisplayNearestPoint: jest.fn(),
  getDisplayMatching: jest.fn()
};

// Export all mocked modules
module.exports = {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  ipcRenderer,
  Menu,
  MenuItem,
  shell,
  clipboard,
  screen,
  // Add any other Electron modules used in your application
}; 