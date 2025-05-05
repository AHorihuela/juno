/**
 * TranscriptionService for real-time speech-to-text capabilities
 * 
 * This service:
 * - Coordinates the audio recording and transcription process
 * - Manages service lifecycle and initialization
 * - Emits events for transcription results
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');
const logger = require('../../logger');

// Import specialized modules
const TranscriptionEngine = require('./modules/TranscriptionEngine');
const RecordingManager = require('./modules/RecordingManager');
const CommandProcessor = require('./modules/CommandProcessor');
const NotificationManager = require('./modules/NotificationManager');

class TranscriptionService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.options = {
      recordingEnabled: true,
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      model: 'default', // or 'command_and_search', 'phone_call', etc.
      ...options
    };
    
    this.services = null;
    this.isRecording = false;
    this.recognitionActive = false;
    this.lastTranscription = '';
    this.currentSessionId = null;
    this.processingQueue = [];
    this.isProcessingQueue = false;
    this.cachedMicrophoneAccess = null;
    
    // Initialize sub-modules
    this.engine = new TranscriptionEngine();
    this.recordingManager = new RecordingManager();
    this.commandProcessor = new CommandProcessor();
    this.notificationManager = new NotificationManager();
  }
  
  /**
   * Initialize the service
   * @param {ServiceRegistry} services Service registry
   * @returns {Promise<void>}
   */
  async initialize(services) {
    if (this.initialized) {
      return;
    }
    
    logger.info('Initializing transcription service');
    this.services = services;
    
    try {
      // Load configuration
      const configService = services.get('config');
      if (configService) {
        const transcriptionConfig = await configService.getConfig('transcription') || {};
        
        // Update options from config
        if (transcriptionConfig.recordingEnabled !== undefined) {
          this.options.recordingEnabled = transcriptionConfig.recordingEnabled;
        }
        
        if (transcriptionConfig.language) {
          this.options.language = transcriptionConfig.language;
        }
        
        if (transcriptionConfig.model) {
          this.options.model = transcriptionConfig.model;
        }
        
        logger.debug(`Transcription service configured with language: ${this.options.language}, model: ${this.options.model}`);
      } else {
        logger.warn('Config service not available, using default transcription settings');
      }
      
      // Initialize sub-modules
      await Promise.all([
        this.engine.initialize(services, this.options),
        this.recordingManager.initialize(services),
        this.commandProcessor.initialize(services),
        this.notificationManager.initialize(services)
      ]);
      
      // Set up event listeners
      this._setupEventListeners();
      
      this.initialized = true;
      logger.info('Transcription service initialized successfully');
    } catch (error) {
      logger.error('Error initializing transcription service:', error);
      throw error;
    }
  }
  
  /**
   * Shutdown the service
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('Shutting down transcription service');
    
    try {
      await this.stopRecording();
      
      // Shutdown sub-modules
      await Promise.all([
        this.engine.shutdown(),
        this.recordingManager.shutdown(),
        this.commandProcessor.shutdown(),
        this.notificationManager.shutdown()
      ]);
      
      this.initialized = false;
      logger.info('Transcription service shutdown complete');
    } catch (error) {
      logger.error('Error shutting down transcription service:', error);
      throw error;
    }
  }
  
  /**
   * Set up event listeners for sub-modules
   * @private
   */
  _setupEventListeners() {
    // Handle engine events
    this.engine.on('transcription', (data) => {
      this.emit('transcription', data);
      this.processTranscription(data.text, data.isFinal);
    });
    
    this.engine.on('error', (error) => {
      logger.error('Transcription engine error:', error);
      this.notificationManager.showNotification(`Transcription error: ${error.message}`, 'error');
      this.emit('error', error);
    });
    
    // Handle recording manager events
    this.recordingManager.on('recording-started', (data) => {
      this.isRecording = true;
      this.currentSessionId = data.sessionId;
      this.emit('recording-started', data);
    });
    
    this.recordingManager.on('recording-stopped', () => {
      this.isRecording = false;
      this.emit('recording-stopped', { sessionId: this.currentSessionId });
    });
    
    // Handle command processor events
    this.commandProcessor.on('command-processed', (result) => {
      this.emit('command-processed', result);
    });
  }
  
  /**
   * Start recording and transcription
   * @returns {Promise<boolean>} Success status
   */
  async startRecording() {
    if (!this.initialized) {
      logger.error('Cannot start recording, transcription service not initialized');
      throw new Error('Transcription service not initialized');
    }
    
    if (this.isRecording) {
      logger.debug('Recording already in progress');
      return true;
    }
    
    try {
      // Quick log without blocking
      logger.info('Starting recording and transcription');
      
      // Generate a new session ID
      this.currentSessionId = `trans-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // OPTIMIZATION: Start recording IMMEDIATELY with minimal delay
      // This is the most important part to ensure first words aren't lost
      const recordingPromise = this.recordingManager.startRecording({
        sessionId: this.currentSessionId,
        preFillBuffer: true
      });
      
      // ONLY now that recording is underway, start the engine
      // This can happen concurrently with recording
      const enginePromise = this.engine.start(this.options);
      
      // Check microphone access later if needed - we're already recording
      if (!this.cachedMicrophoneAccess) {
        // Don't await this - we'll check after recording has started
        this.recordingManager.checkMicrophoneAccess()
          .then(result => this.cachedMicrophoneAccess = result)
          .catch(err => logger.error('Microphone access check failed:', err));
      }
      
      // Wait for recording confirmation and engine (first priority)
      const [result] = await Promise.all([
        recordingPromise,
        enginePromise.catch(err => {
          logger.error('Engine start error (non-blocking):', err);
          return false;
        })
      ]);
      
      // NOW play the start sound AFTER recording has successfully started
      // This ensures we don't delay the start of recording
      if (result) {
        // Play notification sound without blocking the main flow
        setTimeout(() => {
          // Play an audible confirmation that recording has started
          this.notificationManager.showNotification('Starting voice recognition', 'info', {
            audioFeedback: true,
            soundId: 'start-recording',
            visual: false // Only play sound, don't show visual notification
          });
          
          // Also show success notification after the sound
          setTimeout(() => {
            this.notificationManager.showNotification('Voice recognition active', 'info');
          }, 300); // Short delay after sound
        }, 0);
      }
      
      return result;
    } catch (error) {
      logger.error('Error starting recording:', error);
      this.notificationManager.showNotification(`Error starting voice recognition: ${error.message}`, 'error');
      return false;
    }
  }
  
  /**
   * Stop recording and transcription
   * @returns {Promise<boolean>} Success status
   */
  async stopRecording() {
    if (!this.isRecording) {
      return true;
    }
    
    try {
      logger.info('Stopping recording and transcription');
      
      // Stop the engine
      await this.engine.stop();
      
      // Stop the recording manager
      await this.recordingManager.stopRecording();
      
      // Play stop sound directly through the audio service if available
      try {
        const audioService = this.services.get('audio');
        if (audioService && typeof audioService.playStopSound === 'function') {
          logger.debug('Playing stop sound directly through audio service');
          await audioService.playStopSound();
        } else {
          // Fallback to notification manager for backward compatibility
          await this.notificationManager.showNotification('Stopping voice recognition', 'stop', {
            audioFeedback: true,
            soundId: 'stop-recording',
            visual: false  // Only play sound, don't show visual notification
          });
        }
      } catch (soundError) {
        logger.warn('Error playing stop sound:', soundError);
        // Continue even if sound fails
      }
      
      this.notificationManager.showNotification('Voice recognition stopped', 'info');
      
      return true;
    } catch (error) {
      logger.error('Error stopping recording:', error);
      return false;
    }
  }
  
  /**
   * Toggle recording state
   * @returns {Promise<boolean>} New recording state
   */
  async toggleRecording() {
    if (this.isRecording) {
      await this.stopRecording();
      return false;
    } else {
      await this.startRecording();
      return true;
    }
  }
  
  /**
   * Process transcribed text for commands
   * @param {string} text Transcribed text
   * @param {boolean} isFinal Whether this is a final transcription
   * @returns {Promise<Object>} Processing result
   */
  async processTranscription(text, isFinal = true) {
    if (!text || text === this.lastTranscription) {
      return { processed: false, reason: 'duplicate-or-empty' };
    }
    
    try {
      logger.debug(`Processing transcription: "${text}", isFinal: ${isFinal}`);
      
      // Save last transcription to avoid duplicates
      this.lastTranscription = text;
      
      // Only process commands for final transcriptions
      if (!isFinal) {
        return { processed: false, reason: 'not-final' };
      }
      
      // Add to processing queue
      this.processingQueue.push({ text, timestamp: Date.now() });
      
      // Start processing queue if not already processing
      if (!this.isProcessingQueue) {
        await this._processQueue();
      }
      
      return { processed: true };
    } catch (error) {
      logger.error('Error processing transcription:', error);
      return { processed: false, reason: 'error', error };
    }
  }
  
  /**
   * Process the queue of transcriptions
   * @returns {Promise<void>}
   * @private
   */
  async _processQueue() {
    if (this.isProcessingQueue || this.processingQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.processingQueue.length > 0) {
        const item = this.processingQueue.shift();
        
        // Process the transcription with the command processor
        await this.commandProcessor.processCommand(item.text);
      }
    } catch (error) {
      logger.error('Error processing transcription queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }
}

/**
 * Factory function for creating TranscriptionService instances
 * @param {Object} options Service options
 * @returns {TranscriptionService} Transcription service instance
 */
module.exports = (options = {}) => {
  return new TranscriptionService(options);
};

module.exports.TranscriptionService = TranscriptionService; 