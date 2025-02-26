const { app } = require('electron');
const path = require('path');
const player = require('node-wav-player');
const fs = require('fs');
const BaseService = require('./BaseService');

// Change this number (1-4) to test different variations
const CURRENT_VARIATION = 1;

class AudioFeedbackService extends BaseService {
  constructor() {
    super('AudioFeedback');
    this.startPath = '';
    this.stopPath = '';
    this.initTime = Date.now();
    console.log('[AudioFeedback] Service constructed');
  }

  async _initialize() {
    try {
      const initStartTime = Date.now();
      console.log('[AudioFeedback] Starting initialization at:', initStartTime);
      
      // Ensure app is ready
      if (!app.isReady()) {
        console.log('[AudioFeedback] Waiting for app to be ready...');
        await new Promise(resolve => app.once('ready', resolve));
        console.log('[AudioFeedback] App is now ready');
      }
      
      const assetsPath = path.join(process.cwd(), 'assets', 'sounds');
      this.startPath = path.join(assetsPath, 'start.wav');
      this.stopPath = path.join(assetsPath, 'stop.wav');

      console.log('[AudioFeedback] Sound paths set:', {
        startPath: this.startPath,
        stopPath: this.stopPath
      });

      // Verify sound files exist and are accessible
      if (!fs.existsSync(this.startPath)) {
        throw new Error(`Start sound file not found at: ${this.startPath}`);
      }
      if (!fs.existsSync(this.stopPath)) {
        throw new Error(`Stop sound file not found at: ${this.stopPath}`);
      }

      // Verify file sizes
      const startStats = fs.statSync(this.startPath);
      const stopStats = fs.statSync(this.stopPath);
      
      if (startStats.size === 0) {
        throw new Error('Start sound file is empty');
      }
      if (stopStats.size === 0) {
        throw new Error('Stop sound file is empty');
      }

      console.log('[AudioFeedback] Sound files verified:', {
        startPath: this.startPath,
        startSize: startStats.size,
        stopPath: this.stopPath,
        stopSize: stopStats.size,
        initDuration: Date.now() - initStartTime + 'ms'
      });

    } catch (error) {
      console.error('[AudioFeedback] Initialization error:', error);
      throw this.emitError(error);
    }
  }

  async _shutdown() {
    // Nothing to clean up
  }

  async playStartSound() {
    try {
      if (!this.initialized) {
        console.error('[AudioFeedback] Service not initialized when trying to play start sound');
        throw new Error('AudioFeedbackService not initialized');
      }

      const startTime = Date.now();
      console.log('[AudioFeedback] Playing start sound from:', this.startPath);
      
      await player.play({
        path: this.startPath,
        sync: true
      });
      
      console.log('[AudioFeedback] Start sound completed, duration:', Date.now() - startTime, 'ms');
    } catch (error) {
      console.error('[AudioFeedback] Error playing start sound:', error);
      throw this.emitError(error);
    }
  }

  async playStopSound() {
    try {
      if (!this.initialized) {
        console.error('[AudioFeedback] Service not initialized when trying to play stop sound');
        throw new Error('AudioFeedbackService not initialized');
      }

      const startTime = Date.now();
      console.log('[AudioFeedback] Playing stop sound from:', this.stopPath);
      
      // Play asynchronously to avoid blocking the transcription process
      player.play({
        path: this.stopPath,
        sync: false // Changed to async
      }).then(() => {
        console.log('[AudioFeedback] Stop sound completed, duration:', Date.now() - startTime, 'ms');
      }).catch(error => {
        console.error('[AudioFeedback] Error in async stop sound playback:', error);
      });
      
      // Return immediately without waiting for sound to complete
      return Promise.resolve();
    } catch (error) {
      console.error('[AudioFeedback] Error playing stop sound:', error);
      throw this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new AudioFeedbackService(); 