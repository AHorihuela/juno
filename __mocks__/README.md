# Mock Implementations

This directory contains mock implementations of external dependencies used in testing.

## Structure

- `electron/` - Mock implementations for Electron modules
  - `index.js` - Main Electron mock that exports all mocked modules
- `electron-store.js` - Mock for electron-store package
- `styleMock.js` - Mock for CSS/style imports
- `fileMock.js` - Mock for file imports (images, fonts, etc.)

## Electron Mocks

The Electron mock implementation provides Jest-compatible mocks for all Electron APIs used in the application. This allows tests to run without requiring an actual Electron environment.

### Usage

The mock is automatically used in tests through the Jest configuration:

```js
// jest.config.js
moduleNameMapper: {
  'electron': '<rootDir>/__mocks__/electron/index.js',
}
```

### Available Mocks

- `app` - Application lifecycle and information
- `BrowserWindow` - Window management
- `dialog` - File and message dialogs
- `ipcMain` - Main process IPC
- `ipcRenderer` - Renderer process IPC
- `Menu` and `MenuItem` - Application and context menus
- `shell` - Desktop integration
- `clipboard` - System clipboard
- `screen` - Display information

### Customizing Mocks for Specific Tests

You can customize the behavior of mocks in individual test files:

```js
// In your test file
const { ipcMain } = require('electron');

// Override the default mock behavior
ipcMain.handle.mockImplementation((channel, listener) => {
  if (channel === 'custom-channel') {
    return customHandler;
  }
});
```

## Adding New Mocks

When adding new dependencies that need to be mocked:

1. Create a new mock file in this directory
2. Add the mock to the `moduleNameMapper` in `jest.config.js`
3. Document the mock in this README

## Best Practices

- Keep mocks as simple as possible while providing the functionality needed for tests
- Use Jest's mocking capabilities (`jest.fn()`, `mockReturnValue`, etc.)
- Reset mocks between tests to ensure isolation
- Document any complex mock behavior 