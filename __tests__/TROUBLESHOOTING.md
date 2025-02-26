# Testing Troubleshooting Guide

This guide addresses common issues encountered when writing and running tests for the Juno application.

## Common Issues and Solutions

### Electron Module Not Found

**Issue:** Tests fail with `Cannot find module 'electron'`.

**Solution:**
1. Ensure Jest is configured to use the Electron mock:
   ```javascript
   // jest.config.js
   moduleNameMapper: {
     'electron': '<rootDir>/__mocks__/electron'
   }
   ```
2. Check that the Electron mock is properly implemented in `__mocks__/electron/index.js`.

### Missing Mock Functions

**Issue:** Tests fail with `mockFunction.mockReturnValue is not a function`.

**Solution:**
1. Ensure all mocked methods are created with `jest.fn()`:
   ```javascript
   const dialog = {
     showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] })
   };
   ```
2. Use `resetElectronMocks()` from `electron-test-utils.js` before each test.

### IPC Communication Not Working

**Issue:** IPC events or handlers are not being triggered in tests.

**Solution:**
1. Manually trigger IPC events in tests:
   ```javascript
   // Simulate renderer sending message to main
   ipcMain.emit('channel-name', {}, ...args);
   
   // Simulate main sending message to renderer
   ipcRenderer.emit('channel-name', {}, ...args);
   ```
2. Check that IPC handlers are registered before the test runs.

### React Component Testing Issues

**Issue:** React components fail to render or interact properly in tests.

**Solution:**
1. Use React Testing Library's render function:
   ```javascript
   import { render, screen } from '@testing-library/react';
   
   test('renders component', () => {
     render(<MyComponent />);
     expect(screen.getByText('Expected Text')).toBeInTheDocument();
   });
   ```
2. Mock context providers if components depend on them:
   ```javascript
   const wrapper = ({ children }) => (
     <ContextProvider value={mockValue}>
       {children}
     </ContextProvider>
   );
   
   render(<MyComponent />, { wrapper });
   ```

### Asynchronous Test Failures

**Issue:** Tests involving promises or async functions fail unexpectedly.

**Solution:**
1. Use `async/await` with test functions:
   ```javascript
   test('async operation', async () => {
     await expect(asyncFunction()).resolves.toBe(expectedValue);
   });
   ```
2. Use `waitFor` for UI updates:
   ```javascript
   await waitFor(() => {
     expect(screen.getByText('Updated Text')).toBeInTheDocument();
   });
   ```

### File/Image Import Errors

**Issue:** Tests fail when components import CSS, images, or other non-JS files.

**Solution:**
1. Configure Jest to mock these imports:
   ```javascript
   // jest.config.js
   moduleNameMapper: {
     '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
     '\\.(css|less|scss)$': '<rootDir>/__mocks__/styleMock.js'
   }
   ```
2. Create simple mock files:
   ```javascript
   // __mocks__/fileMock.js
   module.exports = 'test-file-stub';
   
   // __mocks__/styleMock.js
   module.exports = {};
   ```

### Jest Configuration Issues

**Issue:** Jest doesn't recognize test files or apply transformations correctly.

**Solution:**
1. Check Jest configuration in `package.json` or `jest.config.js`:
   ```javascript
   // jest.config.js
   module.exports = {
     testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
     testEnvironment: 'jsdom',
     setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
     // other configurations
   };
   ```
2. Ensure test files follow the naming convention: `*.test.js` or `*.test.jsx`.

## Debugging Tests

### Using Console Logs

Add console logs to see values during test execution:

```javascript
test('debug with console.log', () => {
  const result = functionToTest();
  console.log('Result:', result);
  expect(result).toBe(expectedValue);
});
```

### Using Jest's Debug Mode

Run tests in debug mode:

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open Chrome at `chrome://inspect` to use the debugger.

### Using the `debug` Function

React Testing Library provides a `debug` function:

```javascript
const { debug } = render(<MyComponent />);
debug(); // Prints the current DOM state
```

## Getting Help

If you're still having issues:

1. Check the [Jest documentation](https://jestjs.io/docs/getting-started)
2. Check the [React Testing Library documentation](https://testing-library.com/docs/react-testing-library/intro/)
3. Search for similar issues in the project repository
4. Ask for help from other team members 