# Main Process

This directory contains all code that runs in Electron's main process. The main process is responsible for creating and managing application windows, handling system-level operations, and coordinating with the renderer process.

## Directory Structure

- **services/**: Core services that provide functionality to the application
  - Contains managers for windows, memory, and other system resources
  - Implements business logic that doesn't belong in the UI layer

- **ipc/**: Inter-Process Communication handlers
  - Manages communication between the main process and renderer processes
  - Implements IPC channels and handlers for various application features

- **utils/**: Utility functions and helper modules
  - Provides common functionality used across the main process
  - Contains reusable code that doesn't fit into a specific service

- **windows/**: Window configuration and setup
  - Defines window properties, dimensions, and behaviors
  - Contains window-specific initialization code

- **ui/**: UI-related functionality for the main process
  - Manages tray icons, system notifications, and other UI elements controlled by the main process

- **__tests__/**: Test files for the main process code
  - Contains unit and integration tests for main process modules

## Key Files

- `WindowManager.js`: Manages application windows, providing methods for creating, showing, hiding, and closing windows
- `MemoryManager.js`: Handles application memory management and optimization
- `windowManager.js`: Utility functions for window management that complement the WindowManager service

## Architecture Notes

The main process follows a service-oriented architecture where each service is responsible for a specific domain of functionality. Services communicate with each other through direct method calls, while communication with the renderer process happens through IPC channels defined in the `ipc/` directory.

When adding new functionality, consider whether it belongs in the main process or renderer process based on its requirements for system access and UI interaction. 