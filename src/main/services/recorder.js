const { EventEmitter } = require('events');
const record = require('node-record-lpcm16');
const { systemPreferences } = require('electron');
const BaseService = require('./BaseService');

class RecorderService extends BaseService {
  constructor() {
    super('Recorder');
    this.recording = false;
    this.recorder = null;
    this.audioData = [];
    this.hasAudioContent = false;
    this.silenceThreshold = 50;
    this.currentDeviceId = null;
    this.levelSmoothingFactor = 0.3;
    this.currentLevels = [0, 0, 0, 0, 0];
  }

  async _initialize() {
    // Nothing to initialize yet
    console.log('RecorderService initialized');
  }

  async _shutdown() {
    if (this.recording) {
      await this.stop();
    }
  }

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
   * This is useful for detecting if microphones are available
   * @returns {Promise<boolean>} True if microphone access is available
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

  async setDevice(deviceId) {
    try {
      console.log('Setting device:', deviceId);
      
      // Check if we're currently recording
      const wasRecording = this.recording;
      if (wasRecording) {
        await this.stop();
      }

      // Validate device access
      await this.checkMicrophonePermission(deviceId);
      
      // Store the device ID
      this.currentDeviceId = deviceId;
      
      // Test the device by trying to open it
      try {
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
      
      // If we were recording, restart with new device
      if (wasRecording) {
        await this.start();
      }

      return true;
    } catch (error) {
      console.error('Error setting device:', error);
      this.getService('notification').showNotification(
        'Microphone Error',
        error.message,
        'error'
      );
      return false;
    }
  }

  async start() {
    if (this.recording) return;
    
    try {
      // Check microphone permission
      await this.checkMicrophonePermission(this.currentDeviceId);

      // Get the configured device ID
      if (!this.currentDeviceId) {
        this.currentDeviceId = await this.getService('config').getDefaultMicrophone() || 'default';
      }

      const recordingOptions = {
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw'
      };

      // Add device selection if not using default
      if (this.currentDeviceId && this.currentDeviceId !== 'default') {
        recordingOptions.device = this.currentDeviceId;
        console.log('Using specific device for recording:', this.currentDeviceId);
      } else {
        console.log('Using system default device for recording');
      }

      console.log('Starting recording with settings:', recordingOptions);
      
      // Reset audio data buffer and flags
      this.audioData = [];
      this.hasAudioContent = false;

      // Start tracking recording session in context service
      this.getService('context').startRecording();

      // Play start sound BEFORE starting the recorder
      try {
        console.log('Playing start sound before recording...');
        await this.getService('audio').playStartSound();
        console.log('Start sound completed, now starting recorder');
      } catch (soundError) {
        console.error('Error playing start sound:', soundError);
        // Continue with recording even if sound fails
      }

      // Initialize and start the recorder AFTER the sound has played
      this.recorder = record.record(recordingOptions);

      // Log audio data for testing
      this.recorder.stream()
        .on('data', (data) => {
          // Check audio levels
          const hasSound = this.checkAudioLevels(data);
          if (hasSound) {
            this.hasAudioContent = true;
          }

          this.audioData.push(data);
          this.emit('data', data);
          console.log('Audio data chunk received:', {
            chunkSize: data.length,
            totalSize: this.audioData.reduce((sum, chunk) => sum + chunk.length, 0),
            chunks: this.audioData.length,
            hasSound
          });
        })
        .on('error', (err) => {
          console.error('Recording error:', err);
          this.getService('notification').showNotification(
            'Recording Error',
            err.message || 'Failed to record audio',
            'error'
          );
          this.emit('error', err);
          this.stop();
        });

      this.recording = true;
      this.emit('start');
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      this.getService('notification').showNotification(
        'Recording Error',
        error.message || 'Failed to start recording',
        'error'
      );
      this.emit('error', error);
    }
  }

  checkAudioLevels(buffer) {
    // Convert buffer to 16-bit samples
    const samples = new Int16Array(buffer.buffer);
    
    // Calculate RMS (Root Mean Square) of the audio samples
    let sum = 0;
    let max = 0;
    let min = 0;
    let samplesAboveThreshold = 0;
    let consecutiveSamplesAboveThreshold = 0;
    let maxConsecutiveSamplesAboveThreshold = 0;
    let currentConsecutive = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.abs(samples[i]);
      sum += sample * sample;
      max = Math.max(max, sample);
      min = Math.min(min, sample);
      
      if (sample > this.silenceThreshold) {
        samplesAboveThreshold++;
        currentConsecutive++;
        maxConsecutiveSamplesAboveThreshold = Math.max(
          maxConsecutiveSamplesAboveThreshold,
          currentConsecutive
        );
      } else {
        currentConsecutive = 0;
      }
    }
    
    const rms = Math.sqrt(sum / samples.length);
    const normalizedLevel = Math.min(1, rms / 5000);
    
    // Update smoothed levels with some randomization for visual interest
    for (let i = 0; i < this.currentLevels.length; i++) {
      const targetLevel = normalizedLevel * (0.8 + Math.random() * 0.4);
      this.currentLevels[i] = this.currentLevels[i] * (1 - this.levelSmoothingFactor) +
                           targetLevel * this.levelSmoothingFactor;
    }

    // Send levels to overlay
    const windowManager = this.getService('windowManager');
    windowManager.updateOverlayAudioLevels(this.currentLevels);
    
    // Calculate percentage of samples above threshold
    const percentageAboveThreshold = (samplesAboveThreshold / samples.length) * 100;
    
    // Consider it real audio only if we have a significant percentage of samples above threshold
    // AND we have some consecutive samples above threshold (indicating sustained sound)
    return percentageAboveThreshold > 20 && maxConsecutiveSamplesAboveThreshold > 50;
  }

