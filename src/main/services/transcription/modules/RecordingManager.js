/**
 * RecordingManager - Handles microphone access and audio recording
 * 
 * This module:
 * - Checks for microphone permissions
 * - Manages audio recording sessions
 * - Handles start/stop of recording
 */

const { EventEmitter } = require('events');
const logger = require('../../../logger');
const SilenceDetector = require('../util/SilenceDetector');
const AudioBufferManager = require('../util/AudioBufferManager');

class RecordingManager extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.isRecording = false;
    this.currentSessionId = null;
    this.services = null;
    this.audioService = null;
    this.recorderService = null;
    
    // Audio processing utilities
    this.silenceDetector = new SilenceDetector({
      silenceThreshold: 0.05,
      silenceDuration: 750,
      minSpeechDuration: 500
    });
    
    this.audioBufferManager = new AudioBufferManager();
    
    // Background processing state
    this.backgroundProcessing = false;
    this.lastProcessedChunkTime = 0;
    this.processingInterval = null;
  }

  /**
   * Initialize the recording manager
   * @param {ServiceRegistry} services Service registry
   * @returns {Promise<void>}
   */
  async initialize(services) {
    if (this.initialized) {
      return;
    }

    logger.debug('Initializing recording manager');
    this.services = services;

    try {
      // Try to get audio and recorder services
      this.audioService = services.get('audio');
      this.recorderService = services.get('recorder');
      
      // Set up event listeners for recorder service
      if (this.recorderService) {
        // Listen for audio data events to collect in our buffer manager
        this.recorderService.on('audio-data', this._handleAudioData.bind(this));
        
        // Listen for analysis events that can help detect speech
        this.recorderService.on('audio-analysis', this._handleAudioAnalysis.bind(this));
      }
      
      this.initialized = true;
      logger.debug('Recording manager initialized successfully');
    } catch (error) {
      logger.error('Error initializing recording manager:', error);
      throw error;
    }
  }

  /**
   * Shutdown the recording manager
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.debug('Shutting down recording manager');

    try {
      // Stop any ongoing recording
      if (this.isRecording) {
        await this.stopRecording();
      }
      
      // Clean up background processing
      this._stopBackgroundProcessing();

      this.initialized = false;
      logger.debug('Recording manager shutdown complete');
    } catch (error) {
      logger.error('Error shutting down recording manager:', error);
    }
  }

  /**
   * Check if the application has microphone access
   * @returns {Promise<boolean>} Whether microphone access is granted
   */
  async checkMicrophoneAccess() {
    try {
      logger.debug('Checking microphone access');
      
      // If we have a recorder service, use it to check permissions
      if (this.recorderService && typeof this.recorderService.checkMicrophonePermission === 'function') {
        return await this.recorderService.checkMicrophonePermission();
      }
      
      // Fall back to platform-specific implementation
      return await this._platformCheckMicrophoneAccess();
    } catch (error) {
      logger.error('Error checking microphone access:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   * @param {Object} options Recording options
   * @returns {Promise<boolean>} Success status
   */
  async startRecording(options = {}) {
    if (!this.initialized) {
      throw new Error('Recording manager not initialized');
    }

    if (this.isRecording) {
      logger.debug('Recording already in progress');
      return true;
    }

    try {
      logger.debug('Starting audio recording');
      
      // Reset audio processing utilities
      this.silenceDetector.reset();
      this.audioBufferManager.reset();
      
      // Set session ID
      this.currentSessionId = options.sessionId || `recording-${Date.now()}`;
      
      // Start recording with the recorder service if available
      if (this.recorderService && typeof this.recorderService.startRecording === 'function') {
        await this.recorderService.startRecording();
      }
      
      this.isRecording = true;
      
      // Start background processing
      this._startBackgroundProcessing();
      
      // Emit recording started event
      this.emit('recording-started', { 
        sessionId: this.currentSessionId,
        timestamp: Date.now() 
      });
      
      logger.debug('Audio recording started successfully');
      return true;
    } catch (error) {
      logger.error('Error starting audio recording:', error);
      return false;
    }
  }

  /**
   * Stop recording audio
   * @returns {Promise<boolean>} Success status
   */
  async stopRecording() {
    if (!this.isRecording) {
      return true;
    }

    try {
      logger.debug('Stopping audio recording');
      
      // Stop background processing
      this._stopBackgroundProcessing();
      
      // Stop recording with the recorder service if available
      if (this.recorderService && typeof this.recorderService.stopRecording === 'function') {
        await this.recorderService.stopRecording();
      }
      
      this.isRecording = false;
      
      // Emit recording stopped event
      this.emit('recording-stopped', { 
        sessionId: this.currentSessionId,
        timestamp: Date.now(),
        audioData: this.audioBufferManager.getAllAudioData()
      });
      
      logger.debug('Audio recording stopped successfully');
      return true;
    } catch (error) {
      logger.error('Error stopping audio recording:', error);
      this.isRecording = false; // Force state to stopped even on error
      return false;
    }
  }
  
  /**
   * Handle incoming audio data
   * @param {Buffer} audioData Raw audio buffer from recorder
   * @private
   */
  _handleAudioData(audioData) {
    if (!this.isRecording || !audioData) {
      return;
    }
    
    // Add to buffer manager
    this.audioBufferManager.addBuffer(audioData);
    
    // Process for silence detection
    const speechEnded = this.silenceDetector.processAudio(audioData);
    
    // If we detect speech has ended, emit an event
    if (speechEnded) {
      logger.debug('Speech end detected by silence detector');
      this.emit('speech-ended', {
        timestamp: Date.now(),
        audioDuration: this.audioBufferManager.getEstimatedDuration()
      });
    }
  }
  
  /**
   * Handle audio analysis data
   * @param {Object} analysisData Analysis data from recorder
   * @private
   */
  _handleAudioAnalysis(analysisData) {
    // Use analysis data to improve silence detection if needed
  }
  
  /**
   * Start background processing of audio
   * @private
   */
  _startBackgroundProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Check every 500ms for new audio to process
    this.processingInterval = setInterval(() => {
      this._processAudioInBackground();
    }, 500);
    
    logger.debug('Background audio processing started');
  }
  
  /**
   * Stop background processing
   * @private
   */
  _stopBackgroundProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Ensure background processing flag is reset
    this.backgroundProcessing = false;
    
    logger.debug('Background audio processing stopped');
  }
  
  /**
   * Process audio in the background
   * @private
   */
  async _processAudioInBackground() {
    // Skip if we're already processing or not recording
    if (this.backgroundProcessing || !this.isRecording) {
      return;
    }
    
    // Check if we have enough new data to process
    if (!this.audioBufferManager.hasEnoughNewDataToProcess()) {
      return;
    }
    
    try {
      this.backgroundProcessing = true;
      
      // Get current buffer for processing
      const audioBuffer = this.audioBufferManager.getCombinedBuffer();
      
      if (audioBuffer.length > 0) {
        logger.debug(`Processing ${audioBuffer.length} bytes of audio in background`);
        
        // Mark these buffers as processed
        this.audioBufferManager.markCurrentBuffersAsProcessed();
        
        // Emit event for background processing
        this.emit('background-processing', {
          timestamp: Date.now(),
          audioBuffer,
          duration: this.audioBufferManager.getEstimatedDuration()
        });
        
        this.lastProcessedChunkTime = Date.now();
      }
    } catch (error) {
      logger.error('Error in background audio processing:', error);
    } finally {
      this.backgroundProcessing = false;
    }
  }

  /**
   * Platform-specific implementation of microphone access check
   * @returns {Promise<boolean>} Whether microphone access is granted
   * @private
   */
  async _platformCheckMicrophoneAccess() {
    // This needs to be customized based on the platform (Electron, Web, etc.)
    // For now, we'll return a default value
    
    // On Electron, we could use systemPreferences.getMediaAccessStatus('microphone')
    // On the web, we could use navigator.mediaDevices.getUserMedia
    
    logger.debug('Using platform-specific microphone access check');
    
    try {
      // Example implementation for Electron
      const { systemPreferences } = require('electron');
      
      if (systemPreferences && typeof systemPreferences.getMediaAccessStatus === 'function') {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        logger.debug(`Microphone access status: ${status}`);
        return status === 'granted';
      }
      
      // Example implementation for Web
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Clean up the stream
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          
          return true;
        } catch (err) {
          logger.warn('Error accessing microphone:', err);
          return false;
        }
      }
      
      // If we can't check, assume we have access for now
      logger.warn('Unable to check microphone access, assuming granted');
      return true;
    } catch (error) {
      logger.error('Error in platform-specific microphone check:', error);
      return false;
    }
  }
}

module.exports = RecordingManager; 