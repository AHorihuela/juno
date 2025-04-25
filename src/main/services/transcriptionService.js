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
   * Process audio data for transcription and handle the resulting text
   * @param {Buffer} audioData The audio data to transcribe
   * @returns {Promise<boolean>} Success status
   */
  async processAudio(audioData) {
    if (!audioData || audioData.length === 0) {
      logger.warn('No audio data provided for transcription');
      return false;
    }

    try {
      // Start tracking performance
      const startTime = Date.now();
      
      // Get active application for context
      const activeApp = await this.appNameProvider.getActiveAppName().catch(err => {
        logger.warn('Error getting app name during transcription:', err);
        return 'unknown';
      });
      
      logger.info(`Processing audio data (${audioData.length} bytes) from app: ${activeApp}`);
      
      // Transcribe the audio
      const transcribedText = await this.transcribeAudio(audioData);
      
      // Calculate transcription time
      const transcriptionTime = Date.now() - startTime;
      logger.debug(`Transcription completed in ${transcriptionTime}ms: "${transcribedText}"`);
      
      if (!transcribedText || transcribedText.trim() === '') {
        logger.warn('Transcription returned empty text');
        this.notify('No text was transcribed', 'warning');
        return false;
      }
      
      // Process the transcribed text
      const result = await this.processAndInsertText(transcribedText);
      
      // Calculate total processing time
      const totalTime = Date.now() - startTime;
      logger.info(`Total processing time: ${totalTime}ms (transcription: ${transcriptionTime}ms)`);
      
      return result;
    } catch (error) {
      logger.error('Error processing audio:', error);
      this.notify(`Error processing audio: ${error.message}`, 'error');
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Process transcribed text and insert the result
   * Handles special commands (AI, etc.) and regular text
   * @param {string} transcribedText The text to process
   * @returns {Promise<boolean>} Success status
   */
  async processAndInsertText(transcribedText) {
    if (!transcribedText) {
      return false;
    }
    
    try {
      const normalizedText = transcribedText.trim();
      logger.debug(`Processing transcribed text: "${normalizedText}"`);
      
      // Check if this is an AI command
      const aiService = this.services.get('ai');
      if (aiService && await aiService.isAICommand(normalizedText)) {
        logger.info('AI command detected, processing...');
        
        // Get selection service 
        const selectionService = this.services.get('selection');
        
        // Get highlighted text for context if available
        const selectedText = await selectionService?.getSelectedText().catch(err => {
          logger.warn('Failed to get selected text for AI context:', err);
          return '';
        });
        
        logger.debug(`Selected text for AI context: ${selectedText ? 
          `"${selectedText.substring(0, 30)}..." (${selectedText.length} chars)` : 
          'none'}`);
          
        // Process AI request
        const aiResponse = await aiService.processRequest(normalizedText, selectedText);
        if (aiResponse) {
          logger.info('Inserting AI response');
          await this.insertText(aiResponse);
          return true;
        } else {
          logger.warn('AI processing returned empty response');
          this.notify('AI returned no response', 'warning');
          return false;
        }
      } else {
        // This is regular text, just insert it
        logger.info('Inserting regular transcribed text');
        await this.insertText(normalizedText);
        return true;
      }
    } catch (error) {
      logger.error('Error processing transcribed text:', error);
      this.notify(`Error processing text: ${error.message}`, 'error');
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Insert text at the current cursor position
   * @param {string} text The text to insert
   * @returns {Promise<boolean>} Success status
   */
  async insertText(text) {
    try {
      if (!text) {
        return false;
      }
      
      const textInsertionService = this.services.get('textInsertion');
      if (!textInsertionService) {
        throw new Error('Text insertion service not available');
      }
      
      logger.debug(`Inserting text: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
      await textInsertionService.insertText(text);
      
      return true;
    } catch (error) {
      logger.error('Error inserting text:', error);
      this.notify(`Failed to insert text: ${error.message}`, 'error');
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Display a notification
   * @param {string} message Notification message
   * @param {string} type Notification type (info, warning, error)
   */
  notify(message, type = 'info') {
    try {
      const notificationService = this.services.get('notification');
      if (notificationService) {
        notificationService.show({
          title: 'Transcription',
          body: message,
          type: type
        });
      }
    } catch (error) {
      logger.error('Error showing notification:', error);
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