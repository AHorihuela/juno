const { systemPreferences } = require('electron');

/**
 * Manages microphone permissions and device selection
 */
class MicrophoneManager {
  constructor(services) {
    this.services = services;
    this.currentDeviceId = null;
  }

  /**
   * Checks if the microphone permission is granted
   * @param {string} deviceId - Optional device ID to check
   * @returns {Promise<boolean>} - True if permission is granted
   */
  async checkMicrophonePermission(deviceId = null) {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      
      if (status === 'not-determined') {
        const granted = await systemPreferences.askForMediaAccess('microphone');
        if (!granted) {
          throw new Error('Microphone access denied');
        }
        return true;
      }
      
      if (status !== 'granted') {
        throw new Error('Microphone access denied');
      }

      // For macOS, we need to check if this specific device is accessible
      if (deviceId && deviceId !== 'default') {
        try {
          const { desktopCapturer } = require('electron');
          const sources = await desktopCapturer.getSources({
            types: ['audio'],
            thumbnailSize: { width: 0, height: 0 }
          });
          
          const deviceExists = sources.some(source => source.id === deviceId);
          if (!deviceExists) {
            throw new Error('Selected microphone is no longer available');
          }
        } catch (error) {
          console.error('Error checking device availability:', error);
          throw new Error('Failed to verify microphone access');
        }
      }
      
      return true;
    }
    
    return true;
  }

  /**
   * Tests microphone access by attempting to start a short recording
   * @returns {Promise<boolean>} - True if microphone access is available
   */
  async testMicrophoneAccess() {
    console.log('[Recorder] Testing microphone access...');
    
    try {
      // Check microphone permission first
      await this.checkMicrophonePermission();
      
      // Try to create a recorder instance
      const record = require('node-record-lpcm16');
      
      const recordingOptions = {
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw'
      };
      
      console.log('[Recorder] Creating test recorder with options:', recordingOptions);
      const testRecorder = record.record(recordingOptions);
      
      // Start recording for a very short time
      console.log('[Recorder] Starting test recording...');
      const stream = testRecorder.stream();
      
      // Set up data handler
      let dataReceived = false;
      const dataPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (!dataReceived) {
            console.log('[Recorder] No audio data received during test');
            resolve(false);
          }
        }, 500);
        
        stream.once('data', () => {
          console.log('[Recorder] Successfully received audio data in test');
          dataReceived = true;
          clearTimeout(timeout);
          resolve(true);
        });
        
        stream.once('error', (err) => {
          console.error('[Recorder] Error during test recording:', err);
          clearTimeout(timeout);
          resolve(false);
        });
      });
      
      // Wait for data or timeout
      await dataPromise;
      
      // Stop the test recorder
      console.log('[Recorder] Stopping test recording');
      testRecorder.stop();
      
      return dataReceived;
    } catch (error) {
      console.error('[Recorder] Error testing microphone access:', error);
      return false;
    }
  }

  /**
   * Sets the current recording device
   * @param {string} deviceId - The device ID to use
   * @returns {Promise<boolean>} - True if device was set successfully
   */
  async setDevice(deviceId) {
    try {
      console.log('Setting device:', deviceId);
      
      // Validate device access
      await this.checkMicrophonePermission(deviceId);
      
      // Store the device ID
      this.currentDeviceId = deviceId;
      
      // Test the device by trying to open it
      try {
        const record = require('node-record-lpcm16');
        const testRecorder = record.record({
          sampleRate: 16000,
          channels: 1,
          audioType: 'raw',
          device: deviceId === 'default' ? null : deviceId
        });
        
        // If we can start recording, the device is valid
        testRecorder.stream();
        testRecorder.stop();
        
        console.log('Successfully tested device:', deviceId);
      } catch (error) {
        console.error('Failed to test device:', error);
        this.currentDeviceId = 'default'; // Reset to default
        throw new Error('Failed to access the selected microphone. Please try another device.');
      }

      return true;
    } catch (error) {
      console.error('Error setting device:', error);
      if (this.services) {
        this.services.notification.showNotification(
          'Microphone Error',
          error.message,
          'error'
        );
      }
      return false;
    }
  }

  /**
   * Gets the current device ID
   * @returns {string|null} - The current device ID
   */
  getCurrentDeviceId() {
    return this.currentDeviceId;
  }
}

module.exports = MicrophoneManager; 