  async stop() {
    if (!this.recording) return;
    
    try {
      console.log('Stopping recording...');
      if (this.recorder) {
        this.recorder.stop();
        this.recorder = null;
      }
      this.recording = false;

      // Stop tracking recording session in context service
      this.getService('context').stopRecording();

      // Play stop sound
      await this.getService('audio').playStopSound();

      // Calculate final audio metrics
      const totalSamples = this.audioData.reduce((sum, chunk) => sum + chunk.length, 0);
      const samplesAboveThreshold = this.audioData.reduce((sum, chunk) => {
        const samples = new Int16Array(chunk.buffer);
        return sum + samples.filter(s => Math.abs(s) > this.silenceThreshold).length;
      }, 0);
      
      const percentageAboveThreshold = (samplesAboveThreshold / totalSamples) * 100;
      
      console.log('Final audio analysis:', {
        totalDuration: (totalSamples / 16000).toFixed(2) + 's',
        percentageAboveThreshold: Math.round(percentageAboveThreshold) + '%',
        totalChunks: this.audioData.length,
        hasAudioContent: this.hasAudioContent,
        averageRMS: Math.round(
          this.audioData.reduce((sum, chunk) => {
            const samples = new Int16Array(chunk.buffer);
            const rms = Math.sqrt(samples.reduce((s, sample) => s + sample * sample, 0) / samples.length);
            return sum + rms;
          }, 0) / this.audioData.length
        )
      });

      // Skip transcription if no real audio content detected
      if (!this.hasAudioContent) {
        console.log('No significant audio content detected, skipping transcription');
        this.getService('notification').showNoAudioDetected();
        this.emit('stop');
        return;
      }

      // Combine all audio data into a single buffer
      const completeAudioData = Buffer.concat(this.audioData);
      console.log('Complete audio data:', {
        totalSize: completeAudioData.length,
        chunks: this.audioData.length,
        hadAudioContent: this.hasAudioContent
      });
      
      // Get transcription
      try {
        console.log('Sending audio for transcription...');
        const transcription = await this.getService('transcription').transcribeAudio(completeAudioData);
        this.emit('transcription', transcription);
        console.log('Transcription received:', transcription);
      } catch (error) {
        console.error('Transcription error:', error);
        this.getService('notification').showTranscriptionError(error);
        this.emit('error', error);
      }

      this.emit('stop');
      console.log('Recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.getService('notification').showNotification(
        'Recording Error',
        error.message || 'Failed to stop recording',
        'error'
      );
      this.emit('error', error);
    }
  }

  isRecording() {
    return this.recording;
  }
}

// Export a factory function
module.exports = () => new RecorderService(); 