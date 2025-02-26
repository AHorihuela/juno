# Test Helpers

This directory contains helper functions and utilities to simplify testing in the Juno application.

## Available Helpers

### `electron-test-utils.js`

Provides utilities for testing Electron-specific functionality:

```javascript
// Import the helpers
const { 
  resetElectronMocks,
  mockBrowserWindow,
  mockDialog,
  mockIpc
} = require('../helpers/electron-test-utils');

// Use in tests
beforeEach(() => {
  resetElectronMocks();
});

test('creates a window', () => {
  const mockWindow = mockBrowserWindow();
  // Test window creation...
});
```

#### Functions

- `resetElectronMocks()`: Resets all Electron mocks to their initial state
- `mockBrowserWindow()`: Sets up a mock BrowserWindow with common methods
- `mockDialog(responses)`: Configures dialog mock responses
- `mockIpc(channels)`: Sets up IPC mock handlers for specified channels

## Creating New Helpers

When adding new helper functions:

1. Group related functions in a single file
2. Add clear documentation and examples
3. Keep functions focused on a single responsibility
4. Add tests for complex helper functions

## Best Practices

1. **Reuse helpers**: Use these helpers to avoid duplicating test setup code
2. **Keep it simple**: Helpers should simplify tests, not make them more complex
3. **Document usage**: Include examples of how to use each helper
4. **Test edge cases**: Consider how helpers handle different inputs and edge cases 