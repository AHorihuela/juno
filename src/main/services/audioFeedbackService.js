const { app } = require('electron');
const path = require('path');
const player = require('node-wav-player');

class AudioFeedbackService {
  constructor() {
    // Track initialization state
    this.isInitialized = false;
    this.startPath = '';
    this.stopPath = '';

    // Initialize when app is ready
    if (app.isReady()) {
      this.initialize();
    } else {
      app.on('ready', () => this.initialize());
    }
  }

  initialize() {
    try {
      console.log('[AudioFeedback] Initializing...');
      
      // Get absolute paths
      const assetsPath = path.join(process.cwd(), 'assets', 'sounds');
      this.startPath = path.join(assetsPath, 'start.wav');
      this.stopPath = path.join(assetsPath, 'stop.wav');

      console.log('[AudioFeedback] Sound paths:', {
        assetsPath,
        startPath: this.startPath,
        stopPath: this.stopPath
      });

      this.isInitialized = true;
      console.log('[AudioFeedback] Initialized successfully');
    } catch (error) {
      console.error('[AudioFeedback] Failed to initialize:', error);
      console.error('[AudioFeedback] Error details:', error.stack);
    }
  }

  async playStartSound() {
    try {
      if (!this.isInitialized) {
        console.warn('[AudioFeedback] Not initialized, attempting initialization...');
        this.initialize();
      }

      console.log('[AudioFeedback] Playing start sound...');
      await player.play({
        path: this.startPath,
        sync: true
      });
      console.log('[AudioFeedback] Start sound played successfully');
    } catch (error) {
      console.error('[AudioFeedback] Failed to play start sound:', error);
      console.error('[AudioFeedback] Error details:', error.stack);
    }
  }

  async playStopSound() {
    try {
      if (!this.isInitialized) {
        console.warn('[AudioFeedback] Not initialized, attempting initialization...');
        this.initialize();
      }

      console.log('[AudioFeedback] Playing stop sound...');
      await player.play({
        path: this.stopPath,
        sync: true
      });
      console.log('[AudioFeedback] Stop sound played successfully');
    } catch (error) {
      console.error('[AudioFeedback] Failed to play stop sound:', error);
      console.error('[AudioFeedback] Error details:', error.stack);
    }
  }
}

module.exports = new AudioFeedbackService(); 