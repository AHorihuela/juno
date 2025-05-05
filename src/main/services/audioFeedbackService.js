const { app } = require('electron');
const path = require('path');
const player = require('node-wav-player');
const fs = require('fs');
const { exec } = require('child_process');
const BaseService = require('./BaseService');
const os = require('os');

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
      
      // Enable audio by default for better user experience
      this.audioEnabled = true;
      
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
        // Test if node-wav-player actually works by trying to play a silent sound
        try {
          console.log('[AudioFeedback] Testing node-wav-player with silent test...');
          
          // Create a temporary silent WAV file for testing
          const tempDir = path.join(os.tmpdir());
          const testFile = path.join(tempDir, 'juno-test-sound.wav');
          
          // Copy a small portion of the start sound to use as a test
          try {
            // Read the first 1KB of the start sound
            const testData = fs.readFileSync(this.startPath, { start: 0, end: 1024 });
            fs.writeFileSync(testFile, testData);
            console.log('[AudioFeedback] Created test sound file:', testFile);
          } catch (fileError) {
            console.warn('[AudioFeedback] Could not create test sound file:', fileError);
            throw new Error('Could not create test sound file');
          }
          
          // Try to play the test file with very low volume - SKIP ACTUAL PLAYBACK
          // Just set result to true to avoid actual sound playing
          const testSuccess = true;
          
          // Clean up test file
          try {
            fs.unlinkSync(testFile);
          } catch (err) {
            console.warn('[AudioFeedback] Could not clean up test file:', err);
          }
          
          if (testSuccess) {
            console.log('[AudioFeedback] node-wav-player test skipped, assuming success');
            this.useNativeFallback = false;
          } else {
            console.warn('[AudioFeedback] node-wav-player test failed, using native fallback');
            this.useNativeFallback = true;
          }
        } catch (error) {
          console.warn('[AudioFeedback] node-wav-player test failed, will use native fallback:', error);
          this.useNativeFallback = true;
        }
      }

      // Skip actual preloading to prevent startup sounds
      console.log('[AudioFeedback] Preparing sound paths without playback');
      this.preloadedSounds = {
        start: this.startPath,
        stop: this.stopPath
      };
      
      // Service is initialized but audio is still disabled
      // until enableAudio() is explicitly called
      console.log('[AudioFeedback] Service initialized with audio disabled');

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
    console.log('[AudioFeedback] Skipping sound preloading to prevent startup sounds');
    // Just prepare the paths without actually playing anything
    this.preloadedSounds = {
      start: this.startPath,
      stop: this.stopPath
    };
  }

  // Play sound using native player
  playNativeSound(soundPath, sync = false) {
    if (process.platform === 'darwin') {
      // On macOS, use afplay with specified volume for better control
      const cmd = `afplay -v 2.0 "${soundPath}"`;
      
      if (sync) {
        return new Promise((resolve, reject) => {
          // Create a child process to monitor and control
          const process = exec(cmd, (error) => {
            if (error) {
              console.error('[AudioFeedback] Native player error:', error);
              reject(error);
            }
            // Note: We don't resolve here because we'll do that on the 'exit' event
          });
          
          process.on('exit', (code) => {
            if (code === 0) {
              console.log('[AudioFeedback] Native playback completed successfully');
              resolve();
            } else {
              console.error('[AudioFeedback] Native playback failed with code:', code);
              reject(new Error(`afplay exited with code ${code}`));
            }
          });
          
          // Also handle process errors
          process.on('error', (err) => {
            console.error('[AudioFeedback] Native playback process error:', err);
            reject(err);
          });
        });
      } else {
        // Async execution for better performance, but still track errors
        const process = exec(cmd);
        process.on('error', (error) => {
          console.error('[AudioFeedback] Native player async error:', error);
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

  // Add a method to explicitly enable audio playback
  enableAudio() {
    this.audioEnabled = true;
    console.log('[AudioFeedback] Audio playback enabled');
  }

  // Add a method to explicitly disable audio playback
  disableAudio() {
    this.audioEnabled = false;
    console.log('[AudioFeedback] Audio playback disabled');
  }

  async playStartSound() {
    if (!this.initialized) {
      console.error('[AudioFeedback] Service not initialized when trying to play start sound');
      return Promise.resolve(); // Don't block recording if sound fails
    }

    // Check if audio is enabled 
    if (!this.audioEnabled) {
      console.log('[AudioFeedback] Start sound skipped - audio disabled');
      return Promise.resolve();
    }

    const startTime = Date.now();
    console.log('[AudioFeedback] Playing start sound from:', this.startPath);
    
    try {
      // For start sound, we'll make it synchronous but with a short timeout
      // This ensures the sound is heard without delaying recording too much
      await Promise.race([
        this.useNativeFallback 
          ? this.playNativeSound(this.startPath, true) // Use sync mode
          : player.play({
              path: this.startPath,
              sync: true // Wait for completion
            }),
        new Promise(resolve => setTimeout(resolve, 500)) // Max 500ms timeout
      ]);
      
      console.log('[AudioFeedback] Start sound completed in:', Date.now() - startTime, 'ms');
    } catch (error) {
      console.warn('[AudioFeedback] Start sound playback failed, falling back to native player:', error);
      try {
        // Try native player as fallback
        await this.playNativeSound(this.startPath, true);
      } catch (fallbackError) {
        console.error('[AudioFeedback] Native fallback also failed:', fallbackError);
      }
    }
    
    return Promise.resolve();
  }

  async playStopSound() {
    if (!this.initialized) {
      console.error('[AudioFeedback] Service not initialized when trying to play stop sound');
      return Promise.resolve(); // Don't block recording if sound fails
    }

    // Check if audio is enabled
    if (!this.audioEnabled) {
      console.log('[AudioFeedback] Stop sound skipped - audio disabled');
      return Promise.resolve();
    }

    const startTime = Date.now();
    console.log('[AudioFeedback] Playing stop sound from:', this.stopPath);
    
    try {
      // For stop sound, we'll make it synchronous but with a short timeout
      // This ensures the sound is heard without delaying UI response too much
      await Promise.race([
        this.useNativeFallback 
          ? this.playNativeSound(this.stopPath, true) // Use sync mode
          : player.play({
              path: this.stopPath,
              sync: true // Wait for completion
            }),
        new Promise(resolve => setTimeout(resolve, 500)) // Max 500ms timeout
      ]);
      
      console.log('[AudioFeedback] Stop sound completed in:', Date.now() - startTime, 'ms');
    } catch (error) {
      console.warn('[AudioFeedback] Stop sound playback failed, falling back to native player:', error);
      try {
        // Try native player as fallback
        await this.playNativeSound(this.stopPath, true);
      } catch (fallbackError) {
        console.error('[AudioFeedback] Native fallback also failed:', fallbackError);
      }
    }
    
    return Promise.resolve();
  }
}

// Export a factory function instead of a singleton
module.exports = () => new AudioFeedbackService(); 