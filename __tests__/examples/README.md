# Testing Examples

This directory contains example tests that demonstrate how to use the Electron mocks in real-world scenarios. These examples serve as templates for writing tests for similar functionality in the application.

## Example Tests

### Window Creation

`window-creation.test.js` demonstrates how to test window creation and management:

- Mocking the `BrowserWindow` constructor
- Testing window creation with default and custom options
- Testing event handlers

Key techniques:
- Replacing the `BrowserWindow` constructor with a Jest mock function
- Storing and verifying window options
- Accessing and invoking event callbacks

### IPC Communication

`ipc-communication.test.js` demonstrates how to test IPC communication between main and renderer processes:

- Setting up IPC handlers in the main process
- Mocking IPC calls from the renderer process
- Testing success and error cases

Key techniques:
- Mocking `ipcRenderer.invoke` to return custom values
- Testing async operations
- Testing error handling

### Dialog Interactions

`dialog-interactions.test.js` demonstrates how to test dialog interactions:

- Mocking file open/save dialogs
- Mocking message boxes
- Testing user interactions with dialogs

Key techniques:
- Mocking dialog results for different scenarios
- Testing conditional logic based on dialog results
- Testing dialog option parameters

## Using These Examples

To use these examples as templates for your own tests:

1. Identify the Electron APIs your code is using
2. Find the relevant example that demonstrates testing those APIs
3. Adapt the example to your specific use case
4. Use the same mocking techniques to isolate your code from Electron

## Running the Examples

To run all example tests:

```bash
npx jest __tests__/examples
```

To run a specific example:

```bash
npx jest __tests__/examples/window-creation.test.js
``` 