/**
 * TranscriptionService - Handles speech-to-text transcription
 * 
 * This service coordinates the transcription process:
 * - Captures audio input from microphone
 * - Prepares audio for transcription API
 * - Sends audio to Whisper API and processes response
 * - Integrates with text processing for post-processing
 * - Manages caching and performance metrics
 */

const BaseService = require('../BaseService');
const LogManager = require('../../utils/LogManager');
const WhisperAPIClient = require('./WhisperAPIClient');
const AudioUtils = require('../../utils/AudioUtils');
const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Get a logger for this module
const logger = LogManager.getLogger('TranscriptionService');

// Constants for performance tracking
const METRICS_HISTORY_LIMIT = 20;

class TranscriptionService extends BaseService {
  constructor() {
    super('Transcription');
    
    // API client instance
    this.apiClient = null;
    
    // Services
    this.configManager = null;
    this.textProcessingService = null;
    this.contextService = null;
    this.selectionService = null;
    
    // Performance metrics
    this.metrics = {
      transcriptions: 0,
      totalDuration: 0,
      averageDuration: 0,
      history: []
    };
    
    // Caching
    this.cache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
  
  /**
   * Initialize the service
   * @private
   */
  async _initialize() {
    logger.info('Initializing TranscriptionService');
    
    // Get required services
    this.configManager = await this.getService('config');
    this.textProcessingService = await this.getService('textProcessing');
    this.contextService = await this.getService('context');
    this.selectionService = await this.getService('selection');
    
    // Create API client
    this.apiClient = new WhisperAPIClient({
      apiKey: this.configManager.get('transcription.apiKey'),
      apiEndpoint: this.configManager.get('transcription.apiEndpoint'),
      model: this.configManager.get('transcription.model') || 'whisper-1'
    });
    
    // Set up cache directory
    this.cacheDirectory = this.configManager.get('transcription.cacheDirectory') || 
      path.join(this.configManager.getAppDataPath(), 'cache', 'transcription');
    
    await this._ensureCacheDirectory();
    
    // Load cache stats
    this.cacheEnabled = this.configManager.get('transcription.enableCache') !== false;
    this.cacheHits = this.configManager.get('transcription.cacheHits') || 0;
    this.cacheMisses = this.configManager.get('transcription.cacheMisses') || 0;
    
    // Load metrics
    const savedMetrics = this.configManager.get('transcription.metrics');
    if (savedMetrics) {
      this.metrics = { ...savedMetrics };
    }
    
    logger.info('TranscriptionService initialized');
  }
  
  /**
   * Shutdown the service
   * @private
   */
  async _shutdown() {
    logger.info('Shutting down TranscriptionService');
    
    // Save metrics and cache stats
    this.configManager.set('transcription.metrics', this.metrics);
    this.configManager.set('transcription.cacheHits', this.cacheHits);
    this.configManager.set('transcription.cacheMisses', this.cacheMisses);
    
    // Clear references
    this.apiClient = null;
    this.configManager = null;
    this.textProcessingService = null;
    this.contextService = null;
    this.selectionService = null;
  }
  
  /**
   * Ensure cache directory exists
   * @private
   */
  async _ensureCacheDirectory() {
    try {
      if (!fs.existsSync(this.cacheDirectory)) {
        fs.mkdirSync(this.cacheDirectory, { recursive: true });
        logger.info(`Created cache directory: ${this.cacheDirectory}`);
      }
    } catch (error) {
      logger.error('Error creating cache directory:', error);
      // Disable cache on error
      this.cacheEnabled = false;
    }
  }
  
  /**
   * Transcribe audio to text
   * @param {Buffer|Uint8Array|string} audioData - Audio data to transcribe
   * @param {Object} options - Transcription options
   * @param {string} [options.language] - Language code (e.g. 'en')
   * @param {boolean} [options.detectCommands=true] - Whether to detect commands
   * @param {boolean} [options.useCache=true] - Whether to use cache
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioData, options = {}) {
    const {
      language,
      detectCommands = true,
      useCache = true
    } = options;
    
    const startTime = performance.now();
    
    try {
      logger.info('Starting transcription process');
      
      // Process audio for API
      const preparedAudio = await this._prepareAudio(audioData);
      
      // Check cache if enabled
      const cacheEnabled = this.cacheEnabled && useCache;
      let transcription = null;
      
      if (cacheEnabled) {
        transcription = await this._checkCache(preparedAudio);
        
        if (transcription) {
          logger.info('Transcription cache hit');
          this.cacheHits++;
          
          // Update metrics and return cached result
          const endTime = performance.now();
          const duration = endTime - startTime;
          this._updateMetrics(duration, true);
          
          return transcription;
        }
        
        logger.debug('Transcription cache miss');
        this.cacheMisses++;
      }
      
      // Call API for transcription
      const apiOptions = {
        language
      };
      
      const apiResult = await this.apiClient.transcribe(preparedAudio, apiOptions);
      
      // Process transcribed text
      const rawText = apiResult.text || '';
      
      const processedResult = await this.textProcessingService.processTranscribedText(rawText, {
        detectCommands
      });
      
      // Create full result
      transcription = {
        ...processedResult,
        rawText,
        language: apiResult.language,
        duration: apiResult.duration,
        fromCache: false
      };
      
      // Cache successful transcription
      if (cacheEnabled && transcription.processedText) {
        await this._cacheTranscription(preparedAudio, transcription);
      }
      
      // Update metrics
      const endTime = performance.now();
      const duration = endTime - startTime;
      this._updateMetrics(duration, false);
      
      // Handle commands if needed
      if (transcription.isCommand) {
        await this._handleCommand(transcription);
      }
      
      return transcription;
    } catch (error) {
      logger.error('Transcription error:', error);
      
      // Update metrics on error
      const endTime = performance.now();
      const duration = endTime - startTime;
      this._updateMetrics(duration, false);
      
      throw error;
    }
  }
  
  /**
   * Prepare audio data for API
   * @param {Buffer|Uint8Array|string} audioData - Audio data to prepare
   * @returns {Promise<Buffer>} Prepared audio buffer
   * @private
   */
  async _prepareAudio(audioData) {
    try {
      // Convert to proper format for API if needed
      if (typeof audioData === 'string') {
        // If it's a file path, read the file
        if (fs.existsSync(audioData)) {
          audioData = fs.readFileSync(audioData);
        } else {
          throw new Error('Audio file not found');
        }
      }
      
      // Convert Uint8Array to Buffer if needed
      if (audioData instanceof Uint8Array && !(audioData instanceof Buffer)) {
        audioData = Buffer.from(audioData);
      }
      
      // Check if we need to convert audio format
      const targetFormat = this.configManager.get('transcription.audioFormat') || 'mp3';
      const targetSampleRate = this.configManager.get('transcription.sampleRate') || 16000;
      
      // Use AudioUtils to convert if needed
      return await AudioUtils.prepareAudioForWhisper(audioData, {
        format: targetFormat,
        sampleRate: targetSampleRate
      });
    } catch (error) {
      logger.error('Error preparing audio:', error);
      throw error;
    }
  }
  
  /**
   * Check cache for existing transcription
   * @param {Buffer} audioData - Prepared audio data
   * @returns {Promise<Object|null>} Cached transcription or null
   * @private
   */
  async _checkCache(audioData) {
    try {
      if (!this.cacheEnabled) {
        return null;
      }
      
      // Generate cache key based on audio data hash
      const hash = crypto.createHash('md5').update(audioData).digest('hex');
      const cacheFile = path.join(this.cacheDirectory, `${hash}.json`);
      
      // Check memory cache first
      if (this.cache.has(hash)) {
        return this.cache.get(hash);
      }
      
      // Check file cache
      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        
        // Add fromCache flag
        cacheData.fromCache = true;
        
        // Store in memory cache
        this.cache.set(hash, cacheData);
        
        return cacheData;
      }
      
      return null;
    } catch (error) {
      logger.error('Error checking transcription cache:', error);
      return null;
    }
  }
  
