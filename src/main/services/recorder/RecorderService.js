const { EventEmitter } = require('events');
const record = require('node-record-lpcm16');
const BaseService = require('../BaseService');
const MicrophoneManager = require('./MicrophoneManager');
const AudioLevelAnalyzer = require('./AudioLevelAnalyzer');
const BackgroundAudioController = require('./BackgroundAudioController');

/**
 * Main service for handling audio recording functionality
 */
class RecorderService extends BaseService {
  constructor() {
    super('Recorder');
    this.recording = false;
    this.paused = false;
    this.recorder = null;
    this.audioData = [];
    this.recordingStartTime = null;
    this.totalPausedTime = 0;
    this.pauseStartTime = null;
    
    // Initialize sub-modules
    this.services = null; // Will be set in _initialize
  }

  async _initialize() {
    // Create a services object to pass to sub-modules
    this.services = {
      notification: this.getService('notification'),
      overlay: this.getService('overlay'),
      context: this.getService('context'),
      audio: this.getService('audio'),
      config: this.getService('config'),
      transcription: this.getService('transcription')
    };
    
    // Initialize sub-modules
    this.micManager = new MicrophoneManager(this.services);
    this.audioAnalyzer = new AudioLevelAnalyzer(this.services);
    this.backgroundAudio = new BackgroundAudioController(this.services);
    
    console.log('RecorderService initialized');
  }

  async _shutdown() {
    if (this.recording) {
      await this.stop();
    }
  }

  async checkMicrophonePermission(deviceId = null) {
    return this.micManager.checkMicrophonePermission(deviceId);
  }

  async testMicrophoneAccess() {
    return this.micManager.testMicrophoneAccess();
  }

