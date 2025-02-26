const { EventEmitter } = require('events');
const record = require('node-record-lpcm16');
const BaseService = require('../BaseService');
const MicrophoneManager = require('./MicrophoneManager');
const AudioLevelAnalyzer = require('./AudioLevelAnalyzer');
const BackgroundAudioController = require('./BackgroundAudioController');
const LogManager = require('../../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('RecorderService');

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
    logger.info('Initializing RecorderService...');
    
    // Create a services object to pass to sub-modules
    this.services = {
      notification: this.getService('notification'),
      overlay: this.getService('overlay'),
      context: this.getService('context'),
      audio: this.getService('audio'),
      config: this.getService('config'),
      transcription: this.getService('transcription')
    };
    
    // Log available services
    logger.debug('Services available to RecorderService:', { 
      metadata: { 
        services: Object.keys(this.services).filter(key => !!this.services[key])
      } 
    });
    
    // Initialize sub-modules
    try {
      this.micManager = new MicrophoneManager(this.services);
      this.audioAnalyzer = new AudioLevelAnalyzer(this.services);
      this.backgroundAudio = new BackgroundAudioController(this.services);
      
      logger.info('RecorderService initialized successfully');
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize RecorderService:', { metadata: { error } });
      throw error;
    }
  }

  async _shutdown() {
    logger.info('Shutting down RecorderService...');
    if (this.recording) {
      try {
        await this.stop();
        logger.info('Recording stopped during shutdown');
      } catch (error) {
        logger.error('Error stopping recording during shutdown:', { metadata: { error } });
      }
    }
    logger.info('RecorderService shutdown complete');
  }

  async checkMicrophonePermission(deviceId = null) {
    logger.debug('Checking microphone permission...', { metadata: { deviceId } });
    try {
      const result = await this.micManager.checkMicrophonePermission(deviceId);
      logger.debug('Microphone permission check result:', { metadata: { result } });
      return result;
    } catch (error) {
      logger.error('Error checking microphone permission:', { metadata: { error } });
      throw error;
    }
  }

  async testMicrophoneAccess() {
    logger.debug('Testing microphone access...');
    try {
      const result = await this.micManager.testMicrophoneAccess();
      logger.debug('Microphone access test result:', { metadata: { result } });
      return result;
    } catch (error) {
      logger.error('Error testing microphone access:', { metadata: { error } });
      throw error;
    }
  }

  async setDevice(deviceId) {
    logger.info('Setting recording device...', { metadata: { deviceId } });
    
    try {
      // Check if we're currently recording
      const wasRecording = this.recording;
      if (wasRecording) {
        logger.info('Stopping current recording before changing device');
        await this.stop();
      }

      // Set the device using the microphone manager
      logger.debug('Calling micManager.setDevice...');
      const success = await this.micManager.setDevice(deviceId);
      logger.debug('Device set result:', { metadata: { success } });
      
      // If we were recording, restart with new device
      if (wasRecording && success) {
        logger.info('Restarting recording with new device');
        await this.start();
      }

      return success;
    } catch (error) {
      logger.error('Error setting device:', { metadata: { error } });
      this.getService('notification').showNotification(
        'Microphone Error',
        error.message,
        'error'
      );
      return false;
    }
  }

  async start(deviceId = null) {
    if (this.recording) {
      logger.info('Already recording, ignoring start request');
      return;
    }
    
    logger.info('Starting recording...');
    
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
        logger.info('Using selected device for recording:', { metadata: { deviceId: selectedDeviceId } });
      } else {
        logger.info('Using system default device for recording');
      }
      
      // Check microphone permission
      logger.debug('Checking microphone permission before recording...');
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
      
      logger.debug('Starting recording with settings:', { metadata: { recordingOptions } });
      
      // Start the recorder immediately to reduce latency
      try {
        this.recorder = record.record(recordingOptions);
        this.recording = true;
        logger.debug('Recorder instance created successfully');
      } catch (recorderError) {
        logger.error('Failed to create recorder instance:', { metadata: { error: recorderError } });
        throw new Error(`Failed to initialize recorder: ${recorderError.message}`);
      }
      
      // Perform these operations in parallel after recording has started
      Promise.all([
        // Start tracking recording session in context service
        (async () => {
          try {
            logger.debug('Starting recording session in context service...');
            await this.getService('context').startRecording();
          } catch (error) {
            logger.error('Error in context service:', { metadata: { error } });
          }
        })(),
        
        // Show the overlay
        (async () => {
          try {
            logger.debug('Showing overlay...');
            const overlayService = this.getService('overlay');
            if (overlayService) {
              overlayService.showOverlay();
              overlayService.setOverlayState('idle');
              logger.debug('Overlay shown successfully');
            } else {
              logger.warn('Overlay service not available');
            }
          } catch (error) {
            logger.error('Error showing overlay:', { metadata: { error } });
          }
        })(),
        
        // Handle background audio
        (async () => {
          try {
            logger.debug('Handling background audio...');
            const shouldPauseBackgroundAudio = await this.backgroundAudio.shouldPauseBackgroundAudio();
            if (shouldPauseBackgroundAudio) {
              this.backgroundAudio.pauseBackgroundAudio();
              logger.debug('Background audio paused');
            }
          } catch (error) {
            logger.error('Error handling background audio:', { metadata: { error } });
          }
        })(),
        
        // Play start sound in parallel with recording start
        (async () => {
          try {
            logger.debug('Playing start sound...');
            await this.getService('audio').playStartSound();
            logger.debug('Start sound completed');
          } catch (soundError) {
            logger.error('Error playing start sound:', { metadata: { error: soundError } });
            // Continue with recording even if sound fails
          }
        })()
      ]).catch(error => {
        logger.error('Error in parallel operations:', { metadata: { error } });
      });

      // Log audio data for testing
      this.recorder.stream()
        .on('data', (data) => {
          try {
            // Check audio levels
            const hasSound = this.audioAnalyzer.processBuffer(data, this.paused);
            
            this.audioData.push(data);
            this.emit('data', data);
            
            // Only log occasionally to avoid flooding logs
            if (this.audioData.length % 10 === 0) {
              logger.debug('Audio data received:', {
                metadata: {
                  chunkSize: data.length,
                  totalSize: this.audioData.reduce((sum, chunk) => sum + chunk.length, 0),
                  chunks: this.audioData.length,
                  hasSound
                }
              });
            }
          } catch (error) {
            logger.error('Error processing audio data:', { metadata: { error } });
          }
        })
        .on('error', (err) => {
          logger.error('Recording error:', { metadata: { error: err } });
          this.getService('notification').showNotification(
            'Recording Error',
            err.message || 'Failed to record audio',
            'error'
          );
          this.emit('error', err);
          this.stop();
        });

      this.emit('start');
      logger.info('Recording started successfully');
    } catch (error) {
      logger.error('Error starting recording:', { metadata: { error } });
      this.getService('notification').showNotification(
        'Recording Error',
        error.message || 'Failed to start recording',
        'error'
      );
      this.emit('error', error);
      
      // Reset recording state on error
      this.recording = false;
      this.recorder = null;
    }
  }

  async stop() {
    if (!this.recording) {
      logger.info('Not recording, ignoring stop request');
      return;
    }
    
    logger.info('Stopping recording...');
    try {
      if (this.recorder) {
        this.recorder.stop();
        this.recorder = null;
        logger.debug('Recorder instance stopped');
      }
      this.recording = false;
      this.paused = false;

      // Resume background audio if it was paused
      try {
        logger.debug('Resuming background audio...');
        this.backgroundAudio.resumeBackgroundAudio();
      } catch (error) {
        logger.error('Error resuming background audio:', { metadata: { error } });
      }

      // Stop tracking recording session in context service
      try {
        logger.debug('Stopping recording session in context service...');
        this.getService('context').stopRecording();
      } catch (error) {
        logger.error('Error stopping recording in context service:', { metadata: { error } });
      }

      // Hide the overlay
      try {
        logger.debug('Hiding overlay...');
        const overlayService = this.getService('overlay');
        if (overlayService) {
          overlayService.hideOverlay();
          logger.debug('Overlay hidden successfully');
        }
      } catch (error) {
        logger.error('Error hiding overlay:', { metadata: { error } });
      }

      // Play stop sound
      try {
        logger.debug('Playing stop sound...');
        await this.getService('audio').playStopSound();
        logger.debug('Stop sound completed');
      } catch (error) {
        logger.error('Error playing stop sound:', { metadata: { error } });
      }

      // Calculate recording duration
      const recordingDuration = this.recordingStartTime ? 
        (Date.now() - this.recordingStartTime - this.totalPausedTime) / 1000 : 0;
      
      // Analyze the final audio content
      const audioAnalysis = this.audioAnalyzer.analyzeAudioContent(this.audioData);
      const hasRealSpeech = audioAnalysis.hasRealSpeech;
      const hasAudioContent = this.audioAnalyzer.hasDetectedAudioContent();
      
      // Check for minimum recording duration (at least 1.5 seconds)
      const hasMinimumDuration = recordingDuration >= 1.5;
      
      logger.info('Final audio analysis:', {
        metadata: {
          totalDuration: (this.audioData.reduce((sum, chunk) => sum + chunk.length, 0) / 16000).toFixed(2) + 's',
          recordingDuration: recordingDuration.toFixed(2) + 's',
          percentageAboveThreshold: Math.round(audioAnalysis.percentageAboveThreshold) + '%',
          totalChunks: this.audioData.length,
          hasAudioContent,
          averageRMS: audioAnalysis.averageRMS,
          peakRMS: audioAnalysis.peakRMS,
          hasRealSpeech,
          hasMinimumDuration,
          thresholds: {
            percentageThreshold: '10%',
            rmsThreshold: 100,
            peakRMSThreshold: 300
          }
        }
      });

      // Skip transcription if no real audio content detected or recording is too short
      if (!hasAudioContent || !hasRealSpeech || !hasMinimumDuration) {
        logger.info('No significant audio content detected or recording too short, skipping transcription', {
          metadata: {
            hasAudioContent,
            hasRealSpeech,
            hasMinimumDuration
          }
        });
        
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
      logger.info('Complete audio data prepared for transcription:', {
        metadata: {
          totalSize: completeAudioData.length,
          chunks: this.audioData.length,
          hadAudioContent: hasAudioContent
        }
      });
      
      // Start transcription process immediately without waiting for stop sound to complete
      logger.info('Sending audio for transcription...');
      this.getService('transcription').transcribeAudio(completeAudioData)
        .then(transcription => {
          this.emit('transcription', transcription);
          logger.info('Transcription received:', { 
            metadata: { 
              transcriptionLength: transcription ? transcription.length : 0,
              transcriptionPreview: transcription ? transcription.substring(0, 50) + '...' : 'None'
            } 
          });
        })
        .catch(error => {
          logger.error('Transcription error:', { metadata: { error } });
          this.getService('notification').showTranscriptionError(error);
          this.emit('error', error);
        });

      this.emit('stop');
      logger.info('Recording stopped successfully');
    } catch (error) {
      logger.error('Failed to stop recording:', { metadata: { error } });
      this.getService('notification').showNotification(
        'Recording Error',
        error.message || 'Failed to stop recording',
        'error'
      );
      this.emit('error', error);
      
      // Reset recording state on error
      this.recording = false;
      this.recorder = null;
    }
  }

  async pause() {
    if (!this.recording || this.paused) {
      logger.info('Cannot pause: not recording or already paused');
      return;
    }
    
    logger.info('Pausing recording');
    try {
      this.paused = true;
      this.pauseStartTime = Date.now();
      
      if (this.recorder) {
        // Stop the recorder temporarily
        this.recorder.pause();
        logger.debug('Recorder paused');
      }
      
      // Update the overlay to show paused state
      try {
        const overlayService = this.getService('overlay');
        if (overlayService) {
          overlayService.updateOverlayState('paused');
          logger.debug('Overlay updated to paused state');
        }
      } catch (error) {
        logger.error('Error updating overlay for pause:', { metadata: { error } });
      }
      
      // Emit pause event
      this.emit('paused');
      logger.info('Recording paused successfully');
    } catch (error) {
      logger.error('Error pausing recording:', { metadata: { error } });
      this.paused = false;
      this.pauseStartTime = null;
    }
  }
  
  async resume() {
    if (!this.recording || !this.paused) {
      logger.info('Cannot resume: not recording or not paused');
      return;
    }
    
    logger.info('Resuming recording');
    try {
      this.paused = false;
      
      // Calculate total paused time
      if (this.pauseStartTime) {
        this.totalPausedTime += (Date.now() - this.pauseStartTime);
        this.pauseStartTime = null;
        logger.debug('Updated total paused time:', { metadata: { totalPausedTime: this.totalPausedTime } });
      }
      
      if (this.recorder) {
        // Resume the recorder
        this.recorder.resume();
        logger.debug('Recorder resumed');
      }
      
      // Update the overlay to show active state
      try {
        const overlayService = this.getService('overlay');
        if (overlayService) {
          overlayService.updateOverlayState('active');
          logger.debug('Overlay updated to active state');
        }
      } catch (error) {
        logger.error('Error updating overlay for resume:', { metadata: { error } });
      }
      
      // Emit resume event
      this.emit('resumed');
      logger.info('Recording resumed successfully');
    } catch (error) {
      logger.error('Error resuming recording:', { metadata: { error } });
    }
  }

  async cancel() {
    if (!this.recording) {
      logger.info('Not recording, ignoring cancel request');
      return;
    }
    
    logger.info('Cancelling recording');
    try {
      this.recording = false;
      this.paused = false;
      
      if (this.recorder) {
        this.recorder.stop();
        this.recorder = null;
        logger.debug('Recorder stopped for cancellation');
      }
      
      // Resume background audio if it was paused
      try {
        logger.debug('Resuming background audio after cancellation...');
        this.backgroundAudio.resumeBackgroundAudio();
      } catch (error) {
        logger.error('Error resuming background audio after cancellation:', { metadata: { error } });
      }
      
      // Clear the audio data without saving
      this.audioData = [];
      this.audioAnalyzer.reset();
      logger.debug('Audio data cleared and analyzer reset');
      
      // Hide the overlay
      try {
        logger.debug('Hiding overlay after cancellation...');
        const overlayService = this.getService('overlay');
        if (overlayService) {
          overlayService.hideOverlay();
          logger.debug('Overlay hidden successfully');
        }
      } catch (error) {
        logger.error('Error hiding overlay after cancellation:', { metadata: { error } });
      }
      
      // Update context service
      try {
        logger.debug('Cancelling recording in context service...');
        this.getService('context').cancelRecording();
      } catch (error) {
        logger.error('Error cancelling recording in context service:', { metadata: { error } });
      }
      
      // Emit cancel event
      this.emit('cancelled');
      logger.info('Recording cancelled successfully');
    } catch (error) {
      logger.error('Error cancelling recording:', { metadata: { error } });
    }
  }

  isRecording() {
    return this.recording;
  }
}

module.exports = RecorderService; 