const { Notification } = require('electron');
const path = require('path');

class NotificationService {
  constructor() {
    this.errorSound = null;
    this.initializeAudio();
  }

  initializeAudio() {
    if (process.platform === 'darwin') {
      // On macOS, we can use the system sound
      this.errorSound = 'Basso';
    } else {
      // For other platforms, we could load a custom sound file
      this.errorSound = path.join(__dirname, '../../../assets/sounds/error.wav');
    }
  }

  showNotification(title, body, type = 'info') {
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
  }

  playErrorSound() {
    if (process.platform === 'darwin') {
      // On macOS, use system sound
      const { exec } = require('child_process');
      exec(`afplay /System/Library/Sounds/${this.errorSound}.aiff`);
    } else {
      // For other platforms, we could use a sound library
      // This is a placeholder for future implementation
      console.log('Playing error sound on non-macOS platform');
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

  showAIError(error) {
    this.showNotification(
      'AI Processing Error',
      error.message || 'Failed to process AI command',
      'error'
    );
  }
}

module.exports = new NotificationService(); 