  /**
   * Cache transcription result
   * @param {Buffer} audioData - Prepared audio data
   * @param {Object} transcription - Transcription result
   * @returns {Promise<void>}
   * @private
   */
  async _cacheTranscription(audioData, transcription) {
    try {
      if (!this.cacheEnabled) {
        return;
      }
      
      // Generate cache key based on audio data hash
      const hash = crypto.createHash('md5').update(audioData).digest('hex');
      const cacheFile = path.join(this.cacheDirectory, `${hash}.json`);
      
      // Prepare cache data (don't save fromCache flag)
      const cacheData = { ...transcription };
      delete cacheData.fromCache;
      
      // Save to file cache
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      
      // Store in memory cache (with limited size)
      if (this.cache.size >= 100) {
        // Clear oldest entry
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      
      this.cache.set(hash, transcription);
      
      logger.debug(`Cached transcription with key: ${hash}`);
    } catch (error) {
      logger.error('Error caching transcription:', error);
    }
  }
  
  /**
   * Update performance metrics
   * @param {number} duration - Elapsed time in ms
   * @param {boolean} fromCache - Whether result was from cache
   * @private
   */
  _updateMetrics(duration, fromCache) {
    // Only count API calls in metrics
    if (!fromCache) {
      this.metrics.transcriptions++;
      this.metrics.totalDuration += duration;
      this.metrics.averageDuration = this.metrics.totalDuration / this.metrics.transcriptions;
      
      // Add to history (limited size)
      this.metrics.history.push({
        timestamp: Date.now(),
        duration
      });
      
      // Limit history size
      if (this.metrics.history.length > METRICS_HISTORY_LIMIT) {
        this.metrics.history.shift();
      }
    }
  }
  
  /**
   * Handle a detected command
   * @param {Object} transcription - Transcription result with command
   * @returns {Promise<void>}
   * @private
   */
  async _handleCommand(transcription) {
    try {
      const { commandType, commandText } = transcription;
      
      logger.info(`Handling ${commandType} command: ${commandText}`);
      
      if (commandType === 'ai') {
        // Process AI command
        await this.textProcessingService.processAiCommand(commandText);
      } else if (commandType === 'dictation') {
        // Start dictation mode
        await this._handleDictationCommand(commandText);
      } else if (commandType === 'selection') {
        // Handle selection command
        await this._handleSelectionCommand(commandText);
      }
    } catch (error) {
      logger.error('Error handling command:', error);
    }
  }
  
  /**
   * Handle dictation command
   * @param {string} commandText - Dictation command text
   * @returns {Promise<void>}
   * @private
   */
  async _handleDictationCommand(commandText) {
    try {
      logger.info(`Starting dictation mode with text: ${commandText}`);
      
      // Get context service to start dictation
      await this.contextService.startDictation(commandText);
    } catch (error) {
      logger.error('Error handling dictation command:', error);
    }
  }
  
  /**
   * Handle selection command
   * @param {string} commandText - Selection command text
   * @returns {Promise<void>}
   * @private
   */
  async _handleSelectionCommand(commandText) {
    try {
      logger.info(`Processing selection command: ${commandText}`);
      
      // Use selection service to find and select text
      await this.selectionService.selectText(commandText);
    } catch (error) {
      logger.error('Error handling selection command:', error);
    }
  }
  
  /**
   * Clear transcription cache
   * @returns {Promise<void>}
   */
  async clearCache() {
    try {
      logger.info('Clearing transcription cache');
      
      // Clear memory cache
      this.cache.clear();
      
      // Clear file cache
      if (fs.existsSync(this.cacheDirectory)) {
        const files = fs.readdirSync(this.cacheDirectory);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.cacheDirectory, file));
          }
        }
      }
      
      // Reset cache stats
      this.cacheHits = 0;
      this.cacheMisses = 0;
      
      // Save cache stats
      this.configManager.set('transcription.cacheHits', this.cacheHits);
      this.configManager.set('transcription.cacheMisses', this.cacheMisses);
      
      logger.info('Transcription cache cleared');
    } catch (error) {
      logger.error('Error clearing transcription cache:', error);
      throw error;
    }
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Metrics data
   */
  getMetrics() {
    return { ...this.metrics };
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;
    
    return {
      enabled: this.cacheEnabled,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      total: totalRequests,
      hitRate: hitRate,
      memoryCacheSize: this.cache.size,
      cacheDirectory: this.cacheDirectory
    };
  }
  
  /**
   * Set transcription model
   * @param {string} model - Model name (e.g. 'whisper-1')
   */
  setModel(model) {
    if (!model) {
      throw new Error('Invalid model name');
    }
    
    this.apiClient.setModel(model);
    this.configManager.set('transcription.model', model);
    
    logger.info(`Set transcription model: ${model}`);
  }
  
  /**
   * Set API key
   * @param {string} apiKey - API key
   */
  setApiKey(apiKey) {
    if (!apiKey) {
      throw new Error('Invalid API key');
    }
    
    this.apiClient.setApiKey(apiKey);
    this.configManager.set('transcription.apiKey', apiKey);
    
    logger.info('Updated API key');
  }
  
  /**
   * Enable or disable transcription cache
   * @param {boolean} enabled - Whether cache is enabled
   */
  setCacheEnabled(enabled) {
    this.cacheEnabled = !!enabled;
    this.configManager.set('transcription.enableCache', this.cacheEnabled);
    
    logger.info(`${this.cacheEnabled ? 'Enabled' : 'Disabled'} transcription cache`);
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TranscriptionService(); 