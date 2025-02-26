# Testing Strategy

This directory contains tests for the Juno application. The testing strategy is designed to ensure the application's reliability, maintainability, and correctness.

## Directory Structure

- `__tests__/` - Root test directory
  - `examples/` - Example tests demonstrating testing patterns for common scenarios
  - `helpers/` - Test utilities and helper functions
  - `__mocks__/` - Mock implementations for external dependencies

## Testing Approach

Our testing approach follows these principles:

1. **Unit Tests**: Test individual components and services in isolation
2. **Integration Tests**: Test interactions between components
3. **Mock External Dependencies**: Use mocks for Electron APIs and other external dependencies
4. **Test Coverage**: Aim for comprehensive test coverage of critical functionality

## Running Tests

To run all tests:

```bash
npm test
```

To run specific tests:

```bash
npx jest <path-to-test-file>
```

For example:

```bash
npx jest __tests__/examples
```

## Mock Strategy

We use Jest's mocking capabilities to mock external dependencies:

- Electron APIs are mocked in `__mocks__/electron/`
- Other external dependencies are mocked as needed

## Test Helpers

The `helpers/` directory contains utilities to simplify testing:

- `electron-test-utils.js`: Utilities for testing Electron-specific functionality

## Example Tests

The `examples/` directory contains example tests that demonstrate how to test common scenarios:

- Window creation and management
- IPC communication between main and renderer processes
- Dialog interactions (file open/save, message boxes)

These examples serve as templates for writing new tests.

## Best Practices

1. **Isolation**: Tests should be independent and not rely on the state from other tests
2. **Readability**: Tests should be clear about what they're testing
3. **Maintainability**: Tests should be easy to maintain and update
4. **Speed**: Tests should run quickly to enable fast feedback
5. **Reliability**: Tests should produce consistent results

## Continuous Integration

Tests are run automatically as part of our CI pipeline to ensure code quality and prevent regressions.

# Testing Strategy

This document outlines the testing strategy for the Juno application, including test organization, coverage requirements, and best practices.

## Test Organization

Tests are organized into two main categories:

1. **Main Process Tests**: Located in `src/main/__tests__/`
   - Tests for Electron main process code
   - Includes services, utilities, and IPC handlers

2. **Renderer Process Tests**: Located in `src/renderer/__tests__/`
   - Tests for React components and renderer process code
   - Includes component tests, hooks, and utilities

Each category follows a directory structure that mirrors the source code, making it easy to locate tests for specific modules.

## Critical Components

The following components are considered critical and require comprehensive test coverage:

- **WindowManager**: Main process service for window management
- **MemoryManager**: Main process service for memory management
- **IPC Handlers**: Communication between main and renderer processes
- **ServiceRegistry**: Service registration and dependency injection
- **React Components**: UI components, especially those with complex state management

## Coverage Requirements

- **Critical Components**: Minimum 80% code coverage (lines, functions, branches, statements)
- **Other Components**: Aim for at least 60% code coverage

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

This will run all tests and generate a coverage report in the `coverage/` directory. The report includes:
- Console output with coverage percentages
- HTML report for detailed analysis (open `coverage/lcov-report/index.html`)
- Special focus on critical components

### Critical Components Only

```bash
npm run test:critical
```

This runs tests only for the critical components, which is useful for quick validation during development.

## Testing Guidelines

### Main Process Testing

- Mock Electron APIs to avoid actual system interactions
- Test both success and error paths
- Use Jest's mocking capabilities for dependencies
- Test service initialization and shutdown
- Test IPC handlers with mock events

### Renderer Process Testing

- Use React Testing Library for component tests
- Focus on user interactions and behavior
- Mock IPC communication with the main process
- Test component lifecycle (mounting, updating, unmounting)
- Test error handling and edge cases

## Continuous Integration

Tests are automatically run in the CI pipeline for:
- Pull requests to the main branch
- Merges to the main branch
- Release builds

The CI pipeline will fail if:
- Any test fails
- Coverage for critical components falls below the required threshold

## Adding New Tests

When adding new features or fixing bugs:
1. Add tests that cover the new functionality
2. Ensure tests pass both in isolation and as part of the full test suite
3. Check that coverage meets the requirements
4. For critical components, add tests for edge cases and error handling

## Mocking Strategy

- Use Jest's mocking capabilities for external dependencies
- Create dedicated mock files for complex dependencies
- Use factory functions to create test fixtures
- Reset mocks between tests to ensure isolation

# Root-Level Tests

This directory contains tests that are not specific to either the main or renderer processes, but rather test functionality that spans both or is common to the entire application.

## Test Categories

- **Integration Tests**: Tests that verify the interaction between multiple components
- **Mock Verification**: Tests that verify the correctness of mock implementations
- **Utility Tests**: Tests for utility functions used across the application

## Running Tests

To run all tests, including those in this directory:

```bash
npm test
```

To run only tests in this directory:

```bash
npx jest __tests__
```

## Test Files

- `electron-mock.test.js` - Verifies that the Electron mock implementation works correctly

## Example Tests

The `examples/` directory contains example tests that demonstrate how to use the Electron mocks in real-world scenarios:

- `window-creation.test.js` - Demonstrates how to test window creation and management
- `ipc-communication.test.js` - Demonstrates how to test IPC communication between main and renderer processes
- `dialog-interactions.test.js` - Demonstrates how to test dialog interactions

These examples serve as templates for writing tests for similar functionality in the application.

## Helpers

The `helpers/` directory contains utility functions for testing:

- `electron-test-utils.js` - Utility functions for testing Electron applications

## Adding New Tests

When adding new tests to this directory:

1. Create a new file with the `.test.js` or `.spec.js` extension
2. Follow the Jest testing conventions
3. Use descriptive test names that clearly indicate what is being tested
4. Update this README to document the new test file

## Best Practices

- Keep tests focused on a single piece of functionality
- Use descriptive test names
- Avoid dependencies on external services
- Mock external dependencies
- Clean up after tests to avoid side effects
- Use `beforeEach` and `afterEach` hooks for setup and teardown
- Group related tests using `describe` blocks 