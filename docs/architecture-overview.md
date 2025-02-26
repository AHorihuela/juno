# Juno Architecture Overview

This document provides a high-level overview of Juno's architecture and recent refactoring efforts to improve code organization, maintainability, and scalability.

## Application Structure

Juno follows an Electron-based architecture with two main processes:

1. **Main Process**: Handles system-level operations, window management, and core services
2. **Renderer Process**: Manages the user interface and user interactions

### Directory Structure

```
juno/
├── src/
│   ├── main/              # Main process code
│   │   ├── services/      # Core application services
│   │   ├── ipc/           # IPC handlers for main-renderer communication
│   │   ├── utils/         # Utility functions
│   │   ├── windows/       # Window configuration
│   │   └── ui/            # Main process UI elements (tray, notifications)
│   │
│   └── renderer/          # Renderer process code
│       ├── components/    # React components
│       ├── layouts/       # Page layouts
│       ├── hooks/         # Custom React hooks
│       ├── utils/         # Frontend utilities
│       └── styles/        # CSS and styling
│
├── assets/                # Application assets
├── dist/                  # Distribution builds
├── docs/                  # Documentation
└── __tests__/             # Top-level tests
```

## Core Services

### WindowManager

The WindowManager service consolidates window management functionality that was previously spread across multiple services (`WindowService` and `OverlayService`). This unified service:

- Manages the main application window
- Controls the recording indicator overlay
- Handles window state (show, hide, restore)
- Provides audio level visualization for the recording indicator

### RecorderService

The RecorderService has been refactored from a monolithic 800+ line file into a modular structure with specialized components:

1. **RecorderService**: Main orchestrator that maintains the public API
2. **MicrophoneManager**: Handles microphone permissions and device selection
3. **AudioLevelAnalyzer**: Processes audio buffers to detect levels and speech
4. **BackgroundAudioController**: Controls background audio pausing/resuming

This refactoring improves:
- Maintainability: Each module has a single responsibility
- Testability: Modules can be tested independently
- Extensibility: New features can be added to the appropriate module

### MemoryManager

The MemoryManager service optimizes application memory usage by:
- Monitoring memory consumption
- Implementing garbage collection strategies
- Managing resource cleanup

### ServiceRegistry

The ServiceRegistry manages service lifecycle and dependencies:
- Initializes services in the correct order
- Provides dependency injection
- Handles service shutdown

## Communication Patterns

### IPC Communication

Communication between the main and renderer processes happens through:
1. **IPC Channels**: Defined in the `ipc/` directory
2. **Context Bridge**: Exposes a safe subset of APIs to the renderer process via the preload script

### Service Communication

Services communicate with each other through:
1. **Direct Method Calls**: For services within the same process
2. **Event Emitters**: For loosely coupled communication
3. **ServiceRegistry**: For accessing dependencies

## Recent Refactoring Efforts

### Window Management Refactoring

Consolidated window management functionality into a single `WindowManager` service, improving:
- Code organization
- Dependency management
- Encapsulation of window-related concerns

### Recorder Service Refactoring

Split the large `recorder.js` file into specialized modules:
- Improved code organization
- Enhanced maintainability
- Better separation of concerns
- Easier testing

## Future Improvements

Planned architectural improvements include:
1. Further modularization of large services
2. Enhanced test coverage for critical components
3. Improved error handling and recovery mechanisms
4. Better state management in the renderer process
5. Performance optimizations for audio processing

## Development Guidelines

When contributing to Juno, follow these architectural principles:
1. **Single Responsibility**: Each module should have a clear, focused purpose
2. **Separation of Concerns**: Keep UI logic separate from business logic
3. **Testability**: Design components to be easily testable
4. **Documentation**: Document architectural decisions and component interactions
5. **Consistency**: Follow established patterns for new features 