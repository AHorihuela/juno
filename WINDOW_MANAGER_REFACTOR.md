# Window Management Refactoring

## Overview

This refactoring consolidates window management functionality that was previously spread across multiple services (`WindowService` and `OverlayService`) into a single, unified `WindowManager` service. This change improves code organization, reduces duplication, and makes the window management system more maintainable.

## Changes Made

1. Created a new `WindowManager` service that combines the functionality of:
   - `WindowService` (main application window management)
   - `OverlayService` (recording indicator overlay)

2. Updated the `ServiceRegistry` to use the new `WindowManager` service instead of the separate services.

3. Updated references in other services:
   - `main.js`: Updated imports and service registration
   - `recordingService.js`: Updated to use the new `WindowManager` service
   - `recorder.js`: Updated to use the new `WindowManager` service for audio level visualization

## Benefits

- **Reduced Complexity**: Consolidated window management logic into a single service
- **Improved Maintainability**: Easier to understand and modify window-related functionality
- **Better Encapsulation**: All window management concerns are now handled in one place
- **Cleaner Dependencies**: Other services now only need to depend on a single window management service

## Implementation Details

The new `WindowManager` service provides the following functionality:

- Main window management (show, hide, restore)
- Overlay window management (create, show, hide, destroy)
- Recording indicator management (show, hide)
- Audio level visualization for the recording indicator

## Future Improvements

- Further refine the `WindowManager` API to make it more intuitive
- Add support for additional window types if needed
- Implement window state persistence
- Add more robust error handling for window-related operations 