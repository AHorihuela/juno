/**
 * TranscriptionEngine - Handles speech-to-text engine functionality
 * 
 * This module:
 * - Initializes and manages the speech recognition engine
 * - Handles raw transcription events
 * - Emits processed transcription results
 */

const { EventEmitter } = require('events');
const path = require('path');
const logger = require('../../../logger');

class TranscriptionEngine extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.recognitionActive = false;
    this.engine = null;
    this.options = {};
    this.services = null;
    this._mockTranscriptionInterval = null;
  }

  /**
   * Initialize the engine
   * @param {ServiceRegistry} services Service registry
   * @param {Object} options Engine options
   * @returns {Promise<void>}
   */
  async initialize(services, options = {}) {
    if (this.initialized) {
      return;
    }

    logger.debug('Initializing transcription engine');
    this.services = services;
    this.options = options;

    try {
      // Try to get the appropriate engine based on configuration
      await this._setupEngine();
      
      this.initialized = true;
      logger.debug('Transcription engine initialized successfully');
    } catch (error) {
      logger.error('Error initializing transcription engine:', error);
      throw error;
    }
  }

  /**
   * Shutdown the engine
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.debug('Shutting down transcription engine');

    try {
      await this.stop();

      if (this.engine) {
        // Clean up the engine resources
        try {
          if (typeof this.engine.close === 'function') {
            this.engine.close();
          }
          
          if (typeof this.engine.abort === 'function') {
            this.engine.abort();
          }
        } catch (engineError) {
          logger.warn('Error closing transcription engine:', engineError);
        }
        
        this.engine = null;
      }

      this.initialized = false;
      logger.debug('Transcription engine shutdown complete');
    } catch (error) {
      logger.error('Error shutting down transcription engine:', error);
    }
  }

  /**
   * Start the transcription engine
   * @param {Object} options Start options
   * @returns {Promise<boolean>} Success status
   */
  async start(options = {}) {
    if (!this.initialized) {
      throw new Error('Transcription engine not initialized');
    }

    if (this.recognitionActive) {
      logger.debug('Engine already active');
      return true;
    }

    try {
      logger.debug('Starting transcription engine');
      
      // Apply options if provided
      if (Object.keys(options).length > 0) {
        this._applyOptions(options);
      }

      // Set up event handlers
      this._setupEventHandlers();
      
      // Start the engine
      await this._startEngine();
      
      this.recognitionActive = true;
      logger.debug('Transcription engine started successfully');
      return true;
    } catch (error) {
      logger.error('Error starting transcription engine:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Stop the transcription engine
   * @returns {Promise<boolean>} Success status
   */
  async stop() {
    if (!this.recognitionActive) {
      return true;
    }

    try {
      logger.debug('Stopping transcription engine');
      
      await this._stopEngine();
      
      this.recognitionActive = false;
      logger.debug('Transcription engine stopped successfully');
      return true;
    } catch (error) {
      logger.error('Error stopping transcription engine:', error);
      this.recognitionActive = false;
      return false;
    }
  }

  /**
   * Set up the appropriate engine based on configuration
   * @private
   */
  async _setupEngine() {
    // Check if we should use WhisperAPI
    const useWhisperAPI = this.options.model === 'whisper';
    
    if (useWhisperAPI) {
      await this._setupWhisperEngine();
    } else {
      // Use mock engine for now 
      // In a real implementation, this would use the appropriate engine
      // based on the platform and configuration
      this._setupMockEngine();
    }
  }

  /**
   * Set up the WhisperAPI engine
   * @private
   */
  async _setupWhisperEngine() {
    logger.debug('Setting up WhisperAPI engine');
    
    try {
      // Get WhisperAPIClient
      const resourceManager = this.services.get('resource');
      const whisperClient = await resourceManager.getResource('WhisperAPIClient');
      
      if (!whisperClient) {
        throw new Error('WhisperAPIClient not available');
      }
      
      // Create engine wrapper
      this.engine = {
        start: async () => {
          // Whisper API doesn't need to start a service,
          // it's called on demand with audio data
          return true;
        },
        stop: async () => {
          // Nothing to stop with Whisper API
          return true;
        }
      };
      
      logger.debug('WhisperAPI engine set up successfully');
    } catch (error) {
      logger.error('Error setting up WhisperAPI engine:', error);
      throw error;
    }
  }

  /**
   * Set up a mock engine for development/testing
   * @private
   */
  _setupMockEngine() {
    logger.debug('Setting up mock transcription engine');
    
    this.engine = {
      start: () => {
        logger.debug('Mock transcription engine started');
        
        // Simulate occasional transcriptions
        this._mockTranscriptionInterval = setInterval(() => {
          if (this.recognitionActive) {
            // Simulate interim results
            this._handleTranscriptionResult({
              results: [
                {
                  isFinal: false,
                  alternatives: [{ transcript: 'This is an interim result' }]
                }
              ]
            });
            
            // Simulate final result after a delay
            setTimeout(() => {
              if (this.recognitionActive) {
                this._handleTranscriptionResult({
                  results: [
                    {
                      isFinal: true,
                      alternatives: [{ transcript: 'Hey Juno, what time is it?' }]
                    }
                  ]
                });
              }
            }, 2000);
          }
        }, 10000);
        
        return Promise.resolve(true);
      },
      stop: () => {
        logger.debug('Mock transcription engine stopped');
        
        if (this._mockTranscriptionInterval) {
          clearInterval(this._mockTranscriptionInterval);
          this._mockTranscriptionInterval = null;
        }
        
        return Promise.resolve(true);
      }
    };
    
    logger.debug('Mock transcription engine set up successfully');
  }

  /**
   * Set up event handlers for the engine
   * @private
   */
  _setupEventHandlers() {
    if (this.engine) {
      this.engine.onresult = this._handleTranscriptionResult.bind(this);
      this.engine.onerror = this._handleTranscriptionError.bind(this);
      this.engine.onend = this._handleTranscriptionEnd.bind(this);
    }
  }

  /**
   * Start the engine
   * @private
   */
  async _startEngine() {
    if (this.engine && typeof this.engine.start === 'function') {
      await this.engine.start();
    }
  }

  /**
   * Stop the engine
   * @private
   */
  async _stopEngine() {
    if (this.engine && typeof this.engine.stop === 'function') {
      await this.engine.stop();
    }
  }

  /**
   * Apply options to the engine
   * @param {Object} options Options to apply
   * @private
   */
  _applyOptions(options) {
    this.options = {
      ...this.options,
      ...options
    };
    
    logger.debug('Applied options to transcription engine:', this.options);
  }

  /**
   * Handle transcription results from the engine
   * @param {Object} event Transcription event
   * @private
   */
  _handleTranscriptionResult(event) {
    try {
      if (!event || !event.results || event.results.length === 0) {
        return;
      }
      
      // Get most recent result
      const result = event.results[event.results.length - 1];
      if (!result.alternatives || result.alternatives.length === 0) {
        return;
      }
      
      // Get transcript
      const transcript = result.alternatives[0].transcript;
      const isFinal = !!result.isFinal;
      
      logger.debug(`Transcription result: "${transcript}", isFinal: ${isFinal}`);
      
      // Emit the transcription event
      if (transcript && transcript.trim()) {
        this.emit('transcription', {
          text: transcript,
          isFinal,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error('Error handling transcription result:', error);
    }
  }

  /**
   * Handle transcription errors from the engine
   * @param {Object} error Error event
   * @private
   */
  _handleTranscriptionError(error) {
    logger.error('Transcription engine error:', error);
    
    // Emit the error event
    this.emit('error', error);
    
    // Restart recognition if it's a recoverable error
    if (this.recognitionActive) {
      // In real implementation, check for specific error types that are recoverable
      logger.debug('Attempting to restart engine after error');
      this._stopEngine().then(() => {
        setTimeout(() => {
          if (this.recognitionActive) {
            this._startEngine();
          }
        }, 1000);
      });
    }
  }

  /**
   * Handle transcription end event from the engine
   * @private
   */
  _handleTranscriptionEnd() {
    logger.debug('Transcription engine ended session');
    
    // Restart if we should still be active
    if (this.recognitionActive) {
      logger.debug('Automatically restarting engine');
      setTimeout(() => {
        if (this.recognitionActive) {
          this._startEngine();
        }
      }, 500);
    }
  }
}

module.exports = TranscriptionEngine; 