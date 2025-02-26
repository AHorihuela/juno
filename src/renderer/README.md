# Renderer Process

This directory contains all code that runs in Electron's renderer process. The renderer process is responsible for the user interface and handling user interactions.

## Directory Structure

- **components/**: React components used throughout the application
  - Contains reusable UI elements and feature-specific components
  - Organized by functionality and feature area

- **layouts/**: Layout components that define the structure of pages
  - Provides consistent page layouts and structural components
  - Handles responsive design and layout management

- **hooks/**: Custom React hooks
  - Encapsulates reusable stateful logic
  - Provides abstractions for common UI patterns and behaviors

- **utils/**: Utility functions and helper modules
  - Contains reusable code for the renderer process
  - Implements client-side business logic and helper functions

- **styles/**: CSS and styling related files
  - Contains global styles, themes, and styling utilities
  - Implements design system components and styling variables

- **__tests__/**: Test files for the renderer process code
  - Contains unit and integration tests for UI components and utilities

## Key Files

- `index.js`: Entry point for the renderer process
- `App.jsx`: Main React component that defines the application structure
- `preload.js`: Preload script that provides a secure bridge between renderer and main processes
- `index.html`: HTML template for the renderer process

## Architecture Notes

The renderer process follows a component-based architecture using React. Components are organized by feature and functionality, with shared components extracted for reuse. State management is handled through React's built-in state management (useState, useContext) and custom hooks.

Communication with the main process happens through the contextBridge API defined in the preload script, which exposes a safe subset of Electron and Node.js APIs to the renderer process.

When adding new UI features:
1. Consider creating reusable components in the components directory
2. Use custom hooks to encapsulate stateful logic
3. Follow the established styling patterns and design system
4. Ensure proper communication with the main process for system-level operations 