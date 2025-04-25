/**
 * TranscriptionAPIService - Handle API calls to the transcription service
 * 
 * This service encapsulates the API communication for speech-to-text
 * transcription, handling authentication, request formatting, and error handling.
 */
const BaseService = require('../BaseService');
const LogManager = require('../../utils/LogManager');
const fs = require('fs');
const path = require('path');

// Get a logger for this module
const logger = LogManager.getLogger('TranscriptionAPIService');

// Request timeout in milliseconds
const API_REQUEST_TIMEOUT = 30000;

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

class TranscriptionAPIService extends BaseService {
  constructor() {
    super('TranscriptionAPI');
    
    // Track API usage metrics
    this.apiMetrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      totalProcessingTimeMs: 0,
      averageProcessingTimeMs: 0
    };
  }
  
  /**
   * Initialize the service
   * @private
   */
  async _initialize() {
    logger.info('Initializing TranscriptionAPIService');
    
    // Get required resources
    const resourceManager = await this.getService('resourceManager');
    this.whisperClient = await resourceManager.getResource('WhisperAPIClient');
    this.configManager = await this.getService('config');
    
    // Load API configuration
    this._loadApiConfiguration();
  }
  
  /**
   * Shutdown the service
   * @private
   */
  async _shutdown() {
    logger.info('Shutting down TranscriptionAPIService');
    
    // Clear references
    this.whisperClient = null;
    this.configManager = null;
    this.apiConfig = null;
  }
  
  /**
   * Load API configuration from config service
   * @private
   */
  _loadApiConfiguration() {
    this.apiConfig = this.configManager.get('transcription.api') || {};
    
    // Set defaults if needed
    this.apiConfig = {
      model: this.apiConfig.model || 'whisper-1',
      language: this.apiConfig.language || 'en',
      temperature: this.apiConfig.temperature || 0,
      ...this.apiConfig
    };
    
    logger.debug('Loaded API configuration:', this.apiConfig);
  }
  
  /**
   * Update API configuration
   * @param {Object} newConfig - New configuration object
   */
  updateApiConfiguration(newConfig) {
    // Merge with existing config
    this.apiConfig = {
      ...this.apiConfig,
      ...newConfig
    };
    
    // Save to config service
    this.configManager.set('transcription.api', this.apiConfig);
    
    logger.info('Updated API configuration');
  }
  
  /**
   * Transcribe audio file via API
   * @param {string} audioFilePath - Path to audio file
   * @param {Object} options - Transcription options
   * @param {string} [options.language] - Language code (e.g., 'en')
   * @param {string} [options.prompt] - Transcription context/prompt
   * @param {number} [options.temperature] - Sampling temperature
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioFilePath, options = {}) {
    const startTime = Date.now();
    
    // Update metrics
    this.apiMetrics.requestCount++;
    
    try {
      // Validate file
      if (!await this._validateAudioFile(audioFilePath)) {
        throw new Error('Invalid audio file');
      }
      
      // Prepare request parameters
      const params = this._prepareRequestParams(options);
      
      logger.info(`Transcribing audio file: ${path.basename(audioFilePath)}`);
      
      // Call API with retries
      const result = await this._callApiWithRetry(audioFilePath, params);
      
      // Update success metrics
      this.apiMetrics.successCount++;
      this._updateTimingMetrics(startTime);
      
      return result.text;
    } catch (error) {
      // Update error metrics
      this.apiMetrics.errorCount++;
      
      logger.error('Transcription API error:', error);
      throw error;
    }
  }
  
  /**
   * Call transcription API with retry logic
   * @param {string} audioFilePath - Path to audio file
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} API response
   * @private
   */
  async _callApiWithRetry(audioFilePath, params) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`Retry attempt ${attempt}/${MAX_RETRIES} for transcription...`);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
        
        // Read file as stream
        const audioStream = fs.createReadStream(audioFilePath);
        
        // Call API
        return await this.whisperClient.transcribe(audioStream, params, API_REQUEST_TIMEOUT);
      } catch (error) {
        lastError = error;
        
        // Only retry certain types of errors
        if (!this._isRetryableError(error)) {
          logger.warn('Non-retryable error encountered:', error);
          break;
        }
        
        logger.warn(`Transcription attempt ${attempt + 1} failed:`, error.message);
      }
    }
    
    // Rethrow last error
    throw lastError || new Error('Transcription failed after retries');
  }
  
  /**
   * Prepare request parameters
   * @param {Object} options - User options
   * @returns {Object} API request parameters
   * @private
   */
  _prepareRequestParams(options) {
    // Start with default config
    const params = { ...this.apiConfig };
    
    // Override with options
    if (options.language) params.language = options.language;
    if (options.prompt) params.prompt = options.prompt;
    if (options.temperature !== undefined) params.temperature = options.temperature;
    
    return params;
  }
  
  /**
   * Validate audio file exists and is readable
   * @param {string} filePath - Path to audio file
   * @returns {Promise<boolean>} Is valid
   * @private
   */
  async _validateAudioFile(filePath) {
    try {
      // Check file exists
      await fs.promises.access(filePath, fs.constants.R_OK);
      
      // Get file stats
      const stats = await fs.promises.stat(filePath);
      
      // Check is file and has size
      if (!stats.isFile() || stats.size === 0) {
        logger.error(`Invalid audio file: ${filePath} (not a file or empty)`);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`Error accessing audio file ${filePath}:`, error);
      return false;
    }
  }
  
  /**
   * Check if an error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} Is retryable
   * @private
   */
  _isRetryableError(error) {
    // Network errors are retryable
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ESOCKETTIMEDOUT' ||
        error.code === 'ECONNREFUSED') {
      return true;
    }
    
    // Some API errors are retryable
    if (error.status) {
      // Server errors (5xx) are retryable
      if (error.status >= 500 && error.status < 600) {
        return true;
      }
      
      // Too many requests (429) is retryable
      if (error.status === 429) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Update timing metrics
   * @param {number} startTime - Start timestamp
   * @private
   */
  _updateTimingMetrics(startTime) {
    const processingTimeMs = Date.now() - startTime;
    
    // Update metrics
    this.apiMetrics.totalProcessingTimeMs += processingTimeMs;
    this.apiMetrics.averageProcessingTimeMs = 
      this.apiMetrics.totalProcessingTimeMs / this.apiMetrics.successCount;
    
    logger.debug(`Processed transcription in ${processingTimeMs}ms, avg: ${this.apiMetrics.averageProcessingTimeMs.toFixed(0)}ms`);
  }
  
  /**
   * Get API usage metrics
   * @returns {Object} API metrics
   */
  getApiMetrics() {
    return { ...this.apiMetrics };
  }
  
  /**
   * Reset API metrics
   */
  resetApiMetrics() {
    this.apiMetrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      totalProcessingTimeMs: 0,
      averageProcessingTimeMs: 0
    };
    
    logger.info('API metrics reset');
  }
  
  /**
   * Get current API configuration
   * @returns {Object} API configuration
   */
  getApiConfiguration() {
    return { ...this.apiConfig };
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TranscriptionAPIService(); 