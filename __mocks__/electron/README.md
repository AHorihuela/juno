# Electron Mocks

This directory contains mock implementations of Electron APIs used for testing. These mocks simulate the behavior of Electron in a Node.js environment, allowing tests to run without requiring an actual Electron instance.

## Available Mocks

### `app.js`

Mock implementation of Electron's [app](https://www.electronjs.org/docs/latest/api/app) module.

```javascript
const app = {
  getPath: jest.fn(),
  on: jest.fn(),
  whenReady: jest.fn().mockResolvedValue(),
  quit: jest.fn(),
  // ... other methods
};
```

### `browser-window.js`

Mock implementation of Electron's [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) class.

```javascript
class BrowserWindow {
  constructor(options) {
    this.options = options;
    this.webContents = {
      send: jest.fn(),
      on: jest.fn(),
      // ... other methods
    };
    // ... other properties
  }

  loadURL(url) {
    this.url = url;
    return Promise.resolve();
  }

  // ... other methods
}
```

### `dialog.js`

Mock implementation of Electron's [dialog](https://www.electronjs.org/docs/latest/api/dialog) module.

```javascript
const dialog = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
  showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: '' }),
  showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
  // ... other methods
};
```

### `ipc-main.js` and `ipc-renderer.js`

Mock implementations of Electron's [ipcMain](https://www.electronjs.org/docs/latest/api/ipc-main) and [ipcRenderer](https://www.electronjs.org/docs/latest/api/ipc-renderer) modules.

```javascript
const ipcMain = {
  on: jest.fn(),
  handle: jest.fn(),
  removeHandler: jest.fn(),
  // ... other methods
};

const ipcRenderer = {
  on: jest.fn(),
  send: jest.fn(),
  invoke: jest.fn(),
  // ... other methods
};
```

### `shell.js`

Mock implementation of Electron's [shell](https://www.electronjs.org/docs/latest/api/shell) module.

```javascript
const shell = {
  openExternal: jest.fn().mockResolvedValue(),
  // ... other methods
};
```

## Usage in Tests

The mocks are automatically used by Jest when importing Electron modules in test files:

```javascript
// In a test file
const { app, BrowserWindow, dialog } = require('electron');

// Now you can use the mocked versions
app.getPath.mockReturnValue('/mock/path');
dialog.showOpenDialog.mockResolvedValue({
  canceled: false,
  filePaths: ['/path/to/file.txt']
});

// Create a mock window
const window = new BrowserWindow({ width: 800, height: 600 });
```

## Customizing Behavior

You can customize the behavior of these mocks in your tests:

```javascript
// Mock a specific method for a single test
beforeEach(() => {
  dialog.showOpenDialog.mockResolvedValueOnce({
    canceled: false,
    filePaths: ['/path/to/specific-file.txt']
  });
});

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
```

## Extending Mocks

If you need to add functionality to these mocks:

1. Modify the appropriate file in this directory
2. Add Jest mock functions for new methods
3. Document the changes in this README

## Limitations

These mocks simulate the API of Electron but do not replicate all of its behavior. Some limitations include:

- No actual window rendering
- No actual file system operations
- Simplified event handling
- No actual IPC between processes (just simulated)

For more complex testing scenarios, consider using a tool like Spectron or Playwright for end-to-end testing with a real Electron instance. 