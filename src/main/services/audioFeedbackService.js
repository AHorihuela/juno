const { app } = require('electron');
const path = require('path');
const player = require('node-wav-player');
const fs = require('fs');
const { exec } = require('child_process');
const BaseService = require('./BaseService');

// Change this number (1-4) to test different variations
const CURRENT_VARIATION = 1;

class AudioFeedbackService extends BaseService {
  constructor() {
    super('AudioFeedback');
    this.startPath = '';
    this.stopPath = '';
    this.initTime = Date.now();
    this.useNativeFallback = false; // Flag to use native player as fallback
    this.preloadedSounds = {}; // Cache for preloaded sounds
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

      // Determine if we should use native player
      if (process.env.FORCE_NATIVE_AUDIO === 'true') {
        this.useNativeFallback = true;
        console.log('[AudioFeedback] Using native audio player as requested by environment variable');
      } else {
        // Quick test to see if node-wav-player works
        try {
          // We'll just check if the module is available, without actually playing a test sound
          // This avoids the overhead of creating and playing a test file
          if (typeof player.play !== 'function') {
            throw new Error('player.play is not a function');
          }
          console.log('[AudioFeedback] node-wav-player is available');
        } catch (error) {
          console.warn('[AudioFeedback] node-wav-player test failed, will use native fallback:', error);
          this.useNativeFallback = true;
        }
      }

      // Preload sounds for faster playback
      await this.preloadSounds();

    } catch (error) {
      console.error('[AudioFeedback] Initialization error:', error);
      throw this.emitError(error);
    }
  }

  async _shutdown() {
    // Clean up preloaded sounds
    this.preloadedSounds = {};
  }

  // Preload sounds into memory for faster playback
  async preloadSounds() {
    try {
      if (!this.useNativeFallback) {
        // For node-wav-player, we can't really preload, but we can prepare the paths
        this.preloadedSounds.start = this.startPath;
        this.preloadedSounds.stop = this.stopPath;
      } else {
        // For native players, we can at least cache the file paths
        this.preloadedSounds.start = this.startPath;
        this.preloadedSounds.stop = this.stopPath;
        
        // On macOS, we can use afplay -q to preload the audio engine
        if (process.platform === 'darwin') {
          exec(`afplay -v 0.01 -q "${this.startPath}"`, () => {
            console.log('[AudioFeedback] Preloaded audio engine on macOS');
          });
        }
      }
      console.log('[AudioFeedback] Sounds preloaded');
    } catch (error) {
      console.warn('[AudioFeedback] Failed to preload sounds:', error);
      // Continue anyway, we'll load on demand
    }
  }

  // Play sound using native player
  playNativeSound(soundPath, sync = false) {
    if (process.platform === 'darwin') {
      const cmd = `afplay "${soundPath}"`;
      if (sync) {
        return new Promise((resolve, reject) => {
          exec(cmd, (error) => {
            if (error) {
              console.error('[AudioFeedback] Native player error:', error);
              reject(error);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Async execution for better performance
        exec(cmd, (error) => {
          if (error) {
            console.error('[AudioFeedback] Native player error:', error);
          }
        });
        return Promise.resolve();
      }
    } else if (process.platform === 'win32') {
      const cmd = sync 
        ? `powershell -c "(New-Object Media.SoundPlayer '${soundPath}').PlaySync()"`
        : `powershell -c "(New-Object Media.SoundPlayer '${soundPath}').Play()"`;
      
      if (sync) {
        return new Promise((resolve, reject) => {
          exec(cmd, (error) => {
            if (error) {
              console.error('[AudioFeedback] Native player error:', error);
              reject(error);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Async execution for better performance
        exec(cmd, (error) => {
          if (error) {
            console.error('[AudioFeedback] Native player error:', error);
          }
        });
        return Promise.resolve();
      }
    } else {
      // Linux
      const cmd = `paplay "${soundPath}"`;
      if (sync) {
        return new Promise((resolve, reject) => {
          exec(cmd, (error) => {
            if (error) {
              console.error('[AudioFeedback] Native player error:', error);
              reject(error);
            } else {
              resolve();
            }
          });
        });
      } else {
        // Async execution for better performance
        exec(cmd, (error) => {
          if (error) {
            console.error('[AudioFeedback] Native player error:', error);
          }
        });
        return Promise.resolve();
      }
    }
  }

  async playStartSound() {
    if (!this.initialized) {
      console.error('[AudioFeedback] Service not initialized when trying to play start sound');
      return Promise.resolve(); // Don't block recording if sound fails
    }

    const startTime = Date.now();
    console.log('[AudioFeedback] Playing start sound from:', this.startPath);
    
    // Always play start sound asynchronously to avoid delaying the recording
    if (this.useNativeFallback) {
      this.playNativeSound(this.startPath, false);
    } else {
      try {
        player.play({
          path: this.startPath,
          sync: false // Always async for better responsiveness
        }).catch(error => {
          console.warn('[AudioFeedback] node-wav-player failed, falling back to native player:', error);
          this.playNativeSound(this.startPath, false);
        });
      } catch (error) {
        console.warn('[AudioFeedback] node-wav-player failed, falling back to native player:', error);
        this.playNativeSound(this.startPath, false);
      }
    }
    
    console.log('[AudioFeedback] Start sound triggered, time to trigger:', Date.now() - startTime, 'ms');
    return Promise.resolve();
  }

  async playStopSound() {
    if (!this.initialized) {
      console.error('[AudioFeedback] Service not initialized when trying to play stop sound');
      return Promise.resolve(); // Don't block recording if sound fails
    }

    const startTime = Date.now();
    console.log('[AudioFeedback] Playing stop sound from:', this.stopPath);
    
    // Always play stop sound asynchronously
    if (this.useNativeFallback) {
      this.playNativeSound(this.stopPath, false);
    } else {
      try {
        player.play({
          path: this.stopPath,
          sync: false
        }).catch(error => {
          console.warn('[AudioFeedback] node-wav-player failed, falling back to native player:', error);
          this.playNativeSound(this.stopPath, false);
        });
      } catch (error) {
        console.warn('[AudioFeedback] node-wav-player failed, falling back to native player:', error);
        this.playNativeSound(this.stopPath, false);
      }
    }
    
    console.log('[AudioFeedback] Stop sound triggered, time to trigger:', Date.now() - startTime, 'ms');
    return Promise.resolve();
  }
}

// Export a factory function instead of a singleton
module.exports = () => new AudioFeedbackService(); 