const { EventEmitter } = require('events');
const record = require('node-record-lpcm16');
const BaseService = require('../BaseService');
const MicrophoneManager = require('./MicrophoneManager');
const AudioLevelAnalyzer = require('./AudioLevelAnalyzer');
const BackgroundAudioController = require('./BackgroundAudioController');
const AudioRecording = require('./AudioRecording');
const RecorderUtilities = require('./RecorderUtilities');
const RecorderTranscription = require('./RecorderTranscription');
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
    this.audioRecording = new AudioRecording();
    this.audioMonitoring = false;
    this.monitorRecorder = null;
    
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
      this.transcriptionHandler = new RecorderTranscription(this);
      
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
    
    // Also stop audio monitoring if active
    if (this.audioMonitoring) {
      try {
        await this.stopAudioMonitoring();
        logger.info('Audio monitoring stopped during shutdown');
      } catch (error) {
        logger.error('Error stopping audio monitoring during shutdown:', { metadata: { error } });
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

  /**
   * Check if already recording and return early if so
   * @returns {boolean} - true if already recording
   */
  isAlreadyRecording() {
    if (this.recording) {
      logger.info('Already recording, ignoring start request');
      return true;
    }
    return false;
  }

  /**
   * Initialize recording state and setup
   * @param {string} deviceId - Optional device ID to use
   * @returns {Promise<void>}
   */
  async initializeRecording(deviceId) {
    // Reset recording state
    this.audioRecording.reset();
    this.audioAnalyzer.reset();
    
    // Use the specified device or default
    const selectedDeviceId = deviceId || this.micManager.getCurrentDeviceId();
    if (selectedDeviceId) {
      logger.info('Using selected device for recording:', { metadata: { deviceId: selectedDeviceId } });
    } else {
      logger.info('Using system default device for recording');
    }
    
    return selectedDeviceId;
  }

  /**
   * Setup and run initialization tasks in parallel
   * @param {string} selectedDeviceId - Device ID to use
   * @returns {Promise<void>}
   */
  async runInitializationTasks(selectedDeviceId) {
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
      (async () => {
        try {
          const audioService = this.getService('audio');
          // First, explicitly enable audio (important for our new audio control system)
          if (typeof audioService.enableAudio === 'function') {
            audioService.enableAudio();
            logger.info('Audio feedback explicitly enabled for recording start');
          }
          
          // Now play the start sound
          logger.debug('Playing start sound...');
          await audioService.playStartSound();
          logger.debug('Start sound completed');
        } catch (soundError) {
          logger.error('Error playing start sound:', { metadata: { error: soundError } });
          // Continue with recording even if sound fails
        }
      })()
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
  }

  /**
   * Setup the recorder instance and stream
   * @param {string} selectedDeviceId - Device ID to use
   * @returns {Promise<boolean>} - true if successful
   */
  async setupRecorder(selectedDeviceId) {
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
        this.audioRecording.addChunk(chunk);
        
        // Run the audio analyzer on this chunk for speech detection
        const analysisResult = this.audioAnalyzer.analyzeChunk(chunk);
        
        // Log audio levels for debugging at verbose level
        logger.debug('Audio chunk received:', { 
          metadata: { 
            chunkSize: chunk.length,
            chunkNumber: this.audioRecording.getChunkCount(),
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
      
      return true;
    } catch (recorderError) {
      logger.error('Failed to create recorder instance:', { metadata: { error: recorderError } });
      throw new Error(`Failed to initialize recorder: ${recorderError.message}`);
    }
  }

  /**
   * Finalize the recording startup
   * @returns {Promise<void>}
   */
  async finalizeStartup() {
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
  }

  /**
   * Start recording with the specified device
   * @param {string} deviceId - Optional device ID to use
   * @returns {Promise<void>}
   */
  async start(deviceId = null) {
    // Check if already recording
    if (this.isAlreadyRecording()) {
      return true;
    }
    
    logger.info('Starting audio recording...');
    
    try {
      // Step 1: Initialize recording state
      const selectedDeviceId = await this.initializeRecording(deviceId);
      
      // IMPORTANT: Keep monitoring active while setting up formal recording
      // Store monitored data to transfer to new recorder
      const wasMonitoring = this.audioMonitoring;
      
      // Step 2: Set up the recorder FIRST (highest priority)
      logger.debug('Setting up recorder (high priority)');
      const success = await this.setupRecorder(selectedDeviceId);
      if (!success) {
        logger.error('Failed to set up recorder');
        return false;
      }
      
      // Step 3: AFTER recorder is set up, we can safely stop monitoring
      if (wasMonitoring) {
        logger.debug('Transitioning from monitoring to full recording');
        if (this.monitorRecorder) {
          this.monitorRecorder.stop();
          this.monitorRecorder = null;
        }
        this.audioMonitoring = false;
      }
      
      // Step 4: Run initialization tasks in parallel (now less timing critical)
      await this.runInitializationTasks(selectedDeviceId);
      
      // Step 5: Complete startup
      return await this.finalizeStartup();
    } catch (error) {
      logger.error('Error starting recording:', { metadata: { error } });
      this.getService('notification').showNotification(
        'Recording Error',
        'Failed to start recording: ' + error.message,
        'error'
      );
      
      // Reset state
      this.shutdownRecorder();
      
      return false;
    }
  }

  /**
   * Shutdown recorder and cleanup
   * @returns {Promise<void>}
   */
  async shutdownRecorder() {
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
      
      // Get audio service
      const audioService = this.getService('audio');
      
      // First, explicitly enable audio to ensure sound plays
      if (audioService && typeof audioService.enableAudio === 'function') {
        audioService.enableAudio();
        logger.info('Audio feedback explicitly enabled for stop sound');
      }
      
      // Play the stop sound
      await audioService.playStopSound();
      logger.debug('Stop sound completed');
      
      // Disable Mac system sounds temporarily to prevent potential error sounds
      // This is a workaround for the system error sound that might be playing
      try {
        // Only on macOS
        if (process.platform === 'darwin') {
          // Use applescript to temporarily lower system sound volume
          const { exec } = require('child_process');
          exec('osascript -e "set volume alert volume 0"', (error) => {
            if (error) {
              logger.warn('Failed to lower system alert volume:', error);
            } else {
              logger.debug('Temporarily lowered system alert volume');
              
              // Restore system volume after 2 seconds
              setTimeout(() => {
                exec('osascript -e "set volume alert volume 5"', (restoreError) => {
                  if (restoreError) {
                    logger.warn('Failed to restore system alert volume:', restoreError);
                  } else {
                    logger.debug('Restored system alert volume');
                  }
                });
              }, 2000);
            }
          });
        }
      } catch (systemSoundError) {
        logger.warn('Error managing system sounds:', systemSoundError);
      }
    } catch (error) {
      logger.error('Error playing stop sound:', { metadata: { error } });
    }
  }

  /**
   * Analyze the recorded audio
   * @returns {Object} - Analysis results
   */
  analyzeRecordedAudio() {
    // Calculate recording duration
    const recordingDuration = this.audioRecording.getDurationSeconds();
    
    // Analyze the final audio content
    const audioAnalysis = this.audioAnalyzer.analyzeAudioContent(this.audioRecording.chunks);
    const hasRealSpeech = audioAnalysis.hasRealSpeech;
    const hasAudioContent = this.audioAnalyzer.hasDetectedAudioContent();
    
    // Check for minimum recording duration (at least 1.5 seconds)
    const hasMinimumDuration = recordingDuration >= 1.5;
    
    logger.info('Final audio analysis:', {
      metadata: {
        totalDuration: this.audioRecording.getAudioDurationEstimate(),
        recordingDuration: recordingDuration.toFixed(2) + 's',
        percentageAboveThreshold: Math.round(audioAnalysis.percentageAboveThreshold) + '%',
        totalChunks: this.audioRecording.getChunkCount(),
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

    return {
      recordingDuration,
      hasRealSpeech,
      hasAudioContent,
      hasMinimumDuration,
      audioAnalysis
    };
  }

  /**
   * Determine if recording should be processed
   * @param {Object} analysis - Audio analysis results
   * @returns {boolean} - true if should process
   */
  shouldProcessRecording(analysis) {
    // Only skip transcription if the recording is too short
    if (!analysis.hasMinimumDuration) {
      logger.info('Recording too short, skipping transcription', {
        metadata: {
          recordingDuration: analysis.recordingDuration.toFixed(2) + 's',
          minimumRequired: '1.5s'
        }
      });
      
      this.getService('notification').showNotification({
        title: 'Recording Too Short',
        body: 'Please record for at least 1.5 seconds.',
        type: 'info'
      });
      
      return false;
    }
    
    // Show a notification if audio levels are low, but still attempt transcription
    if (!analysis.hasAudioContent || !analysis.hasRealSpeech) {
      logger.info('Low audio levels detected, but attempting transcription anyway', {
        metadata: {
          hasAudioContent: analysis.hasAudioContent,
          hasRealSpeech: analysis.hasRealSpeech,
          averageRMS: analysis.audioAnalysis.averageRMS,
          peakRMS: analysis.audioAnalysis.peakRMS
        }
      });
      
      // Show notification but don't skip transcription
      const rmsValue = analysis.audioAnalysis.averageRMS;
      const peakRMSValue = analysis.audioAnalysis.peakRMS;
      this.getService('notification').showNotification(
        'Low Audio Detected',
        `Audio levels are low (Avg: ${rmsValue}, Peak: ${peakRMSValue}). Attempting transcription anyway.`,
        'info'
      );
    }

    return true;
  }

  /**
   * Process and transcribe audio data
   * @returns {Promise<void>}
   */
  async processAndTranscribeAudio() {
    // Combine all audio data into a single buffer
    const completeAudioData = this.audioRecording.getCombinedData();
    logger.info('Complete audio data prepared for transcription:', {
      metadata: {
        totalSize: completeAudioData.length,
        chunks: this.audioRecording.getChunkCount()
      }
    });
    
    // Start transcription process immediately without waiting for stop sound to complete
    logger.info('Sending audio for transcription...');
    
    // Create a function to handle emitting events
    const emitEvent = (event, data) => this.emit(event, data);
    
    // Get audio analysis results for context
    const analysisResult = {
      hasAudioContent: this.audioAnalyzer.hasDetectedAudioContent()
    };
    
    // Use the transcription handler
    try {
      await this.transcriptionHandler.transcribeAudio(completeAudioData, analysisResult, emitEvent);
    } catch (error) {
      logger.error('Error in transcription process:', { metadata: { error } });
    }
  }

  /**
   * Stop the current recording and process audio
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.recording) {
      logger.info('Not recording, ignoring stop request');
      return;
    }
    
    logger.info('Stopping recording...');
    try {
      // First, suppress macOS system sounds to prevent the error sound
      // at the end of recording, especially helpful if there will be transcription errors
      try {
        const notificationService = this.getService('notification');
        if (notificationService && typeof notificationService.suppressMacSystemSounds === 'function') {
          notificationService.suppressMacSystemSounds(5000); // 5 seconds should cover transcription time
          logger.debug('Suppressed macOS system sounds for recording stop');
        }
      } catch (soundError) {
        logger.warn('Error suppressing macOS system sounds:', soundError);
      }
      
      await this.shutdownRecorder();
      
      const audioAnalysis = this.analyzeRecordedAudio();
      
      if (this.shouldProcessRecording(audioAnalysis)) {
        await this.processAndTranscribeAudio();
      }
      
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
      this.audioRecording.startPause();
      
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
      this.audioRecording.endPause();
      
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
      this.audioRecording.reset();
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
  
  /**
   * Starts monitoring audio without formally recording
   * Used for pre-buffering to avoid missing the first words
   * @returns {Promise<boolean>} Success status
   */
  async startAudioMonitoring() {
    // If already recording or monitoring, do nothing
    if (this.recording || this.audioMonitoring) {
      return true;
    }
    
    logger.debug('Starting audio monitoring for pre-buffering');
    
    try {
      // We need a minimal recorder just for monitoring
      // This is a lightweight version of our start() method
      const deviceId = this.micManager.getCurrentDeviceId();
      
      // Create a lightweight recorder just for monitoring
      // This won't save to disk or start a formal recording session
      this.monitorRecorder = record.start({
        sampleRate: 16000,
        channels: 1,
        silence: false, // Don't auto-detect silence
        deviceId: deviceId,
        threshold: 0, // No threshold so we catch everything
        verbose: false
      });
      
      this.audioMonitoring = true;
      
      // Set up listeners that will emit audio-data events
      // These will be captured by the pre-buffer in RecordingManager
      this.monitorRecorder.on('data', (data) => {
        // Emit the data event without saving to disk
        this.emit('audio-data', data);
      });
      
      logger.debug('Audio monitoring started successfully');
      return true;
    } catch (error) {
      logger.error('Error starting audio monitoring:', { metadata: { error } });
      return false;
    }
  }
  
  /**
   * Stops audio monitoring if it's active
   * @returns {Promise<boolean>} Success status
   */
  async stopAudioMonitoring() {
    if (!this.audioMonitoring) {
      return true;
    }
    
    logger.debug('Stopping audio monitoring');
    
    try {
      // Close the monitor recorder
      if (this.monitorRecorder) {
        this.monitorRecorder.stop();
        this.monitorRecorder = null;
      }
      
      this.audioMonitoring = false;
      logger.debug('Audio monitoring stopped successfully');
      return true;
    } catch (error) {
      logger.error('Error stopping audio monitoring:', { metadata: { error } });
      return false;
    }
  }
}

module.exports = RecorderService; 