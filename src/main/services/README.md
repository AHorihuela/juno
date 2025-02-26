# Services

This directory contains service modules that provide core functionality to the application. Services are responsible for implementing business logic, managing system resources, and providing APIs for the rest of the application.

## Key Services

### WindowManager.js

The WindowManager service is responsible for creating and managing application windows. It provides methods for:
- Creating new windows with specific configurations
- Showing, hiding, and closing windows
- Managing window state (minimized, maximized, focused)
- Handling window events

This service was created as part of a refactoring effort to consolidate window management functionality into a single service. See `WINDOW_MANAGER_REFACTOR.md` in the root directory for more details.

### MemoryManager.js

The MemoryManager service handles application memory management and optimization. It provides functionality for:
- Monitoring memory usage
- Implementing memory optimization strategies
- Preventing memory leaks and excessive memory consumption

## Architecture Notes

Services follow these design principles:
1. **Single Responsibility**: Each service focuses on a specific domain of functionality
2. **Encapsulation**: Services hide implementation details and expose a clean API
3. **Dependency Injection**: Services receive dependencies through constructors or setters
4. **Testability**: Services are designed to be easily testable in isolation

## Adding New Services

When adding a new service:
1. Create a new file in this directory with a descriptive name ending in `.js`
2. Implement the service as a class with a clear API
3. Document the service's purpose and API in JSDoc comments
4. Add unit tests in the `__tests__` directory
5. Register the service in the appropriate initialization code (typically in `main.js`) 