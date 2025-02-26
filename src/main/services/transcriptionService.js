/**
 * A stub implementation of the transcription service.
 * This will be replaced with actual Whisper API integration later.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const BaseService = require('./BaseService');
const { detectAICommand, logCommandDetection } = require('../utils/commandDetection');
const AudioUtils = require('./utils/AudioUtils');
const WhisperAPIClient = require('./api/WhisperAPIClient');
const { APIError, ErrorManager } = require('../utils/ErrorManager');
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
    // Nothing to clean up
    logger.debug('Shutting down TranscriptionService');
  }

  /**
   * Clean up temporary file
   * @param {string} filePath - Path to file to delete
   */
  async cleanupTempFile(filePath) {
    return AudioUtils.cleanupTempFile(filePath);
  }

  /**
   * Process transcribed text
   * @param {string} text - Raw transcribed text
   * @returns {Object} Processing result with text and metadata
   */
  async processText(text) {
    logger.debug('Processing transcribed text', { metadata: { text } });
    
    if (!text || text.trim() === '') {
      logger.debug('Empty text, skipping processing');
      return {
        text: '',
        isAICommand: false,
        confidence: 0
      };
    }
    
    try {
      // Check if this is an AI command
      const commandDetection = await detectAICommand(text);
      const isAICommand = commandDetection.isCommand;
      
      // Log command detection for analytics
      await logCommandDetection(text, commandDetection);
      
      if (isAICommand && commandDetection.confidenceScore >= 0.8) {
        logger.info('AI command detected with confidence', { 
          metadata: { 
            confidence: commandDetection.confidenceScore,
            command: commandDetection.command
          }
        });
        
        return {
          text: commandDetection.command,
          isAICommand: true,
          confidence: commandDetection.confidenceScore
        };
      } else if (isAICommand && commandDetection.confidenceScore >= 0.5) {
        logger.info('Possible AI command detected, needs confirmation', {
          metadata: { 
            confidence: commandDetection.confidenceScore,
            command: commandDetection.command
          }
        });
      } else {
        logger.debug('Not an AI command, treating as normal transcription');
      }
      
      return {
        text,
        isAICommand: false,
        confidence: 0
      };
    } catch (error) {
      logger.error('Error processing text', { metadata: { error } });
      return {
        text,
        isAICommand: false,
        confidence: 0,
        error
      };
    }
  }

  /**
   * Process transcribed text and insert it into the active text field
   * @param {string} text - Raw transcribed text
   * @returns {Promise<void>}
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

      // Get selected text if any - use the optimized selection service
      const selectionService = this.getService('selection');
      const highlightedText = await selectionService.getSelectedText();
      logger.debug('Selected text:', highlightedText);
      
      // Preload app name for future operations
      selectionService.preloadAppName().catch(err => {
        logger.error('Error preloading app name:', err);
      });
      
      // Store the highlighted text in context service for future reference
      const contextService = this.getService('context');
      if (highlightedText) {
        await contextService.startRecording(highlightedText);
      }

      // First check if this is an AI command
      const aiService = this.getService('ai');
      isAICommand = await aiService.isAICommand(text);
      logger.debug('Is AI command:', isAICommand);

      if (isAICommand) {
        try {
          // Show processing notification
          this.getService('notification').showNotification({
            title: 'Processing AI Command',
            body: 'Analyzing context and preparing response...',
            type: 'info',
            timeout: 2000
          });
          
          logger.info('Processing as AI command');
          const aiResponse = await aiService.processCommand(text, highlightedText);
          
          // Check if the AI request was cancelled or failed
          if (!aiResponse) {
            logger.info('AI request was cancelled or failed');
            return '';
          }
          
          logger.info('AI response:', aiResponse);
          
          // Show context usage feedback
          if (aiResponse.contextUsed) {
            this.showContextUsageFeedback(aiResponse.contextUsed);
          }
          
          // Insert the AI response
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
            type: 'warning'
          });
          
          // Update error stats
          this.processingStats.errorCount++;
          
          // Continue with normal processing below
        }
      }

      // If not an AI command or AI processing failed, proceed with normal text processing
      logger.info('Processing as normal text');

      // First apply dictionary processing
      const dictionaryProcessed = await this.getService('dictionary').processTranscribedText(text);
      logger.debug('After dictionary processing:', dictionaryProcessed);

      // Then continue with other text processing
      const textProcessing = this.getService('textProcessing');
      const processed = textProcessing.processText(dictionaryProcessed);
      logger.debug('Final processed text:', processed);

      // Insert the processed text
      await this.getService('textInsertion').insertText(processed, highlightedText);
      
      // Update stats
      this.processingStats.normalTranscriptionCount++;
      
      return processed;
    } catch (error) {
      logger.error('Error in processAndInsertText:', error);
      
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
      this.updateProcessingStats(processingTime, isAICommand);
      
      logger.info('Processing completed in', processingTime, 'ms');
    }
  }
  
  /**
   * Show feedback about context usage
   * @param {Object} contextUsage - Context usage information
   * @private
   */
  showContextUsageFeedback(contextUsage) {
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
        timeout: 3000
      });
    }
  }
  
  /**
   * Update processing time statistics
   * @param {number} processingTime - Time taken to process in ms
   * @param {boolean} isAICommand - Whether this was an AI command
   * @private
   */
  updateProcessingStats(processingTime, isAICommand) {
    this.processingStats.lastProcessingTime = processingTime;
    this.processingStats.processedCount++;
    
    // Update average processing time with exponential moving average
    if (this.processingStats.processedCount === 1) {
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
  
  /**
   * Get processing statistics
   * @returns {Object} Processing statistics
   */
  getProcessingStats() {
    return {
      ...this.processingStats,
      timestamp: Date.now()
    };
  }

  /**
   * Prepare audio data for transcription
   * @param {Buffer} audioBuffer - Raw audio buffer
   * @returns {Promise<Buffer>} WAV formatted audio data
   */
  async prepareAudioData(audioBuffer) {
    logger.info('Converting PCM to WAV format...');
    // Use synchronous conversion to reduce overhead
    return AudioUtils.convertPcmToWav(audioBuffer);
  }

  /**
   * Create and write temporary WAV file
   * @param {Buffer} wavData - WAV formatted audio data
   * @returns {Promise<string>} Path to temporary file
   */
  async createTempFile(wavData) {
    return AudioUtils.createTempFile(wavData);
  }

  /**
   * Log transcription metrics and changes
   * @param {string} originalText - Raw transcribed text
   * @param {string} processedText - Processed text
   */
  async logTranscriptionMetrics(originalText, processedText) {
    // Get dictionary stats
    const dictStats = this.getService('dictionary').getStats();
    
    // Log effectiveness summary
    logger.info('\nDictionary effectiveness summary:');
    logger.info('  - Dictionary size:', dictStats.dictionarySize, 'words');
    logger.info('  - Exact match rate:', dictStats.effectiveness.exactMatchRate);
    logger.info('  - Fuzzy match rate:', dictStats.effectiveness.fuzzyMatchRate);
    logger.info('  - Unmatched rate:', dictStats.effectiveness.unmatchedRate);
    
    // Compare original vs processed
    if (originalText !== processedText) {
      logger.info('\nText changes:');
      logger.info('  Original:', originalText);
      logger.info('  Processed:', processedText);
    }
  }

  /**
   * Learn from successful transcriptions by adding frequently used words to the dictionary
   * This feature is currently disabled to rely solely on user-added dictionary terms
   * @param {string} transcribedText - The successfully transcribed text
   * @private
   */
  async _learnFromTranscription(transcribedText) {
    // Automatic word learning is disabled
    logger.info('Automatic word learning is disabled');
    return;
    
    // The code below is kept for reference but will not execute
    /*
    if (!transcribedText || typeof transcribedText !== 'string' || transcribedText.trim().length === 0) {
      return;
    }
    
    try {
      // Get dictionary service
      const dictionaryService = this.getService('dictionary');
      if (!dictionaryService) {
        logger.info('Dictionary service not available for learning');
        return;
      }
      
      // Get existing dictionary words
      const existingWords = new Set(await dictionaryService.getAllWords());
      
      // Extract potential words to learn (proper nouns, unusual words)
      const words = transcribedText
        .split(/\s+/)
        .map(word => word.replace(/[.,!?;:'"()]/g, '').trim())
        .filter(word => word.length > 0);
      
      // Look for proper nouns (capitalized words not at the start of sentences)
      const properNouns = words
        .filter((word, index) => {
          // If it's the first word, check if it's capitalized
          if (index === 0) {
            return word.length > 1 && /^[A-Z][a-z]+$/.test(word);
          }
          
          // For other words, it's likely a proper noun if capitalized
          return /^[A-Z][a-z]+$/.test(word);
        })
        .filter(word => !existingWords.has(word));
      
      // Add proper nouns to dictionary
      for (const word of properNouns) {
        logger.info('Learning new proper noun:', word);
        await dictionaryService.addWord(word);
      }
      
      logger.info('Learning complete:', properNouns.length, 'new words added to dictionary');
    } catch (error) {
      logger.error('Error learning from transcription:', error);
      // Continue without learning if there's an error
    }
    */
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
    
    try {
      if (!this.initialized) {
        throw new Error('TranscriptionService not initialized');
      }

      // Start preparing audio data immediately
      const wavDataPromise = this.prepareAudioData(audioBuffer);
      
      // Show initial notification while processing
      this.getService('notification').showNotification({
        title: 'Processing Audio',
        body: 'Preparing your recording...',
        type: 'info',
        timeout: 2000
      });
      
      // Wait for audio data preparation
      const wavData = await wavDataPromise;
      tempFile = await this.createTempFile(wavData);

      // Make API request using the WhisperAPIClient
      const response = await this.apiClient.transcribeAudio(tempFile, {
        useCache: true,
        language: 'en',
        temperature: 0.0
      });
      
      const transcribedText = response.text;
      
      // If transcription is empty, show notification and return early
      if (!transcribedText || transcribedText.trim() === '') {
        logger.info('Empty transcription received, skipping processing');
        this.getService('notification').showNotification({
          title: 'No Speech Detected',
          body: 'The recording contained no recognizable speech.',
          type: 'info',
          timeout: 2000
        });
        return '';
      }
      
      // Process the transcribed text in parallel with showing notification
      const processTextPromise = this.processAndInsertText(transcribedText);
      
      this.getService('notification').showNotification({
        title: 'Transcription Complete',
        body: 'Processing transcribed text...',
        type: 'success',
        timeout: 2000
      });

      // Wait for text processing to complete
      const processedText = await processTextPromise;
      
      // Automatic word learning is disabled - this call is kept for compatibility
      this._learnFromTranscription(transcribedText).catch(err => {
        logger.error('Error in learning process:', err);
      });

      // Log metrics in the background without waiting
      this.logTranscriptionMetrics(transcribedText, processedText).catch(err => {
        logger.error('Error logging metrics:', err);
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
        body: error instanceof APIError 
          ? `API Error: ${error.message}` 
          : 'Failed to transcribe audio. Please try again.',
        type: 'error',
        timeout: 3000
      });
      
      throw error;
    } finally {
      // Clean up temp file if it was created
      if (tempFile) {
        this.cleanupTempFile(tempFile).catch(err => {
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
      logger.info('API cache cleared');
    }
  }

  /**
   * Update processing statistics with new processing time
   * @param {number} processingTime - Time taken to process in milliseconds
   * @private
   */
  _updateProcessingStats(processingTime) {
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