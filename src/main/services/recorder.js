// REFACTORING OPPORTUNITY:
// This file could be split into multiple modules:
// 1. RecorderService.js - Core recording functionality
// 2. AudioLevelAnalyzer.js - Audio level detection and visualization
// 3. BackgroundAudioController.js - Background audio pausing/resuming
// 4. MicrophoneManager.js - Microphone permission and device handling

// This file has been refactored into separate modules.
// Importing the main RecorderService which now uses the other modules.
const RecorderService = require('./recorder/RecorderService');

// Export a factory function
module.exports = () => new RecorderService(); 