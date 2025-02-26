# Audio Recording Overlay UI Module

This module provides a clean, modular implementation of the audio recording visualization overlay UI. It separates the UI concerns from the business logic, making the codebase more maintainable and easier to extend.

## Architecture

The overlay UI module follows a clean separation of concerns:

1. **OverlayUI**: Responsible for generating the HTML, CSS, and JavaScript for the overlay window.
2. **OverlayManager**: Handles the creation and management of the overlay window.
3. **OverlayService**: Acts as an adapter between the application's service architecture and the overlay UI module.

## Components

### OverlayUI

This component is responsible for:
- Generating the HTML structure for the overlay
- Defining the CSS styles for the overlay
- Providing the JavaScript for the overlay's functionality
- Setting up IPC message handlers for communication with the main process

### OverlayManager

This component is responsible for:
- Creating and managing the overlay window
- Showing and hiding the overlay with fade effects
- Updating the overlay's state and audio levels
- Setting up IPC handlers for the overlay window

### OverlayService

This service acts as an adapter between the application's service architecture and the overlay UI module. It:
- Delegates overlay-related operations to the OverlayManager
- Handles control actions from the overlay (pause, resume, cancel)
- Provides a clean interface for other services to interact with the overlay

## Usage

To use the overlay UI module, other services should interact with the OverlayService:

```javascript
// Show the overlay
const overlayService = this.getService('overlay');
overlayService.showOverlay();

// Update audio levels
overlayService.updateOverlayAudioLevels(levels);

// Update overlay state
overlayService.updateOverlayState('active');

// Hide the overlay
overlayService.hideOverlay();
```

## States

The overlay supports the following states:

1. **idle**: The default state when the overlay is shown but recording hasn't started.
2. **active**: The state when recording is in progress and audio is being captured.
3. **paused**: The state when recording is paused.

## Controls

The overlay provides the following controls:

1. **Pause/Resume**: Allows the user to pause and resume recording.
2. **Cancel**: Allows the user to cancel the recording.

## Customization

The overlay's appearance and behavior can be customized by modifying the OverlayUI component:

- To change the appearance, modify the `getStyles` method.
- To change the behavior, modify the `getScript` method.
- To change the HTML structure, modify the `getHTML` method.

## Benefits of This Architecture

1. **Separation of Concerns**: UI logic is separated from business logic.
2. **Modularity**: Each component has a single responsibility.
3. **Maintainability**: Changes to the UI don't affect the business logic.
4. **Testability**: Components can be tested in isolation.
5. **Extensibility**: New features can be added without modifying existing code. 