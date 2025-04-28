/**
 * WhisperAPIClient - Client for interacting with the OpenAI Whisper API
 * 
 * This module provides a clean interface for transcribing audio using the
 * OpenAI Whisper API, with error handling and performance optimizations.
 */

const fs = require('fs');
const { APIError } = require('../../utils/ErrorManager');
const APICache = require('../utils/APICache');
const LogManager = require('../../utils/LogManager');

// Get a logger instance
const logger = LogManager.getLogger('WhisperAPIClient');

class WhisperAPIClient {
  constructor(resourceManager, configService, dictionaryService) {
    this.resourceManager = resourceManager;
    this.configService = configService;
    this.dictionaryService = dictionaryService;
    
    // OPTIMIZATION: Increased cache TTL to reduce API calls
    this.cache = new APICache({ ttl: 60 * 60 * 1000 }); // 60 minute cache (up from 30)
    
    // OPTIMIZATION: Keep tracking metrics for analysis
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      totalResponseTime: 0,
      lastResponseTime: 0
    };
    
    // OPTIMIZATION: Preload API key at initialization
    this._apiKeyPromise = this._preloadApiKey();
    
    // Track initialization state
    this.initialized = false;
    
    // Flag to use local mock for testing when API key is unavailable
    this.useLocalMock = false;
    
