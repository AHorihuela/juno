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
      
      // OPTIMIZATION: Run permission check, microphone setup, start sound and UI updates in parallel
      const initPromises = [];
      
      // Check microphone permission (async)
      initPromises.push(
        (async () => {
          logger.debug('Checking microphone permission before recording...');
          await this.micManager.checkMicrophonePermission(selectedDeviceId);
        })()
      );
      
      // Play start sound (non-blocking)
      initPromises.push(
        this.getService('audio').playStartSound().catch(soundError => {
          logger.error('Error playing start sound:', { metadata: { error: soundError } });
          // Continue with recording even if sound fails
        })
      );
      
      // Start context tracking (async)
      initPromises.push(
        (async () => {
          try {
            logger.debug('Starting recording session in context service...');
            await this.getService('context').startRecording();
          } catch (error) {
            logger.error('Error in context service:', { metadata: { error } });
          }
        })()
      );
      
      // Show overlay (async)
      initPromises.push(
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
        })()
      );
      
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
        
        // CRITICAL FIX: Set up stream data event handlers
        const stream = this.recorder.stream();
        
        // Add data listener to collect audio chunks
        stream.on('data', (chunk) => {
          if (!this.recording || this.paused) return;
          
          // Process and analyze audio chunk
          this.audioData.push(chunk);
          
          // Run the audio analyzer on this chunk for speech detection
          const analysisResult = this.audioAnalyzer.analyzeChunk(chunk);
          
          // Log audio levels for debugging at verbose level
          logger.debug('Audio chunk received:', { 
            metadata: { 
              chunkSize: chunk.length,
              chunkNumber: this.audioData.length,
              rms: analysisResult.rms,
              hasSound: analysisResult.hasSound
            } 
          });
        });
        
        // Add error handler for stream errors
        stream.on('error', (error) => {
          logger.error('Recording stream error:', { metadata: { error } });
          this.getService('notification').showNotification(
            'Recording Error',
            'An error occurred during recording: ' + error.message,
            'error'
          );
          this.stop().catch(stopError => {
            logger.error('Error stopping recording after stream error:', { metadata: { error: stopError } });
          });
        });
        
      } catch (recorderError) {
        logger.error('Failed to create recorder instance:', { metadata: { error: recorderError } });
        throw new Error(`Failed to initialize recorder: ${recorderError.message}`);
      }
      
      // OPTIMIZATION: Handle background audio in parallel with other init tasks
      initPromises.push(
        (async () => {
          try {
            logger.debug('Handling background audio...');
            await this.backgroundAudio.pauseBackgroundAudio();
          } catch (error) {
            logger.error('Error handling background audio:', { metadata: { error } });
          }
        })()
      );
      
      // Wait for all initialization tasks to complete
      await Promise.all(initPromises);
      
      logger.info('Recording started successfully');
      
      // Update the overlay to show active state
      try {
        const overlayService = this.getService('overlay');
        if (overlayService) {
          overlayService.updateOverlayState('active');
          logger.debug('Overlay updated to active state after recording start');
        }
      } catch (error) {
        logger.error('Error updating overlay state after recording start:', { metadata: { error } });
      }
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

      // Only skip transcription if the recording is too short
      if (!hasMinimumDuration) {
        logger.info('Recording too short, skipping transcription', {
          metadata: {
            recordingDuration: recordingDuration.toFixed(2) + 's',
            minimumRequired: '1.5s'
          }
        });
        
        this.getService('notification').showNotification({
          title: 'Recording Too Short',
          body: 'Please record for at least 1.5 seconds.',
          type: 'info'
        });
        
        this.emit('stop');
        return;
      }
      
      // Show a notification if audio levels are low, but still attempt transcription
      if (!hasAudioContent || !hasRealSpeech) {
        logger.info('Low audio levels detected, but attempting transcription anyway', {
          metadata: {
            hasAudioContent,
            hasRealSpeech,
            averageRMS: audioAnalysis.averageRMS,
            peakRMS: audioAnalysis.peakRMS
          }
        });
        
        // Show notification but don't skip transcription
        const rmsValue = audioAnalysis.averageRMS;
        const peakRMSValue = audioAnalysis.peakRMS;
        this.getService('notification').showNotification(
          'Low Audio Detected',
          `Audio levels are low (Avg: ${rmsValue}, Peak: ${peakRMSValue}). Attempting transcription anyway.`,
          'info'
        );
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
          if (transcription) {
            this.emit('transcription', transcription);
            
            // Check if transcription is a string before using string methods
            const isString = typeof transcription === 'string';
            const transcriptionPreview = isString ? 
              `${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}` : 
              '[non-string result]';
            
            logger.info('Transcription received:', { 
              metadata: { 
                transcriptionLength: isString ? transcription.length : 'n/a',
                transcriptionPreview
              } 
            });
          } else {
            // Handle empty transcription (but don't treat as error)
            logger.warn('Empty transcription received');
            // No need to show error notification since TranscriptionService already handles this
          }
        })
        .catch(error => {
          // Only log as error and show notification if it's a real error
          logger.error('Transcription error:', { 
            metadata: { 
              error: error.message || 'Unknown error',
              stack: error.stack
            },
            system: {
              platform: process.platform,
              arch: process.arch,
              nodeVersion: process.version,
              memory: process.memoryUsage(),
              cpus: require('os').cpus().length
            }
          });
          
          // Check if this is a suppressed error that we shouldn't play sound for
          // This can be the case when text is in the clipboard but insertion failed
          const shouldSuppressErrorSound = error && 
            error.suppressErrorSound === true;
          
          // Only show error notification if we're not suppressing the error
          if (!shouldSuppressErrorSound) {
            this.getService('notification').showNotification(
              'Transcription Failed',
              error.message || 'Failed to transcribe audio',
              'error'
            );
          } else {
            // For suppressed errors, show a more helpful notification
            this.getService('notification').showNotification(
              'Manual Paste Required',
              'Text is in your clipboard. Press Cmd+V or Ctrl+V to paste.',
              'info'
            );
            logger.info('Error sound suppressed for clipboard fallback scenario');
          }
          
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