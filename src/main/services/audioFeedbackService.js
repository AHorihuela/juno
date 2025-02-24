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
  }

  async _initialize() {
    try {
      const initStartTime = Date.now();
      console.log('[AudioFeedback] Starting initialization at:', initStartTime);
      
      // Ensure app is ready
      if (!app.isReady()) {
        await new Promise(resolve => app.once('ready', resolve));
      }
      
      const assetsPath = path.join(process.cwd(), 'assets', 'sounds');
      this.startPath = path.join(assetsPath, 'start.wav');
      this.stopPath = path.join(assetsPath, 'stop.wav');

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
      throw this.emitError(error);
    }
  }

  async _shutdown() {
    // Nothing to clean up
  }

  async playStartSound() {
    try {
      if (!this.initialized) {
        throw new Error('AudioFeedbackService not initialized');
      }

      const startTime = Date.now();
      console.log('[AudioFeedback] Playing start sound...');
      
      await player.play({
        path: this.startPath,
        sync: true
      });
      
      console.log('[AudioFeedback] Start sound completed, duration:', Date.now() - startTime, 'ms');
    } catch (error) {
      throw this.emitError(error);
    }
  }

  async playStopSound() {
    try {
      if (!this.initialized) {
        throw new Error('AudioFeedbackService not initialized');
      }

      const startTime = Date.now();
      console.log('[AudioFeedback] Playing stop sound...');
      
      await player.play({
        path: this.stopPath,
        sync: true
      });
      
      console.log('[AudioFeedback] Stop sound completed, duration:', Date.now() - startTime, 'ms');
    } catch (error) {
      throw this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new AudioFeedbackService(); 