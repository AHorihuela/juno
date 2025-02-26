# Refactoring Plan for recorder.js

The current `recorder.js` file (over 800 lines) is too large and handles multiple responsibilities. This makes it difficult to maintain and extend. Here's a plan to refactor it into smaller, more focused modules:

## 1. Create a Module Structure

Split the code into these modules:

### Core Modules:
- **RecorderService.js** - Main service that orchestrates recording functionality
- **MicrophoneManager.js** - Handles microphone permissions and device selection
- **AudioLevelAnalyzer.js** - Processes audio data to detect levels and silence
- **BackgroundAudioController.js** - Controls background audio (pause/resume)

## 2. Implementation Details

### RecorderService.js
- Keep core recording functionality (start, stop, pause, resume)
- Delegate specialized tasks to other modules
- Maintain the public API that other services use

```javascript
// Example structure
class RecorderService extends BaseService {
  constructor() {
    super('Recorder');
    this.micManager = new MicrophoneManager();
    this.audioAnalyzer = new AudioLevelAnalyzer();
    this.backgroundAudio = new BackgroundAudioController();
    // Core properties
    this.recording = false;
    this.paused = false;
    this.recorder = null;
    this.audioData = [];
  }
  
  async start() {
    // Check mic permissions via micManager
    // Start recording
    // Pause background audio if needed
  }
  
  async stop() {
    // Stop recording
    // Resume background audio
    // Process transcription
  }
}
```

### MicrophoneManager.js
- Handle microphone permissions
- Manage device selection
- Test microphone access

```javascript
class MicrophoneManager {
  constructor() {
    this.currentDeviceId = null;
  }
  
  async checkPermission(deviceId) {
    // Permission logic
  }
  
  async testAccess() {
    // Test mic access
  }
  
  async setDevice(deviceId) {
    // Set and validate device
  }
}
```

### AudioLevelAnalyzer.js
- Process audio buffers
- Calculate audio levels
- Detect silence vs. speech
- Manage visualization data

```javascript
class AudioLevelAnalyzer {
  constructor() {
    this.silenceThreshold = 20;
    this.levelSmoothingFactor = 0.7;
    this.currentLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.hasAudioContent = false;
  }
  
  processBuffer(buffer) {
    // Process audio data
    // Update levels
    // Return whether sound was detected
  }
  
  getLevels() {
    return this.currentLevels;
  }
}
```

### BackgroundAudioController.js
- Handle platform-specific audio control
- Pause/resume media players
- Check if media is playing

```javascript
class BackgroundAudioController {
  constructor() {
    this.backgroundAudioWasPaused = false;
  }
  
  async pauseAudio() {
    // Platform-specific pause logic
  }
  
  async resumeAudio() {
    // Platform-specific resume logic
  }
  
  isMediaPlaying() {
    // Check if media is playing
  }
}
```

## 3. Migration Strategy

1. Create the new files with their respective classes
2. Move functionality one module at a time
3. Update imports and references
4. Test thoroughly after each module migration
5. Remove code from the original file as it's migrated

## 4. Benefits

- **Improved maintainability**: Smaller, focused files are easier to understand and modify
- **Better testability**: Each module can be tested independently
- **Easier collaboration**: Team members can work on different modules simultaneously
- **Future extensibility**: New features can be added to the appropriate module without affecting others

## 5. Timeline Estimate

- Initial setup and structure: 1 day
- Migration of each module: 1-2 days per module
- Testing and refinement: 2-3 days
- Total: 1-2 weeks depending on complexity and testing requirements 