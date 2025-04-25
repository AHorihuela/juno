/**
 * TranscriptionCoreService - Core transcription functionality
 * 
 * This service handles the central transcription workflow:
 * - Managing transcription requests
 * - Coordinating with WhisperAPI
 * - Performance tracking and optimization
 * - Caching of results
 */
const BaseService = require('../BaseService');
const LogManager = require('../../utils/LogManager');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Get a logger for this module
const logger = LogManager.getLogger('TranscriptionCoreService');

// Constants for transcription
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_MODEL = 'whisper-1';
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_PROMPT = '';
const CACHE_MAX_SIZE = 500; // Max cache entries
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

class TranscriptionCoreService extends BaseService {
  constructor() {
    super('TranscriptionCore');
    
    // Dependencies
    this.whisperClient = null;
    this.audioProcessing = null;
    
    // Transcription configuration
    this.config = {
      defaultLanguage: DEFAULT_LANGUAGE,
      defaultModel: DEFAULT_MODEL,
      defaultTemperature: DEFAULT_TEMPERATURE,
      defaultPrompt: DEFAULT_PROMPT
    };
    
    // Transcription cache
    this.transcriptionCache = new Map();
    this.cacheQueue = []; // FIFO queue for cache management
    
    // Performance tracking
    this.metrics = {
      totalTranscriptions: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0,
      totalAudioDuration: 0,
      totalProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
  
  /**
   * Initialize the service
   * @private
   */
  async _initialize() {
    logger.info('Initializing TranscriptionCoreService');
    
    // Get required services
    this.configManager = await this.getService('config');
    this.audioProcessing = await this.getService('AudioProcessing');
    
    // Create Whisper API client
    const WhisperAPIClient = require('./WhisperAPIClient');
    this.whisperClient = new WhisperAPIClient({
      logger,
      apiKey: this.configManager.get('openai.apiKey'),
      basePath: this.configManager.get('openai.apiBaseUrl')
    });
    
    // Load configuration
    this._loadConfiguration();
    
    // Set up periodic cache cleanup
    this._setupCacheCleanup();
    
    logger.info('TranscriptionCoreService initialized');
  }
  
  /**
   * Shutdown the service
   * @private
   */
  async _shutdown() {
    logger.info('Shutting down TranscriptionCoreService');
    
    // Clean up cache
    this.transcriptionCache.clear();
    this.cacheQueue = [];
    
    // Clear references
    this.configManager = null;
    this.audioProcessing = null;
    this.whisperClient = null;
  }
  
  /**
   * Load configuration from config manager
   * @private
   */
  _loadConfiguration() {
    // Load transcription configuration
    const config = this.configManager.get('transcription', {});
    
    this.config = {
      defaultLanguage: config.defaultLanguage || DEFAULT_LANGUAGE,
      defaultModel: config.defaultModel || DEFAULT_MODEL,
      defaultTemperature: config.defaultTemperature ?? DEFAULT_TEMPERATURE,
      defaultPrompt: config.defaultPrompt || DEFAULT_PROMPT,
      cacheEnabled: config.cacheEnabled !== false,
      cacheSize: config.cacheSize || CACHE_MAX_SIZE,
      cacheMaxAge: config.cacheMaxAge || CACHE_MAX_AGE_MS
    };
    
    logger.debug('Loaded transcription configuration:', this.config);
  }
  
  /**
   * Set up periodic cache cleanup
   * @private
   */
  _setupCacheCleanup() {
    const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
    
    // Clear previous interval if it exists
    if (this._cacheCleanupInterval) {
      clearInterval(this._cacheCleanupInterval);
    }
    
    // Set up new interval
    this._cacheCleanupInterval = setInterval(() => {
      this._cleanupCache();
    }, CLEANUP_INTERVAL);
  }
  
  /**
   * Clean up expired cache entries
   * @private
   */
  _cleanupCache() {
    if (!this.config.cacheEnabled) {
      return;
    }
    
    try {
      const now = Date.now();
      let removedCount = 0;
      
      // Remove expired entries
      for (const [key, entry] of this.transcriptionCache.entries()) {
        if (now - entry.timestamp > this.config.cacheMaxAge) {
          this.transcriptionCache.delete(key);
          
          // Remove from queue
          const queueIndex = this.cacheQueue.indexOf(key);
          if (queueIndex !== -1) {
            this.cacheQueue.splice(queueIndex, 1);
          }
          
          removedCount++;
        }
      }
      
      if (removedCount > 0) {
        logger.debug(`Removed ${removedCount} expired cache entries`);
      }
    } catch (error) {
      logger.error('Error cleaning up cache:', error);
    }
  }
  
  /**
   * Generate cache key for audio file
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {string} Cache key
   * @private
   */
  _generateCacheKey(audioPath, options) {
    try {
      // Get file stats for modified time and size
      const stats = fs.statSync(audioPath);
      
      // Create unique key based on:
      // - File modification time
      // - File size
      // - Transcription options
      const key = {
        path: audioPath,
        mtime: stats.mtimeMs,
        size: stats.size,
        options: {
          language: options.language,
          model: options.model,
          temperature: options.temperature,
          prompt: options.prompt
        }
      };
      
      // Convert to string and hash
      return JSON.stringify(key);
    } catch (error) {
      logger.warn('Error generating cache key:', error);
      // Fall back to a basic key
      return `${audioPath}:${Date.now()}`;
    }
  }
  
  /**
   * Add transcription result to cache
   * @param {string} key - Cache key
   * @param {Object} result - Transcription result
   * @private
   */
  _addToCache(key, result) {
    if (!this.config.cacheEnabled) {
      return;
    }
    
    try {
      // Check if cache is full
      if (this.transcriptionCache.size >= this.config.cacheSize) {
        // Remove oldest entry
        const oldestKey = this.cacheQueue.shift();
        if (oldestKey) {
          this.transcriptionCache.delete(oldestKey);
        }
      }
      
      // Add to cache with timestamp
      this.transcriptionCache.set(key, {
        result,
        timestamp: Date.now()
      });
      
      // Add to queue
      this.cacheQueue.push(key);
      
      logger.debug(`Added transcription to cache, size: ${this.transcriptionCache.size}`);
    } catch (error) {
      logger.error('Error adding to cache:', error);
    }
  }
  
  /**
   * Get transcription from cache
   * @param {string} key - Cache key
   * @returns {Object|null} Cached result or null if not found
   * @private
   */
  _getFromCache(key) {
    if (!this.config.cacheEnabled) {
      return null;
    }
    
    try {
      const cached = this.transcriptionCache.get(key);
      
      if (!cached) {
        this.metrics.cacheMisses++;
        return null;
      }
      
      // Check if expired
      const now = Date.now();
      if (now - cached.timestamp > this.config.cacheMaxAge) {
        // Remove expired entry
        this.transcriptionCache.delete(key);
        
        // Remove from queue
        const queueIndex = this.cacheQueue.indexOf(key);
        if (queueIndex !== -1) {
          this.cacheQueue.splice(queueIndex, 1);
        }
        
        this.metrics.cacheMisses++;
        return null;
      }
      
      // Update access time and move to end of queue
      cached.timestamp = now;
      
      // Move to end of queue
      const queueIndex = this.cacheQueue.indexOf(key);
      if (queueIndex !== -1) {
        this.cacheQueue.splice(queueIndex, 1);
        this.cacheQueue.push(key);
      }
      
      this.metrics.cacheHits++;
      logger.debug('Cache hit for transcription');
      
      return cached.result;
    } catch (error) {
      logger.error('Error retrieving from cache:', error);
      return null;
    }
  }
  
  /**
   * Get transcription options with defaults
   * @param {Object} options - User options
   * @returns {Object} Complete options with defaults
   * @private
   */
  _getTranscriptionOptions(options = {}) {
    return {
      language: options.language || this.config.defaultLanguage,
      model: options.model || this.config.defaultModel,
      temperature: options.temperature ?? this.config.defaultTemperature,
      prompt: options.prompt ?? this.config.defaultPrompt,
      useCache: options.useCache !== false && this.config.cacheEnabled
    };
  }
  
  /**
   * Transcribe audio file with Whisper API
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @param {string} [options.language] - Language code (e.g., 'en', 'es')
   * @param {string} [options.model] - Whisper model to use
   * @param {number} [options.temperature] - Sampling temperature (0-1)
   * @param {string} [options.prompt] - Initial prompt for transcription
   * @param {boolean} [options.useCache=true] - Use cache if available
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeAudio(audioPath, options = {}) {
    const startTime = Date.now();
    
    try {
      logger.info(`Transcribing audio file: ${path.basename(audioPath)}`);
      
      // Verify audio file
      if (!await this.audioProcessing.isValidAudioFile(audioPath)) {
        throw new Error('Invalid audio file for transcription');
      }
      
      // Get audio duration
      const audioDuration = await this.audioProcessing.getAudioDuration(audioPath);
      logger.debug(`Audio duration: ${audioDuration.toFixed(2)} seconds`);
      
      // Get complete options
      const transcriptionOptions = this._getTranscriptionOptions(options);
      
      // Check cache if enabled
      if (transcriptionOptions.useCache) {
        const cacheKey = this._generateCacheKey(audioPath, transcriptionOptions);
        const cachedResult = this._getFromCache(cacheKey);
        
        if (cachedResult) {
          logger.info(`Using cached transcription for: ${path.basename(audioPath)}`);
          
          // Update metrics
          this.metrics.totalTranscriptions++;
          this.metrics.successfulTranscriptions++;
          this.metrics.totalAudioDuration += audioDuration;
          this.metrics.totalProcessingTime += (Date.now() - startTime);
          
          return cachedResult;
        }
      }
      
      // Prepare audio for transcription
      const preparedAudioPath = await this.audioProcessing.convertAudioFormat(audioPath, {
        format: 'mp3',
        sampleRate: 16000,
        channels: 1
      });
      
      // Send to Whisper API
      const apiOptions = {
        model: transcriptionOptions.model,
        language: transcriptionOptions.language,
        temperature: transcriptionOptions.temperature,
        prompt: transcriptionOptions.prompt
      };
      
      logger.info(`Sending audio to Whisper API (${apiOptions.model}, ${apiOptions.language})`);
      const transcriptionResult = await this.whisperClient.transcribe(preparedAudioPath, apiOptions);
      
      if (!transcriptionResult || !transcriptionResult.text) {
        throw new Error('Failed to get transcription from API');
      }
      
      // Process result
      const processedResult = this._processTranscriptionResult(transcriptionResult);
      
      // Update metrics
      this.metrics.totalTranscriptions++;
      this.metrics.successfulTranscriptions++;
      this.metrics.totalAudioDuration += audioDuration;
      this.metrics.totalProcessingTime += (Date.now() - startTime);
      
      // Cache result if cache is enabled
      if (transcriptionOptions.useCache) {
        const cacheKey = this._generateCacheKey(audioPath, transcriptionOptions);
        this._addToCache(cacheKey, processedResult);
      }
      
      // Clean up prepared audio file if different from input
      if (preparedAudioPath !== audioPath) {
        try {
          fs.unlinkSync(preparedAudioPath);
        } catch (error) {
          logger.warn(`Error cleaning up prepared audio file: ${error.message}`);
        }
      }
      
      const processingTime = Date.now() - startTime;
      const realTimeFactor = processingTime / (audioDuration * 1000);
      logger.info(`Transcription completed in ${processingTime}ms (RTF: ${realTimeFactor.toFixed(2)})`);
      
      return processedResult;
    } catch (error) {
      // Update metrics
      this.metrics.totalTranscriptions++;
      this.metrics.failedTranscriptions++;
      this.metrics.totalProcessingTime += (Date.now() - startTime);
      
      logger.error('Error transcribing audio:', error);
      throw error;
    }
  }
  
  /**
   * Process raw transcription result
   * @param {Object} rawResult - Raw API response
   * @returns {Object} Processed result
   * @private
   */
  _processTranscriptionResult(rawResult) {
    try {
      // Basic text cleanup
      let text = rawResult.text || '';
      
      // Trim whitespace
      text = text.trim();
      
      // Create processed result
      const processedResult = {
        text,
        raw: rawResult,
        timestamp: Date.now(),
        id: uuidv4()
      };
      
      return processedResult;
    } catch (error) {
      logger.error('Error processing transcription result:', error);
      return rawResult;
    }
  }
  
  /**
   * Get transcription metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    // Calculate derived metrics
    const averageProcessingTime = this.metrics.totalTranscriptions > 0
      ? this.metrics.totalProcessingTime / this.metrics.totalTranscriptions
      : 0;
    
    const successRate = this.metrics.totalTranscriptions > 0
      ? (this.metrics.successfulTranscriptions / this.metrics.totalTranscriptions) * 100
      : 0;
    
    const cacheHitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
      ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
      : 0;
    
    // Return metrics
    return {
      ...this.metrics,
      averageProcessingTime,
      successRate,
      cacheHitRate,
      cacheSize: this.transcriptionCache.size,
      maxCacheSize: this.config.cacheSize
    };
  }
  
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalTranscriptions: 0,
      successfulTranscriptions: 0,
      failedTranscriptions: 0,
      totalAudioDuration: 0,
      totalProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    logger.info('Transcription metrics reset');
  }
  
  /**
   * Clear transcription cache
   */
  clearCache() {
    this.transcriptionCache.clear();
    this.cacheQueue = [];
    
    logger.info('Transcription cache cleared');
  }
  
  /**
   * Update transcription configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfiguration(newConfig) {
    // Update configuration
    const updatedConfig = { ...this.config, ...newConfig };
    
    // Save to config manager
    this.configManager.set('transcription', updatedConfig);
    
    // Update local config
    this.config = updatedConfig;
    
    logger.info('Transcription configuration updated:', updatedConfig);
  }
  
  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TranscriptionCoreService(); 