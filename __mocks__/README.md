# Mock Implementations

This directory contains mock implementations for external dependencies used in the Juno application. These mocks are used during testing to isolate the code being tested from external systems and to provide controlled test environments.

## Directory Structure

- `__mocks__/` - Root mocks directory
  - `electron/` - Mocks for Electron APIs

## Electron Mocks

The `electron/` directory contains mocks for Electron APIs. These mocks simulate the behavior of Electron in a Node.js environment, allowing tests to run without requiring an actual Electron instance.

### Available Mocks

- `app`: Mock implementation of Electron's app module
- `BrowserWindow`: Mock implementation of Electron's BrowserWindow class
- `dialog`: Mock implementation of Electron's dialog module
- `ipcMain` and `ipcRenderer`: Mock implementations of Electron's IPC modules
- `shell`: Mock implementation of Electron's shell module

### Usage

The mocks are automatically used by Jest when importing Electron modules in test files. For example:

```javascript
// In a test file
const { app, BrowserWindow } = require('electron');

// The imported modules are the mock implementations
```

## Customizing Mocks

You can customize the behavior of mocks in individual tests:

```javascript
// Mock a specific method for a single test
beforeEach(() => {
  electron.dialog.showOpenDialog.mockResolvedValueOnce({
    canceled: false,
    filePaths: ['/path/to/file.txt']
  });
});
```

## Creating New Mocks

When adding new mocks:

1. Create a new file in the appropriate directory
2. Implement the mock with the same interface as the original module
3. Use Jest's mock functions (`jest.fn()`) for methods that need to be spied on or have their behavior customized
4. Document the mock's behavior and any limitations

## Best Practices

1. **Keep mocks simple**: Implement only what's needed for tests
2. **Match the real API**: Mocks should have the same interface as the real modules
3. **Reset mocks between tests**: Use `beforeEach` to reset mock state
4. **Document limitations**: Note any differences between the mock and real implementation 