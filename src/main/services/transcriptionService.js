/**
 * TranscriptionService - Orchestrator for audio transcription functionality
 * 
 * This service coordinates the process of recording, transcribing, and processing
 * audio input for dictation and AI commands.
 */
const BaseService = require('./BaseService');
const WhisperAPIClient = require('./api/WhisperAPIClient');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('TranscriptionService');

class TranscriptionService extends BaseService {
  constructor() {
    super('Transcription');
    
    // Performance tracking
    this.processingStats = {
      lastProcessingTime: 0,
      averageProcessingTime: 0,
      processedCount: 0,
      aiCommandCount: 0,
      normalTranscriptionCount: 0,
      errorCount: 0
    };
    
    this.apiClient = null;
    
    // OPTIMIZATION: Cache small audio samples to avoid repeated API calls
    this.audioSignatureCache = new Map();
    this.cacheMaxSize = 10; // Maximum number of cached entries
    
    // OPTIMIZATION: Reduce timeouts for faster user feedback
    this.timeouts = {
      apiRequest: 10000,  // 10 seconds max for API request
      processing: 5000    // 5 seconds max for text processing
    };
  }

  async _initialize() {
    // Initialize the WhisperAPIClient
    this.apiClient = new WhisperAPIClient(
      this.getService('resource'),
      this.getService('config'),
      this.getService('dictionary')
    );
    logger.info('Initialized WhisperAPIClient');
  }

  async _shutdown() {
    logger.debug('Shutting down TranscriptionService');
  }

  /**
   * Process transcribed text and insert it into the active text field
   * @param {string} text - Raw transcribed text
   * @returns {Promise<string>} Processed text
   */
  async processAndInsertText(text) {
    const startTime = Date.now();
    let isAICommand = false;
    
    try {
      if (!this.initialized) {
        throw new Error('TranscriptionService not initialized');
      }

      logger.info('Starting text processing pipeline');
      logger.debug('Raw text:', text);

      // Skip processing if text is empty or just whitespace
      if (!text || !text.trim()) {
        logger.debug('Empty text, skipping processing');
        return '';
      }

      // OPTIMIZATION: Start multiple operations in parallel
      // 1. Start getting selected text
      const selectionService = this.getService('selection');
      const highlightedTextPromise = selectionService.getSelectedText();
      
      // 2. Start AI command detection in parallel
      const aiService = this.getService('ai');
      const isAICommandPromise = aiService.isAICommand(text);
      
      // 3. Start preloading app name (this helps with text insertion speed later)
      const preloadAppNamePromise = selectionService.preloadAppName()
        .catch(err => {
          logger.error('Error preloading app name:', err);
        });
      
      // 4. Start dictionary processing (often slow) in parallel
      const dictionaryPromise = this.getService('dictionary')
        .processTranscribedText(text)
        .catch(err => {
          logger.error('Error in dictionary processing, using raw text:', err);
          return text; // Fallback to raw text
        });
      
      // Wait for selected text result
      const highlightedText = await highlightedTextPromise;
      logger.debug('Selected text:', highlightedText ? 
        `${highlightedText.substring(0, 100)}... (${highlightedText.length} chars)` : 'none');
      
      // Store the highlighted text in context service for future reference
      if (highlightedText) {
        const contextService = this.getService('context');
        await contextService.startRecording(highlightedText);
        logger.info('Stored highlighted text in context service:', {
          metadata: {
            length: highlightedText.length,
            preview: highlightedText.substring(0, 50) + '...'
          }
        });
      }

      // Check if this is an AI command (should now be ready)
      isAICommand = await isAICommandPromise;
      logger.debug('Is AI command:', isAICommand);

      if (isAICommand) {
        const result = await this._processAICommand(text, highlightedText);
        if (result) return result;
        // If AI processing fails, we'll fall back to normal text processing below
      }

      // If not an AI command or AI processing failed, proceed with normal text processing
      logger.info('Processing as normal text');

      // First apply dictionary processing (should already be in progress)
      const dictionaryProcessed = await dictionaryPromise;
      logger.debug('After dictionary processing:', dictionaryProcessed);

      // Then continue with other text processing
      const textProcessing = this.getService('textProcessing');
      const processed = textProcessing.processText(dictionaryProcessed);
      logger.debug('Final processed text:', processed);

      // Wait for appName preloading to finish (improves insertion performance)
      await preloadAppNamePromise;

      // Insert the processed text - pass the highlighted text for replacement
      await this.getService('textInsertion').insertText(processed, highlightedText);
      
      // Update stats
      this.processingStats.normalTranscriptionCount++;
      
      return processed;
    } catch (error) {
      logger.error('Error in processAndInsertText:', {
        error,
        name: error.name,
        message: error.message,
        stack: error.stack,
        // Add more detailed diagnostics
        textProcessed: typeof processed !== 'undefined',
        textLength: text?.length || 0,
        highlightedTextLength: highlightedText?.length || 0,
        isAICommand: isAICommand,
        elapsed: Date.now() - startTime
      });
      
      // Show notification to user
      this.getService('notification').showNotification({
        title: 'Text Processing Failed',
        body: 'Failed to process and insert text.',
        type: 'error'
      });
      
      // Update error stats
      this.processingStats.errorCount++;
      
      throw this.emitError(error);
    } finally {
      // Always stop recording context when done
      this.getService('context').stopRecording();
      
      // Update processing time stats
      const processingTime = Date.now() - startTime;
      this._updateProcessingStats(processingTime, isAICommand);
      
      logger.info('Processing completed in', processingTime, 'ms');
    }
  }
  