  async setDevice(deviceId) {
    try {
      console.log('Setting device:', deviceId);
      
      // Check if we're currently recording
      const wasRecording = this.recording;
      if (wasRecording) {
        await this.stop();
      }

      // Set the device using the microphone manager
      const success = await this.micManager.setDevice(deviceId);
      
      // If we were recording, restart with new device
      if (wasRecording && success) {
        await this.start();
      }

      return success;
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

  async start(deviceId = null) {
    if (this.recording) return;
    
    try {
      // Reset recording state
      this.audioData = [];
      this.audioAnalyzer.reset();
      this.recordingStartTime = Date.now();
      this.totalPausedTime = 0;
      this.pauseStartTime = null;
      
      // Use the specified device or default
      const selectedDeviceId = deviceId || this.micManager.getCurrentDeviceId();
      if (selectedDeviceId) {
        console.log('Using selected device for recording:', selectedDeviceId);
      } else {
        console.log('Using system default device for recording');
      }
      
      // Check microphone permission
      await this.micManager.checkMicrophonePermission(selectedDeviceId);
      
      // Configure recording options
      const recordingOptions = {
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw'
      };
      
      if (selectedDeviceId) {
        recordingOptions.device = selectedDeviceId;
      }
      
      console.log('Starting recording with settings:', recordingOptions);
      
      // Start the recorder immediately to reduce latency
      this.recorder = record.record(recordingOptions);
      this.recording = true;
      
      // Perform these operations in parallel after recording has started
      Promise.all([
        // Start tracking recording session in context service
        this.getService('context').startRecording(),
        
        // Show the overlay
        (async () => {
          const overlayService = this.getService('overlay');
          if (overlayService) {
            overlayService.showOverlay();
            overlayService.setOverlayState('idle');
          }
        })(),
        
        // Handle background audio
        (async () => {
          const shouldPauseBackgroundAudio = await this.backgroundAudio.shouldPauseBackgroundAudio();
          if (shouldPauseBackgroundAudio) {
            this.backgroundAudio.pauseBackgroundAudio();
          }
        })(),
        
        // Play start sound in parallel with recording start
        (async () => {
          try {
            console.log('Playing start sound...');
            await this.getService('audio').playStartSound();
            console.log('Start sound completed');
          } catch (soundError) {
            console.error('Error playing start sound:', soundError);
            // Continue with recording even if sound fails
          }
        })()
      ]).catch(error => {
        console.error('Error in parallel operations:', error);
      });

      // Log audio data for testing
      this.recorder.stream()
        .on('data', (data) => {
          // Check audio levels
          const hasSound = this.audioAnalyzer.processBuffer(data, this.paused);
          
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

  async stop() {
    if (!this.recording) return;
    
    try {
      console.log('Stopping recording...');
      if (this.recorder) {
        this.recorder.stop();
        this.recorder = null;
      }
      this.recording = false;
      this.paused = false;

      // Resume background audio if it was paused
      this.backgroundAudio.resumeBackgroundAudio();

      // Stop tracking recording session in context service
      this.getService('context').stopRecording();

      // Hide the overlay
      const overlayService = this.getService('overlay');
      if (overlayService) {
        overlayService.hideOverlay();
      }

      // Play stop sound
      await this.getService('audio').playStopSound();

      // Calculate recording duration
      const recordingDuration = this.recordingStartTime ? 
        (Date.now() - this.recordingStartTime - this.totalPausedTime) / 1000 : 0;
      
      // Analyze the final audio content
      const audioAnalysis = this.audioAnalyzer.analyzeAudioContent(this.audioData);
      const hasRealSpeech = audioAnalysis.hasRealSpeech;
      const hasAudioContent = this.audioAnalyzer.hasDetectedAudioContent();
      
      // Check for minimum recording duration (at least 1.5 seconds)
      const hasMinimumDuration = recordingDuration >= 1.5;
      
      console.log('Final audio analysis:', {
        totalDuration: (this.audioData.reduce((sum, chunk) => sum + chunk.length, 0) / 16000).toFixed(2) + 's',
        recordingDuration: recordingDuration.toFixed(2) + 's',
        percentageAboveThreshold: Math.round(audioAnalysis.percentageAboveThreshold) + '%',
        totalChunks: this.audioData.length,
        hasAudioContent,
        averageRMS: audioAnalysis.averageRMS,
        peakRMS: audioAnalysis.peakRMS,
        hasRealSpeech,
        hasMinimumDuration,
        // Add more detailed diagnostics
        thresholds: {
          percentageThreshold: '10%', // Should match the value in AudioLevelAnalyzer
          rmsThreshold: 100, // Updated to match the value in AudioLevelAnalyzer
          peakRMSThreshold: 300 // New peak RMS threshold
        },
        audioDetails: {
          silenceThreshold: this.audioAnalyzer.silenceThreshold,
          maxRMS: audioAnalysis.averageRMS
        }
      });

      // Skip transcription if no real audio content detected or recording is too short
      if (!hasAudioContent || !hasRealSpeech || !hasMinimumDuration) {
        console.log('No significant audio content detected or recording too short, skipping transcription');
        
        // Show different messages based on the issue
        if (!hasMinimumDuration) {
          this.getService('notification').showNotification({
            title: 'Recording Too Short',
            body: 'Please record for at least 1.5 seconds.',
            type: 'info'
          });
        } else {
          // Enhanced notification with more details
          const percentageValue = Math.round(audioAnalysis.percentageAboveThreshold);
          const rmsValue = audioAnalysis.averageRMS;
          const peakRMSValue = audioAnalysis.peakRMS;
          this.getService('notification').showNotification(
            'No Audio Detected',
            `No speech was detected (Avg RMS: ${rmsValue}, Peak RMS: ${peakRMSValue}). Try speaking louder or adjusting your microphone.`,
            'info'
          );
        }
        
        this.emit('stop');
        return;
      }

      // Combine all audio data into a single buffer
      const completeAudioData = Buffer.concat(this.audioData);
      console.log('Complete audio data:', {
        totalSize: completeAudioData.length,
        chunks: this.audioData.length,
        hadAudioContent: hasAudioContent
      });
      
      // Start transcription process immediately without waiting for stop sound to complete
      console.log('Sending audio for transcription...');
      this.getService('transcription').transcribeAudio(completeAudioData)
        .then(transcription => {
          this.emit('transcription', transcription);
          console.log('Transcription received:', transcription);
        })
        .catch(error => {
          console.error('Transcription error:', error);
          this.getService('notification').showTranscriptionError(error);
          this.emit('error', error);
        });

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

  async pause() {
    if (!this.recording || this.paused) return;
    
    console.log('Pausing recording');
    this.paused = true;
    this.pauseStartTime = Date.now();
    
    if (this.recorder) {
      // Stop the recorder temporarily
      this.recorder.pause();
    }
    
    // Update the overlay to show paused state
    const overlayService = this.getService('overlay');
    if (overlayService) {
      overlayService.updateOverlayState('paused');
    }
    
    // Note: We intentionally don't resume background audio when pausing
    // the recording, as we want to keep it paused until recording is stopped
    
    // Emit pause event
    this.emit('paused');
  }
  
  async resume() {
    if (!this.recording || !this.paused) return;
    
    console.log('Resuming recording');
    this.paused = false;
    
    // Calculate total paused time
    if (this.pauseStartTime) {
      this.totalPausedTime += (Date.now() - this.pauseStartTime);
      this.pauseStartTime = null;
    }
    
    if (this.recorder) {
      // Resume the recorder
      this.recorder.resume();
    }
    
    // Update the overlay to show active state
    const overlayService = this.getService('overlay');
    if (overlayService) {
      overlayService.updateOverlayState('active');
    }
    
    // Emit resume event
    this.emit('resumed');
  }

  async cancel() {
    if (!this.recording) return;
    
    console.log('Cancelling recording');
    this.recording = false;
    this.paused = false;
    
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }
    
    // Resume background audio if it was paused
    this.backgroundAudio.resumeBackgroundAudio();
    
    // Clear the audio data without saving
    this.audioData = [];
    this.audioAnalyzer.reset();
    
    // Hide the overlay
    const overlayService = this.getService('overlay');
    if (overlayService) {
      overlayService.hideOverlay();
    }
    
    // Emit cancel event
    this.emit('cancelled');
    
    // Update context service
    this.getService('context').cancelRecording();
  }

  isRecording() {
    return this.recording;
  }
}

module.exports = RecorderService; 