/**
 * WhisperAPIClient - Client for interacting with the OpenAI Whisper API
 * 
 * This module provides a clean interface for transcribing audio using the
 * OpenAI Whisper API, with error handling and performance optimizations.
 */

const fs = require('fs');
const { APIError } = require('../../utils/ErrorManager');
const APICache = require('../utils/APICache');

class WhisperAPIClient {
  constructor(resourceManager, configService, dictionaryService) {
    this.resourceManager = resourceManager;
    this.configService = configService;
    this.dictionaryService = dictionaryService;
    this.cache = new APICache({ ttl: 30 * 60 * 1000 }); // 30 minute cache
  }

  /**
   * Validate and retrieve OpenAI API key
   * @returns {Promise<string>} API key
   * @throws {APIError} If API key is not configured
   */
  async validateAndGetApiKey() {
    const apiKey = await this.configService.getOpenAIApiKey();
    console.log('[WhisperAPI] Retrieved OpenAI API key');
    
    if (!apiKey) {
      throw new APIError('OpenAI API key not configured', {
        code: 'ERR_API_KEY_MISSING'
      });
    }
    return apiKey;
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
          console.log('[WhisperAPI] Using cached transcription result');
          return cachedResult;
        }
      }

      console.log('[WhisperAPI] Sending request to Whisper API...');
      
      // Get file stats
      const fileStats = await fs.promises.stat(audioFilePath);
      const audioLengthSeconds = this.calculateAudioDuration(fileStats);
      console.log(`[WhisperAPI] Estimated audio duration: ${audioLengthSeconds.toFixed(2)}s`);
      
      // Get OpenAI client
      const openai = await this.resourceManager.getOpenAIClient();
      
      // Generate dictionary prompt for better accuracy
      const dictionaryPrompt = await this.dictionaryService.generateWhisperPrompt();
      
      // Create file stream
      const fileStream = fs.createReadStream(audioFilePath);
      
      // Create API request with optimized parameters
      const response = await openai.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1',
        language,
        prompt: dictionaryPrompt,
        temperature,  // Lower temperature reduces hallucinations
        response_format: 'json'  // Use simple JSON format for faster processing
      });

      console.log('[WhisperAPI] Response received');
      
      // Cache the result if caching is enabled
      if (useCache) {
        const cacheKey = await this.generateCacheKey(audioFilePath);
        this.cache.set('transcribe', { cacheKey }, response);
      }
      
      return response;
    } catch (error) {
      console.error('[WhisperAPI] Error details:', error);
      throw new APIError(`Whisper API transcription failed: ${error.message}`, {
        code: 'ERR_WHISPER_API',
        metadata: { originalError: error }
      });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = WhisperAPIClient; 