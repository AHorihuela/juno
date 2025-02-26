# Main Process Tests

This directory contains test files for the main process code. These tests focus on the Electron main process functionality, including services, utilities, and IPC handlers.

## Test Organization

Tests in this directory follow these organizational principles:

1. **File Structure**: Test files should mirror the structure of the source files they are testing
   - For example, `src/main/services/WindowManager.js` should be tested in `src/main/__tests__/services/WindowManager.test.js`

2. **Naming Conventions**:
   - Test files should be named after the module they test with a `.test.js` suffix
   - Test suites should use descriptive names that reflect the module being tested
   - Test cases should clearly describe the behavior being tested

3. **Mocking**:
   - Electron modules should be mocked to avoid actual system interactions
   - External dependencies should be mocked to isolate the code being tested
   - Use Jest's mocking capabilities to create clean, isolated tests

## Writing Effective Tests

When writing tests for the main process:

1. **Test Coverage**:
   - Aim for at least 80% code coverage for critical services
   - Test both success and error paths
   - Test edge cases and boundary conditions

2. **Test Structure**:
   - Use `describe` blocks to group related tests
   - Use `beforeEach` and `afterEach` for setup and teardown
   - Keep tests focused on a single behavior or functionality

3. **Assertions**:
   - Make assertions specific and meaningful
   - Test the actual behavior, not the implementation details
   - Use appropriate matchers for the type of assertion

## Critical Components to Test

The following components are considered critical and should have comprehensive test coverage:

- **WindowManager**: Test window creation, management, and lifecycle
- **MemoryManager**: Test memory tier management and optimization
- **IPC Handlers**: Test communication between main and renderer processes
- **Service Registry**: Test service registration and retrieval

## Running Tests

Run main process tests with:

```bash
npm test -- src/main
```

Run a specific test file with:

```bash
npm test -- src/main/__tests__/path/to/test.js
```

Generate coverage report with:

```bash
npm run test:coverage
``` 