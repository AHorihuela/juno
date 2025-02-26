# Components

This directory contains React components used throughout the application. Components are organized by functionality and feature area.

## Component Organization

Components in this directory follow these organizational principles:
- **Feature-based**: Components related to a specific feature are grouped together
- **Reusability**: Generic, reusable components are separated from feature-specific ones
- **Composition**: Complex components are composed of smaller, simpler components

## Key Components

### MemoryManager.jsx

A React component that provides a UI for monitoring and managing application memory usage. This component:
- Displays current memory usage statistics
- Provides controls for manual memory optimization
- Shows memory usage history and trends

This component works in conjunction with the `MemoryManager.js` service in the main process, communicating through IPC channels.

## Component Guidelines

When creating new components:

1. **Naming Conventions**:
   - Use PascalCase for component names
   - Use `.jsx` extension for React components
   - Name files the same as the primary component they export

2. **Component Structure**:
   - Keep components focused on a single responsibility
   - Extract reusable logic into custom hooks
   - Use props for configuration and data input
   - Document props using PropTypes or JSDoc comments

3. **Styling**:
   - Use consistent styling patterns (CSS modules, styled-components, etc.)
   - Follow the application's design system
   - Ensure components are responsive and accessible

4. **Testing**:
   - Write unit tests for components in the `__tests__` directory
   - Test component rendering, interactions, and edge cases

## Communication with Main Process

Components that need to communicate with the main process should:
1. Use the IPC bridge provided through the preload script
2. Handle asynchronous communication properly
3. Implement error handling for IPC operations
4. Consider using a higher-level abstraction (like a custom hook) for IPC communication 