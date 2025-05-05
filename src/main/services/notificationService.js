const { Notification } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs').promises;
const BaseService = require('./BaseService');

class NotificationService extends BaseService {
  constructor() {
    super('Notification');
    this.errorSound = null;
    this.customSoundPath = path.join(__dirname, '../../../assets/sounds/error.wav');
  }

  async _initialize() {
    await this.initializeAudio();
  }

  async _shutdown() {
    // Nothing to clean up
  }

  async initializeAudio() {
    if (process.platform === 'darwin') {
      // On macOS, we can use the system sound
      this.errorSound = 'Basso';
    } else {
      // For other platforms, ensure we have the error sound file
      try {
        await fs.access(this.customSoundPath);
        this.errorSound = this.customSoundPath;
      } catch (error) {
        console.warn('Error sound file not found:', error);
        // Create assets directory if it doesn't exist
        const soundsDir = path.dirname(this.customSoundPath);
        await fs.mkdir(soundsDir, { recursive: true });
        
        // Create a simple WAV file as fallback
        // This is a placeholder - you should replace with a proper sound file
        const fallbackSound = Buffer.from('RIFF....WAV....', 'utf8');
        await fs.writeFile(this.customSoundPath, fallbackSound);
        this.errorSound = this.customSoundPath;
      }
    }
  }

  /**
   * Show a notification
   * @param {Object|string} options - Notification options or message string
   * @param {string} type - Notification type (if options is a string)
   * @returns {Promise<void>}
   */
  async show(options, type = 'info') {
    try {
      // Convert string to object format
      if (typeof options === 'string') {
        options = {
          title: 'Juno',
          body: options,
          type: type
        };
      }
      
      // If the type is error and we're on macOS, temporarily suppress system sounds
      if (options.type === 'error' && process.platform === 'darwin') {
        try {
          // Suppress macOS system alert sound temporarily
          const { exec } = require('child_process');
          exec('osascript -e "set volume alert volume 0"', (err) => {
            if (err) {
              console.warn('Failed to lower system alert volume:', err);
            } else {
              // Restore after 3 seconds
              setTimeout(() => {
                exec('osascript -e "set volume alert volume 5"', () => {});
              }, 3000);
            }
          });
        } catch (error) {
          console.warn('Error suppressing macOS system sounds:', error);
        }
      }
      
      // For error type, we'll play our own sound instead of relying on the system
      if (options.type === 'error' && !options.suppressErrorSound) {
        // Play sound for errors
        if (!options.silent) {
          this.playErrorSound();
        }
      }
      
      // Send to main window via IPC
      this.ipcMain.emit('show-notification', options);
      
      return true;
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }

  async playErrorSound() {
    try {
      if (!this.initialized) {
        throw new Error('NotificationService not initialized');
      }

      if (process.platform === 'darwin') {
        // On macOS, use system sound
        await new Promise((resolve, reject) => {
          exec(`afplay /System/Library/Sounds/${this.errorSound}.aiff`, (error) => {
            if (error) {
              console.error('Failed to play error sound:', error);
              reject(error);
            } else {
              resolve();
            }
          });
        });
      } else if (process.platform === 'win32') {
        // On Windows, use PowerShell to play sound
        await new Promise((resolve, reject) => {
          exec(`powershell -c "(New-Object Media.SoundPlayer '${this.errorSound}').PlaySync()"`, (error) => {
            if (error) {
              console.error('Failed to play error sound:', error);
              reject(error);
            } else {
              resolve();
            }
          });
        });
      } else {
        // On Linux, try to use paplay (PulseAudio)
        await new Promise((resolve, reject) => {
          exec(`paplay ${this.errorSound}`, (error) => {
            if (error) {
              console.error('Failed to play error sound:', error);
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      this.emitError(error);
    }
  }

  showAPIError(error) {
    let message = 'An error occurred with the OpenAI API';
    
    if (error.response) {
      switch (error.response.status) {
        case 401:
          message = 'Invalid OpenAI API key. Please check your settings.';
          break;
        case 429:
          message = 'OpenAI API rate limit exceeded. Please try again later.';
          break;
        default:
          message = `API Error: ${error.message}`;
      }
    }

    this.showNotification('API Error', message, 'error');
  }

  showMicrophoneError() {
    this.showNotification(
      'Microphone Access Required',
      'Please grant microphone access in System Preferences > Security & Privacy > Microphone',
      'error'
    );
  }

  showTranscriptionError(error) {
    this.showNotification(
      'Transcription Error',
      error.message || 'Failed to transcribe audio',
      'error'
    );
  }

  showNoAudioDetected() {
    this.showNotification(
      'No Audio Detected',
      'No speech was detected during the recording. Try speaking louder or adjusting your microphone.',
      'info'
    );
  }

  showAIError(error) {
    this.showNotification(
      'AI Processing Error',
      error.message || 'Failed to process AI command',
      'error'
    );
  }

  /**
   * Suppress macOS system alert sounds temporarily
   * @param {number} duration - How long to suppress sounds in milliseconds
   * @returns {Promise<void>}
   */
  suppressMacSystemSounds(duration = 3000) {
    if (process.platform !== 'darwin') return;
    
    try {
      const { exec } = require('child_process');
      
      // Get current volume first
      exec('osascript -e "get volume alert volume"', (err, stdout) => {
        const currentVolume = stdout.trim() || '5';
        
        // Set volume to 0
        exec('osascript -e "set volume alert volume 0"', (lowerErr) => {
          if (lowerErr) {
            console.warn('Failed to lower system alert volume:', lowerErr);
          } else {
            console.log(`Suppressed macOS system sounds for ${duration}ms`);
            
            // Restore after duration
            setTimeout(() => {
              exec(`osascript -e "set volume alert volume ${currentVolume}"`, (restoreErr) => {
                if (restoreErr) {
                  console.warn('Failed to restore system alert volume:', restoreErr);
                } else {
                  console.log('Restored macOS system sound volume');
                }
              });
            }, duration);
          }
        });
      });
    } catch (error) {
      console.warn('Error managing macOS system sounds:', error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new NotificationService(); 