  /**
   * Process text as an AI command
   * @param {string} text - Raw text
   * @param {string} highlightedText - Selected text
   * @returns {Promise<string|null>} Processed text or null if processing failed
   * @private
   */
  async _processAICommand(text, highlightedText) {
    try {
      // Show processing notification with faster timeout
      this.getService('notification').showNotification({
        title: 'Processing AI Command',
        body: 'Analyzing context...',
        type: 'info',
        timeout: 1500  // Reduced from 2000
      });
      
      logger.info('Processing as AI command');
      
      const aiService = this.getService('ai');
      // Set a timeout for AI processing
      const aiProcessingPromise = aiService.processCommand(text, highlightedText);
      
      // Add timeout to prevent hanging on slow AI responses
      const aiResponse = await Promise.race([
        aiProcessingPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI processing timeout')), this.timeouts.processing)
        )
      ]).catch(err => {
        logger.error('AI processing timed out or failed:', err);
        return null; // Return null to fall back to normal processing
      });
      
      // Check if the AI request was cancelled or failed
      if (!aiResponse) {
        logger.info('AI request was cancelled, timed out, or failed');
        
        // Fall back to normal text processing
        this.getService('notification').showNotification({
          title: 'AI Processing Failed',
          body: 'Falling back to normal transcription.',
          type: 'warning',
          timeout: 1500
        });
        
        return null; // Signal to fall back to normal processing
      }
      
      logger.info('AI response received:', {
        metadata: {
          responseLength: aiResponse.text ? aiResponse.text.length : 0,
          hasHighlight: Boolean(aiResponse.hasHighlight),
          originalCommand: aiResponse.originalCommand
        }
      });
      
      // Show context usage feedback
      if (aiResponse.contextUsed) {
        this._showContextUsageFeedback(aiResponse.contextUsed);
      }
      
      // Insert the AI response, passing highlighted text for replacement
      await this.getService('textInsertion').insertText(aiResponse.text, highlightedText);
      
      // Update stats
      this.processingStats.aiCommandCount++;
      
      return aiResponse.text;
    } catch (aiError) {
      logger.error('Error processing AI command:', aiError);
      
      // Fall back to normal text processing if AI fails
      logger.info('Falling back to normal text processing due to AI error');
      
      // Show notification to user
      this.getService('notification').showNotification({
        title: 'AI Processing Failed',
        body: 'Falling back to normal transcription.',
        type: 'warning',
        timeout: 1500
      });
      
      // Update error stats
      this.processingStats.errorCount++;
      
      return null; // Signal to fall back to normal processing
    }
  }
  
  /**
   * Show feedback about context usage
   * @param {Object} contextUsage - Context usage information
   * @private
   */
  _showContextUsageFeedback(contextUsage) {
    // Only show if we have meaningful context
    if (contextUsage && contextUsage.contextSize > 0) {
      const title = 'AI Response Ready';
      let body = `Generated using ${contextUsage.contextSizeFormatted}`;
      
      if (contextUsage.applicationName) {
        body += ` from ${contextUsage.applicationName}`;
      }
      
      this.getService('notification').showNotification({
        title,
        body,
        type: 'success',
        timeout: 2000 // Reduced from 3000 for faster UX
      });
    }
  }

  /**
   * Calculate a simple audio signature for caching
   * @param {Buffer} audioBuffer - Raw audio buffer 
   * @returns {string} Audio signature
   * @private
   */
  _calculateAudioSignature(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) return '';
    
    // Calculate a simple signature based on buffer size and first few bytes
    const sampleSize = Math.min(audioBuffer.length, 1000);
    let signature = `size:${audioBuffer.length}`;
    
    // Add first 100 bytes sampled every 10 bytes
    for (let i = 0; i < sampleSize; i += 10) {
      signature += `:${audioBuffer[i]}`;
    }
    
    return signature;
  }

  /**
   * Main transcription function
   * @param {Buffer} audioBuffer - Raw audio buffer to transcribe
   * @param {string} highlightedText - Currently highlighted text (if any)
   * @returns {Promise<string>} Transcribed and processed text
   */
  async transcribeAudio(audioBuffer, highlightedText = '') {
    const startTime = Date.now();
    let tempFile = null;
    const AudioUtils = require('./utils/AudioUtils');
    
    try {
      if (!this.initialized) {
        throw new Error('TranscriptionService not initialized');
      }

      // OPTIMIZATION: Check audio cache based on signature
      const audioSignature = this._calculateAudioSignature(audioBuffer);
      if (audioSignature && this.audioSignatureCache.has(audioSignature)) {
        // We found a cached response for similar audio
        logger.info('Found cached transcription for similar audio');
        const cachedText = this.audioSignatureCache.get(audioSignature);
        
        // Fast path: Skip API call and process text directly
        this.getService('notification').showNotification({
          title: 'Using cached transcription',
          body: 'Processing text...',
          type: 'success',
          timeout: 800
        });
        
        // Process the cached text
        await this.processAndInsertText(cachedText);
        return cachedText;
      }

      // OPTIMIZATION: Start multiple operations in parallel
      // 1. Prepare audio data
      const wavDataPromise = AudioUtils.convertPcmToWav(audioBuffer);
      
      // 2. Show initial notification
      this.getService('notification').showNotification({
        title: 'Processing Audio',
        body: 'Preparing your recording...',
        type: 'info',
        timeout: 1000 // Reduced from 1500
      });
      
      // 3. Preload app name for future operations (improves text insertion speed later)
      const selectionService = this.getService('selection');
      const preloadAppNamePromise = selectionService.preloadAppName().catch(err => {
        logger.error('Error preloading app name:', err);
      });
      
      // Wait for audio data preparation
      const wavData = await wavDataPromise;
      tempFile = await AudioUtils.createTempFile(wavData);

      // Make API request using the WhisperAPIClient with timeout
      const apiPromise = this.apiClient.transcribeAudio(tempFile, {
        useCache: true,
        language: 'en',
        temperature: 0.0,
        response_format: 'json' // Ensure we get JSON for faster parsing
      });
      
      // Add timeout to the API call to prevent hanging
      const response = await Promise.race([
        apiPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Whisper API timeout')), this.timeouts.apiRequest)
        )
      ]);
      
      const transcribedText = response.text;
      
      // Cache the transcription result for similar audio
      if (audioSignature && transcribedText) {
        // Add to cache
        this.audioSignatureCache.set(audioSignature, transcribedText);
        
        // Limit cache size
        if (this.audioSignatureCache.size > this.cacheMaxSize) {
          // Remove oldest entry
          const firstKey = this.audioSignatureCache.keys().next().value;
          this.audioSignatureCache.delete(firstKey);
        }
      }
      
      // Wait for app name preloading to complete
      await preloadAppNamePromise;
      
      // If transcription is empty, show notification and return early
      if (!transcribedText || transcribedText.trim() === '') {
        logger.info('Empty transcription received, skipping processing');
        this.getService('notification').showNotification({
          title: 'No Speech Detected',
          body: 'The recording contained no recognizable speech.',
          type: 'info',
          timeout: 1500
        });
        return '';
      }
      
      // Process the transcribed text with faster notification
      const processTextPromise = this.processAndInsertText(transcribedText);
      
      // Show minimal notification
      this.getService('notification').showNotification({
        title: 'Transcribing',
        body: 'Processing text...',
        type: 'success',
        timeout: 1000 // Reduced from 1500
      });

      // Wait for text processing to complete
      const processedText = await processTextPromise;
      
      // OPTIMIZATION: Do these operations in the background without waiting
      Promise.all([
        // 1. Clean up temp file
        AudioUtils.cleanupTempFile(tempFile).catch(err => {
          logger.error('Error cleaning up temp file:', err);
        })
      ]).catch(err => {
        logger.error('Error in background cleanup tasks:', err);
      });
      
      // Log performance
      const totalTime = Date.now() - startTime;
      logger.info(`Total processing time: ${totalTime}ms`);

      return processedText;
    } catch (error) {
      logger.error('Error in transcription:', error);
      
      // Update error stats
      this.processingStats.errorCount++;
      
      // Show error notification
      this.getService('notification').showNotification({
        title: 'Transcription Failed',
        body: error.name === 'APIError'
          ? `API Error: ${error.message}` 
          : 'Failed to transcribe audio. Please try again.',
        type: 'error',
        timeout: 2000
      });
      
      throw error;
    } finally {
      // Clean up temp file if not already done in the background
      if (tempFile) {
        AudioUtils.cleanupTempFile(tempFile).catch(err => {
          logger.error('Error cleaning up temp file:', err);
        });
      }
      
      // Update processing stats
      this._updateProcessingStats(Date.now() - startTime);
    }
  }
  
  /**
   * Get API client cache statistics
   * @returns {Object} Cache statistics
   */
  getAPIStats() {
    if (!this.apiClient) {
      return { initialized: false };
    }
    return this.apiClient.getCacheStats();
  }
  
  /**
   * Clear API client cache
   */
  clearAPICache() {
    if (this.apiClient) {
      this.apiClient.clearCache();
      this.audioSignatureCache.clear();
      logger.info('API and audio caches cleared');
    }
  }

  /**
   * Get processing statistics
   * @returns {Object} Processing statistics
   */
  getProcessingStats() {
    return {
      lastTime: this.processingStats.lastProcessingTime,
      averageTime: Math.round(this.processingStats.averageProcessingTime),
      processedCount: this.processingStats.processedCount,
      aiCommandCount: this.processingStats.aiCommandCount,
      normalCount: this.processingStats.normalTranscriptionCount,
      errorCount: this.processingStats.errorCount
    };
  }

  /**
   * Update processing statistics with new processing time
   * @param {number} processingTime - Time taken to process in milliseconds
   * @param {boolean} isAICommand - Whether this was an AI command
   * @private
   */
  _updateProcessingStats(processingTime, isAICommand) {
    this.processingStats.lastProcessingTime = processingTime;
    this.processingStats.processedCount++;
    
    // Update average processing time with weighted average
    if (this.processingStats.processedCount === 1) {
      // First processing, just set the average
      this.processingStats.averageProcessingTime = processingTime;
    } else {
      // Use a weight of 0.2 for the new value
      this.processingStats.averageProcessingTime = 
        0.8 * this.processingStats.averageProcessingTime + 
        0.2 * processingTime;
    }
    
    logger.info('Updated processing stats:', {
      lastTime: processingTime,
      avgTime: this.processingStats.averageProcessingTime,
      count: this.processingStats.processedCount,
      aiCount: this.processingStats.aiCommandCount,
      normalCount: this.processingStats.normalTranscriptionCount,
      errorCount: this.processingStats.errorCount
    });
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TranscriptionService(); 