    logger.info('WhisperAPIClient initialized');
  }

  /**
   * Preload OpenAI API key at initialization
   * @returns {Promise<string>} API key
   * @private
   */
  async _preloadApiKey() {
    try {
      const apiKey = await this.configService.getOpenAIApiKey();
      logger.info('Preloaded OpenAI API key', {
        metadata: {
          success: Boolean(apiKey),
          keyLength: apiKey ? apiKey.length : 0
        }
      });
      
      if (!apiKey) {
        logger.warn('No API key available, will use local mock for testing');
        this.useLocalMock = true;
      }
      
      return apiKey;
    } catch (error) {
      logger.error('Failed to preload API key:', error);
      this.useLocalMock = true;
      return null;
    }
  }

  /**
   * Validate and retrieve OpenAI API key
   * @returns {Promise<string>} API key
   * @throws {APIError} If API key is not configured and local mock is disabled
   */
  async validateAndGetApiKey() {
    try {
      // Use preloaded key if available
      const apiKey = await this._apiKeyPromise;
      logger.debug('Retrieved OpenAI API key', {
        metadata: {
          success: Boolean(apiKey),
          keyLength: apiKey ? apiKey.length : 0
        }
      });
      
      if (!apiKey) {
        if (this.useLocalMock) {
          logger.warn('Using local mock for testing (no API key)');
          return 'mock-api-key';
        }
        
        throw new APIError('OpenAI API key not configured', {
          code: 'ERR_API_KEY_MISSING'
        });
      }
      return apiKey;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError('Failed to retrieve OpenAI API key', {
        code: 'ERR_API_KEY_RETRIEVAL',
        metadata: { originalError: error }
      });
    }
  }

  /**
   * Calculate audio duration from file size
   * @param {Object} fileStats - File stats object
   * @returns {number} Audio duration in seconds
   */
  calculateAudioDuration(fileStats) {
    const fileSize = fileStats.size;
    // Approximate duration in seconds (file size minus WAV header, divided by bytes per second)
    const audioLengthSeconds = (fileSize - 44) / (16000 * 2);
    return audioLengthSeconds;
  }

  /**
   * Generate a cache key for the audio file
   * @param {string} filePath - Path to audio file
   * @returns {Promise<string>} Cache key
   */
  async generateCacheKey(filePath) {
    const stats = await fs.promises.stat(filePath);
    return `whisper:${filePath}:${stats.size}:${stats.mtime.getTime()}`;
  }

  /**
   * Transcribe audio file using Whisper API
   * @param {string} audioFilePath - Path to audio file
   * @param {Object} options - Transcription options
   * @param {boolean} options.useCache - Whether to use cache
   * @param {string} options.language - Language code
   * @param {number} options.temperature - Temperature for model
   * @returns {Promise<Object>} Transcription result
   * @throws {APIError} If transcription fails
   */
  async transcribeAudio(audioFilePath, options = {}) {
    const startTime = Date.now();
    
    // Track total requests
    this.metrics.totalRequests++;
    
    const {
      useCache = true,
      language = 'en',
      temperature = 0.0
    } = options;

    try {
      // Check cache first if enabled
      if (useCache) {
        const cacheKey = await this.generateCacheKey(audioFilePath);
        const cachedResult = this.cache.get('transcribe', { cacheKey });
        if (cachedResult) {
          // Track cache hit
          this.metrics.cacheHits++;
          logger.info('Using cached transcription result');
          
          // Track response time
          this.metrics.lastResponseTime = Date.now() - startTime;
          return cachedResult;
        } else {
          // Track cache miss
          this.metrics.cacheMisses++;
        }
      }

      logger.info('Sending request to Whisper API...');
      
      // OPTIMIZATION: Run file stats and OpenAI client initialization in parallel
      const [fileStats, openai, dictionaryPrompt] = await Promise.all([
        // Get file stats
        fs.promises.stat(audioFilePath),
        
        // Get OpenAI client (potentially from resource cache)
        this.resourceManager.getOpenAIClient().catch(err => {
          logger.error('Failed to get OpenAI client:', err);
          if (this.useLocalMock) {
            logger.warn('Falling back to local mock transcription');
            return null;
          }
          throw err;
        }),
        
        // Generate dictionary prompt for better accuracy
        this.dictionaryService.generateWhisperPrompt().catch(err => {
          logger.warn('Failed to generate dictionary prompt:', err);
          return '';
        })
      ]);
      
      const audioLengthSeconds = this.calculateAudioDuration(fileStats);
      logger.info(`Estimated audio duration: ${audioLengthSeconds.toFixed(2)}s`);
      
      // Use local mock if enabled or OpenAI client is unavailable
      if (this.useLocalMock || !openai) {
        logger.info('Using local mock transcription');
        
        // Simple mock response for testing
        const mockResponse = {
          text: `This is a mock transcription for testing. The audio was approximately ${audioLengthSeconds.toFixed(1)} seconds long.`,
          language: language
        };
        
        // Simulate API delay proportional to audio length
        await new Promise(resolve => setTimeout(resolve, Math.min(500, audioLengthSeconds * 100)));
        
        // Track response time
        const responseTime = Date.now() - startTime;
        this.metrics.lastResponseTime = responseTime;
        this.metrics.totalResponseTime += responseTime;
        
        // Cache the mock result if caching is enabled
        if (useCache) {
          const cacheKey = await this.generateCacheKey(audioFilePath);
          this.cache.set('transcribe', { cacheKey }, mockResponse);
        }
        
        return mockResponse;
      }
      
      // Create file stream
      const fileStream = fs.createReadStream(audioFilePath);
      
      // OPTIMIZATION: Set shorter timeout for short audio clips
      const requestTimeout = Math.max(5000, Math.min(15000, audioLengthSeconds * 500));
      
      // Create API request with optimized parameters
      const response = await openai.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1',
        language,
        prompt: dictionaryPrompt,
        temperature,  // Lower temperature reduces hallucinations
        response_format: 'json'  // Use simple JSON format for faster processing
      }, {
        timeout: requestTimeout // Dynamic timeout based on audio length
      });

      logger.info('Response received from Whisper API');
      
      // Track response time
      const responseTime = Date.now() - startTime;
      this.metrics.lastResponseTime = responseTime;
      this.metrics.totalResponseTime += responseTime;
      
      // Cache the result if caching is enabled
      if (useCache) {
        const cacheKey = await this.generateCacheKey(audioFilePath);
        this.cache.set('transcribe', { cacheKey }, response);
      }
      
      return response;
    } catch (error) {
      // Track errors
      this.metrics.errors++;
      
      logger.error('Error in Whisper API:', error);
      
      // Check for specific error types for better error messages
      let errorMessage = error.message;
      let errorCode = 'ERR_WHISPER_API';
      
      if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again in a moment.';
        errorCode = 'ERR_RATE_LIMIT';
      } else if (error.status === 413) {
        errorMessage = 'Audio file too large for processing.';
        errorCode = 'ERR_FILE_TOO_LARGE';
      } else if (error.status === 400 && error.code === 'audio_too_short') {
        errorMessage = 'Audio file is too short. Minimum audio length is 0.1 seconds.';
        errorCode = 'ERR_AUDIO_TOO_SHORT';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
        errorMessage = 'Network timeout. Check your internet connection and try again.';
        errorCode = 'ERR_NETWORK_TIMEOUT';
      }
      
      throw new APIError(`Whisper API transcription failed: ${errorMessage}`, {
        code: errorCode,
        metadata: { originalError: error }
      });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      cacheStats: this.cache.getStats(),
      metrics: this.metrics,
      averageResponseTime: this.metrics.totalRequests > 0 ? 
        Math.round(this.metrics.totalResponseTime / this.metrics.totalRequests) : 0,
      hitRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.cacheHits / this.metrics.totalRequests * 100).toFixed(1) + '%' : '0%'
    };
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[WhisperAPI] Cache cleared');
  }
}

module.exports = WhisperAPIClient; 