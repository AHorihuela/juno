/**
 * Text-to-Speech Service
 * 
 * This service:
 * - Provides text-to-speech capabilities
 * - Manages voice settings and preferences
 * - Handles TTS events and callbacks
 */

const { EventEmitter } = require('events');
const logger = require('../../logger');

class TTSService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.options = {
      enabled: true,
      defaultVoice: null,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      ...options
    };
    
    this.services = null;
    this.voices = [];
    this.speaking = false;
    this.currentUtterance = null;
    this.utteranceQueue = [];
  }
  
  /**
   * Initialize the service
   * @param {Object} services Service registry
   * @returns {Promise<void>}
   */
  async initialize(services) {
    if (this.initialized) {
      return;
    }
    
    logger.info('Initializing TTS service');
    this.services = services;
    
    try {
      // Load configuration
      const configService = services.get('config');
      if (configService) {
        const ttsConfig = await configService.getConfig('tts') || {};
        
        // Update options from config
        if (ttsConfig.enabled !== undefined) {
          this.options.enabled = ttsConfig.enabled;
        }
        
        if (ttsConfig.defaultVoice) {
          this.options.defaultVoice = ttsConfig.defaultVoice;
        }
        
        if (ttsConfig.rate !== undefined) {
          this.options.rate = ttsConfig.rate;
        }
        
        if (ttsConfig.pitch !== undefined) {
          this.options.pitch = ttsConfig.pitch;
        }
        
        if (ttsConfig.volume !== undefined) {
          this.options.volume = ttsConfig.volume;
        }
      } else {
        logger.warn('Config service not available, using default TTS settings');
      }
      
      // Initialize TTS engine - browser SpeechSynthesis not available in main process
      // We'll use a mock implementation for now
      this._initializeTTSEngine();
      
      this.initialized = true;
      logger.info('TTS service initialized successfully');
    } catch (error) {
      logger.error('Error initializing TTS service:', error);
      throw error;
    }
  }
  
  /**
   * Shutdown the service
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('Shutting down TTS service');
    
    try {
      // Cancel any ongoing speech
      this.cancel();
      
      this.initialized = false;
      logger.info('TTS service shutdown complete');
    } catch (error) {
      logger.error('Error shutting down TTS service:', error);
      throw error;
    }
  }
  
  /**
   * Speak text using TTS
   * @param {string} text Text to speak
   * @param {Object} options Speech options
   * @returns {Promise<Object>} Utterance info
   */
  async speak(text, options = {}) {
    if (!this.initialized) {
      logger.error('Cannot speak text, TTS service not initialized');
      throw new Error('TTS service not initialized');
    }
    
    if (!this.options.enabled) {
      logger.debug('TTS is disabled, not speaking');
      return { spoken: false, reason: 'tts-disabled' };
    }
    
    if (!text || typeof text !== 'string') {
      logger.debug('Empty or invalid text provided to speak');
      return { spoken: false, reason: 'invalid-text' };
    }
    
    try {
      logger.debug(`Speaking text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      
      // Create utterance object
      const utterance = {
        id: `tts-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        text,
        options: {
          voice: options.voice || this.options.defaultVoice,
          rate: options.rate !== undefined ? options.rate : this.options.rate,
          pitch: options.pitch !== undefined ? options.pitch : this.options.pitch,
          volume: options.volume !== undefined ? options.volume : this.options.volume
        },
        status: 'queued',
        startTime: null,
        endTime: null
      };
      
      // Add to queue and process
      this.utteranceQueue.push(utterance);
      this._processQueue();
      
      // Return utterance info
      return {
        spoken: true,
        utteranceId: utterance.id,
        queueLength: this.utteranceQueue.length
      };
    } catch (error) {
      logger.error('Error speaking text:', error);
      return { 
        spoken: false, 
        reason: 'speak-error', 
        error: error.message 
      };
    }
  }
  
  /**
   * Cancel all pending speech
   * @returns {boolean} Success status
   */
  cancel() {
    try {
      logger.debug('Cancelling all speech');
      
      // Remove all items from queue
      this.utteranceQueue = [];
      
      // Cancel current utterance
      if (this.speaking && this.currentUtterance) {
        // In a real implementation, we would call the TTS engine's cancel method
        // For our mock implementation, just update the state
        this.speaking = false;
        this.currentUtterance.status = 'cancelled';
        this.currentUtterance.endTime = Date.now();
        
        // Emit cancelled event
        this.emit('cancelled', { utteranceId: this.currentUtterance.id });
        
        this.currentUtterance = null;
      }
      
      logger.debug('All speech cancelled');
      return true;
    } catch (error) {
      logger.error('Error cancelling speech:', error);
      return false;
    }
  }
  
  /**
   * Pause speech
   * @returns {boolean} Success status
   */
  pause() {
    try {
      if (!this.speaking || !this.currentUtterance) {
        logger.debug('Nothing to pause');
        return false;
      }
      
      logger.debug('Pausing speech');
      
      // In a real implementation, we would call the TTS engine's pause method
      // For our mock implementation, just update the state
      this.speaking = false;
      this.currentUtterance.status = 'paused';
      
      // Emit paused event
      this.emit('paused', { utteranceId: this.currentUtterance.id });
      
      return true;
    } catch (error) {
      logger.error('Error pausing speech:', error);
      return false;
    }
  }
  
  /**
   * Resume speech
   * @returns {boolean} Success status
   */
  resume() {
    try {
      if (!this.currentUtterance || this.currentUtterance.status !== 'paused') {
        logger.debug('Nothing to resume');
        return false;
      }
      
      logger.debug('Resuming speech');
      
      // In a real implementation, we would call the TTS engine's resume method
      // For our mock implementation, just update the state
      this.speaking = true;
      this.currentUtterance.status = 'speaking';
      
      // Emit resumed event
      this.emit('resumed', { utteranceId: this.currentUtterance.id });
      
      // Simulate speech completion after a short delay
      setTimeout(() => {
        this._completeSpeech();
      }, 1000);
      
      return true;
    } catch (error) {
      logger.error('Error resuming speech:', error);
      return false;
    }
  }
  
  /**
   * Get available voices
   * @returns {Array} Available voices
   */
  getVoices() {
    try {
      return this.voices;
    } catch (error) {
      logger.error('Error getting voices:', error);
      return [];
    }
  }
  
  /**
   * Set default voice
   * @param {string} voiceId Voice identifier
   * @returns {boolean} Success status
   */
  setDefaultVoice(voiceId) {
    try {
      // Check if voice exists
      const voiceExists = this.voices.some(voice => voice.id === voiceId);
      
      if (!voiceExists) {
        logger.warn(`Voice with ID ${voiceId} not found`);
        return false;
      }
      
      logger.debug(`Setting default voice to ${voiceId}`);
      this.options.defaultVoice = voiceId;
      
      // Save to config if available
      const configService = this.services?.get('config');
      if (configService) {
        configService.updateConfig('tts', { defaultVoice: voiceId });
      }
      
      return true;
    } catch (error) {
      logger.error('Error setting default voice:', error);
      return false;
    }
  }
  
  /**
   * Set speech rate
   * @param {number} rate Speech rate (0.1 to 10)
   * @returns {boolean} Success status
   */
  setRate(rate) {
    try {
      // Validate rate
      if (typeof rate !== 'number' || rate < 0.1 || rate > 10) {
        logger.warn(`Invalid rate: ${rate}, must be between 0.1 and 10`);
        return false;
      }
      
      logger.debug(`Setting speech rate to ${rate}`);
      this.options.rate = rate;
      
      // Save to config if available
      const configService = this.services?.get('config');
      if (configService) {
        configService.updateConfig('tts', { rate });
      }
      
      return true;
    } catch (error) {
      logger.error('Error setting speech rate:', error);
      return false;
    }
  }
  
  /**
   * Set speech pitch
   * @param {number} pitch Speech pitch (0 to 2)
   * @returns {boolean} Success status
   */
  setPitch(pitch) {
    try {
      // Validate pitch
      if (typeof pitch !== 'number' || pitch < 0 || pitch > 2) {
        logger.warn(`Invalid pitch: ${pitch}, must be between 0 and 2`);
        return false;
      }
      
      logger.debug(`Setting speech pitch to ${pitch}`);
      this.options.pitch = pitch;
      
      // Save to config if available
      const configService = this.services?.get('config');
      if (configService) {
        configService.updateConfig('tts', { pitch });
      }
      
      return true;
    } catch (error) {
      logger.error('Error setting speech pitch:', error);
      return false;
    }
  }
  
  /**
   * Set speech volume
   * @param {number} volume Speech volume (0 to 1)
   * @returns {boolean} Success status
   */
  setVolume(volume) {
    try {
      // Validate volume
      if (typeof volume !== 'number' || volume < 0 || volume > 1) {
        logger.warn(`Invalid volume: ${volume}, must be between 0 and 1`);
        return false;
      }
      
      logger.debug(`Setting speech volume to ${volume}`);
      this.options.volume = volume;
      
      // Save to config if available
      const configService = this.services?.get('config');
      if (configService) {
        configService.updateConfig('tts', { volume });
      }
      
      return true;
    } catch (error) {
      logger.error('Error setting speech volume:', error);
      return false;
    }
  }
  
  /**
   * Initialize the TTS engine
   * @private
   */
  _initializeTTSEngine() {
    try {
      logger.debug('Initializing TTS engine');
      
      // Since we can't use browser SpeechSynthesis in main process,
      // create some mock voices for the demo
      this.voices = [
        { id: 'en-US-female-1', name: 'US English Female', lang: 'en-US', gender: 'female' },
        { id: 'en-US-male-1', name: 'US English Male', lang: 'en-US', gender: 'male' },
        { id: 'en-GB-female-1', name: 'British English Female', lang: 'en-GB', gender: 'female' },
        { id: 'en-GB-male-1', name: 'British English Male', lang: 'en-GB', gender: 'male' }
      ];
      
      // Set default voice if not already set
      if (!this.options.defaultVoice) {
        this.options.defaultVoice = this.voices[0].id;
      }
      
      logger.debug(`TTS engine initialized with ${this.voices.length} voices`);
    } catch (error) {
      logger.error('Error initializing TTS engine:', error);
      throw error;
    }
  }
  
  /**
   * Process the utterance queue
   * @private
   */
  _processQueue() {
    try {
      // If speaking or no utterances, do nothing
      if (this.speaking || this.utteranceQueue.length === 0) {
        return;
      }
      
      // Get the next utterance
      const utterance = this.utteranceQueue.shift();
      this.currentUtterance = utterance;
      
      // Update status
      utterance.status = 'speaking';
      utterance.startTime = Date.now();
      this.speaking = true;
      
      // Emit start event
      this.emit('speaking', { 
        utteranceId: utterance.id, 
        text: utterance.text 
      });
      
      logger.debug(`Speaking utterance ${utterance.id}`);
      
      // In a real implementation, we would call the TTS engine's speak method
      // For our mock implementation, simulate speech with a timeout
      const textLength = utterance.text.length;
      const speakTimeMs = Math.max(1000, Math.min(10000, textLength * 50));
      
      setTimeout(() => {
        this._completeSpeech();
      }, speakTimeMs);
    } catch (error) {
      logger.error('Error processing utterance queue:', error);
      
      // Reset state and try next utterance
      this.speaking = false;
      this.currentUtterance = null;
      this._processQueue();
    }
  }
  
  /**
   * Complete current speech and process next in queue
   * @private
   */
  _completeSpeech() {
    try {
      if (!this.speaking || !this.currentUtterance) {
        return;
      }
      
      logger.debug(`Completed utterance ${this.currentUtterance.id}`);
      
      // Update status
      this.currentUtterance.status = 'completed';
      this.currentUtterance.endTime = Date.now();
      
      // Emit completion event
      this.emit('completed', {
        utteranceId: this.currentUtterance.id,
        duration: this.currentUtterance.endTime - this.currentUtterance.startTime
      });
      
      // Reset state
      this.speaking = false;
      this.currentUtterance = null;
      
      // Process next utterance if any
      this._processQueue();
    } catch (error) {
      logger.error('Error completing speech:', error);
      
      // Reset state and try next utterance
      this.speaking = false;
      this.currentUtterance = null;
      this._processQueue();
    }
  }
}

/**
 * Factory function for creating TTSService instances
 * @param {Object} options Service options
 * @returns {TTSService} TTS service instance
 */
module.exports = (options = {}) => {
  return new TTSService(options);
};

module.exports.TTSService = TTSService; 