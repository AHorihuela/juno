const { systemPreferences } = require('electron');
const record = require('node-record-lpcm16');
const LogManager = require('../../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('MicrophoneManager');

/**
 * Manages microphone permissions and device selection
 */
class MicrophoneManager {
  constructor(services) {
    this.services = services;
    this.currentDeviceId = null;
    logger.debug('MicrophoneManager initialized');
  }

  /**
   * Checks if microphone permission is granted
   * @param {string} deviceId - Optional device ID to check
   * @returns {Promise<boolean>} - True if permission is granted
   */
  async checkMicrophonePermission(deviceId = null) {
    logger.debug('Checking microphone permission...', { metadata: { deviceId } });
    
    // On macOS, check system preferences
    if (process.platform === 'darwin') {
      try {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        logger.debug('macOS microphone permission status:', { metadata: { status } });
        
        if (status === 'denied') {
          logger.warn('Microphone permission denied by macOS');
          this.services.notification.show(
            'Microphone Access Required',
            'Please enable microphone access in System Preferences > Security & Privacy > Privacy > Microphone',
            'error'
          );
          return false;
        } else if (status === 'restricted') {
          logger.warn('Microphone access restricted by macOS');
          this.services.notification.show(
            'Microphone Access Restricted',
            'Microphone access is restricted by system policy. Please contact your system administrator.',
            'error'
          );
          return false;
        } else if (status === 'not-determined') {
          logger.info('Requesting microphone permission from macOS...');
          const granted = await systemPreferences.askForMediaAccess('microphone');
          logger.info('Microphone permission request result:', { metadata: { granted } });
          
          if (!granted) {
            this.services.notification.show(
              'Microphone Access Denied',
              'Microphone access is required for recording. Please enable it in System Preferences.',
              'error'
            );
            return false;
          }
        }
      } catch (error) {
        logger.error('Error checking macOS microphone permissions:', { metadata: { error } });
        throw new Error(`Failed to check microphone permissions: ${error.message}`);
      }
    }
    
    // Test if we can actually access the microphone
    try {
      logger.debug('Testing microphone access...');
      const hasAccess = await this.testMicrophoneAccess(deviceId);
      
      if (!hasAccess) {
        logger.warn('Microphone test failed - no access to device');
        this.services.notification.show(
          'Microphone Not Available',
          'Could not access the microphone. Please check your connections and permissions.',
          'error'
        );
        return false;
      }
      
      logger.debug('Microphone permission check passed');
      return true;
    } catch (error) {
      logger.error('Error testing microphone access:', { metadata: { error } });
      throw error;
    }
  }

  /**
   * Tests microphone access by starting a short recording
   * @param {string} deviceId - Optional device ID to test
   * @returns {Promise<boolean>} - True if microphone is accessible
   */
  async testMicrophoneAccess(deviceId = null) {
    logger.debug('Testing microphone access...', { metadata: { deviceId } });
    
    return new Promise((resolve, reject) => {
      try {
        // Configure recording options
        const options = {
          sampleRate: 16000,
          channels: 1,
          audioType: 'raw'
        };
        
        if (deviceId) {
          options.device = deviceId;
        }
        
        logger.debug('Starting test recording with options:', { metadata: { options } });
        
        // Start a test recording
        const testRecorder = record.record(options);
        let dataReceived = false;
        let timeout = null;
        
        // Set a timeout to end the test after 1 second
        timeout = setTimeout(() => {
          logger.debug('Test recording timeout reached');
          testRecorder.stop();
          
          if (!dataReceived) {
            logger.warn('No audio data received during test recording');
          }
          
          resolve(dataReceived);
        }, 1000);
        
        // Listen for data events
        testRecorder.stream()
          .on('data', (data) => {
            if (!dataReceived) {
              logger.debug('Audio data received during test recording', { 
                metadata: { dataSize: data.length } 
              });
              dataReceived = true;
              
              // Stop the test early once we've confirmed data is flowing
              clearTimeout(timeout);
              testRecorder.stop();
              resolve(true);
            }
          })
          .on('error', (err) => {
            logger.error('Error during test recording:', { metadata: { error: err } });
            clearTimeout(timeout);
            testRecorder.stop();
            reject(err);
          });
      } catch (error) {
        logger.error('Failed to start test recording:', { metadata: { error } });
        reject(error);
      }
    });
  }

  /**
   * Sets the current recording device
   * @param {string} deviceId - The device ID to set
   * @returns {Promise<boolean>} - True if device was set successfully
   */
  async setDevice(deviceId) {
    logger.info('Setting recording device...', { metadata: { deviceId } });
    
    try {
      // Validate access to the device
      const hasAccess = await this.checkMicrophonePermission(deviceId);
      
      if (!hasAccess) {
        logger.warn('No access to requested device:', { metadata: { deviceId } });
        return false;
      }
      
      // Test the device
      const deviceWorks = await this.testMicrophoneAccess(deviceId);
      
      if (!deviceWorks) {
        logger.warn('Device test failed:', { metadata: { deviceId } });
        this.services.notification.show(
          'Microphone Test Failed',
          'Could not record audio with the selected microphone. Please try another device.',
          'error'
        );
        return false;
      }
      
      // Set the device
      this.currentDeviceId = deviceId;
      logger.info('Device set successfully:', { metadata: { deviceId } });
      return true;
    } catch (error) {
      logger.error('Error setting device:', { metadata: { error } });
      this.services.notification.show(
        'Microphone Error',
        error.message || 'Failed to set microphone device',
        'error'
      );
      return false;
    }
  }

  /**
   * Gets the current device ID
   * @returns {string|null} - The current device ID or null
   */
  getCurrentDeviceId() {
    return this.currentDeviceId;
  }
}

module.exports = MicrophoneManager; 