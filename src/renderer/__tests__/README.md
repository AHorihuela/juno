# Renderer Process Tests

This directory contains test files for the renderer process code. These tests focus on React components, hooks, and utilities used in the Electron renderer process.

## Test Organization

Tests in this directory follow these organizational principles:

1. **File Structure**: Test files should mirror the structure of the source files they are testing
   - For example, `src/renderer/components/MemoryManager.jsx` should be tested in `src/renderer/__tests__/components/MemoryManager.test.jsx`

2. **Naming Conventions**:
   - Test files should be named after the module they test with a `.test.jsx` suffix for React components
   - Test suites should use descriptive names that reflect the component being tested
   - Test cases should clearly describe the behavior being tested

3. **Component Testing**:
   - Use React Testing Library for component tests
   - Focus on testing component behavior from a user perspective
   - Test component interactions and state changes

## Writing Effective Tests

When writing tests for the renderer process:

1. **Test Coverage**:
   - Aim for at least 80% code coverage for critical components
   - Test both success and error states
   - Test user interactions and event handling

2. **Test Structure**:
   - Use `describe` blocks to group related tests
   - Use `beforeEach` and `afterEach` for setup and teardown
   - Keep tests focused on a single behavior or functionality

3. **Assertions**:
   - Make assertions specific and meaningful
   - Test the actual behavior, not the implementation details
   - Use appropriate matchers for the type of assertion

4. **Mocking**:
   - Mock IPC communication with the main process
   - Mock external dependencies to isolate the component being tested
   - Use Jest's mocking capabilities to create clean, isolated tests

## Critical Components to Test

The following components are considered critical and should have comprehensive test coverage:

- **App**: Test the main application component and routing
- **MemoryManager**: Test memory management UI and interactions
- **TranscriptionHistory**: Test history display and interactions
- **Custom Hooks**: Test hook behavior and state management

## Testing Helpers

### Rendering Components

Use the `render` function from React Testing Library to render components:

```jsx
import { render, screen } from '@testing-library/react';
import MyComponent from '../components/MyComponent';

test('renders correctly', () => {
  render(<MyComponent />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### Testing User Interactions

Use `userEvent` for simulating user interactions:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../components/MyComponent';

test('handles button click', async () => {
  render(<MyComponent />);
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
  expect(screen.getByText('Submitted')).toBeInTheDocument();
});
```

## Running Tests

Run renderer process tests with:

```bash
npm test -- src/renderer
```

Run a specific test file with:

```bash
npm test -- src/renderer/__tests__/path/to/test.jsx
```

Generate coverage report with:

```bash
npm run test:coverage
``` 