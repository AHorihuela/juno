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

  showNotification(title, body, type = 'info') {
    try {
      if (!this.initialized) {
        throw new Error('NotificationService not initialized');
      }

      const notification = new Notification({
        title,
        body,
        silent: true, // We'll handle the sound separately
        icon: type === 'error' ? path.join(__dirname, '../../../assets/icons/error.png') : undefined
      });

      notification.show();

      // Play sound for errors
      if (type === 'error') {
        this.playErrorSound();
      }
    } catch (error) {
      this.emitError(error);
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
      'No speech was detected during the recording.',
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
}

// Export a factory function instead of a singleton
module.exports = () => new NotificationService(); 