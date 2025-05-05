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

console.log('[TranscriptionService] Module loaded');

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
    
    // Initialize AppNameProvider
    try {
      // Try to get it from the SelectionService first
      const selectionService = this.getService('selection');
      if (selectionService && selectionService.appNameProvider) {
        this.appNameProvider = selectionService.appNameProvider;
        logger.info('Using AppNameProvider from SelectionService');
      } else {
        // If not available, initialize our own instance
        const AppNameProvider = require('./selection/AppNameProvider');
        this.appNameProvider = new AppNameProvider();
        logger.info('Initialized standalone AppNameProvider');
      }
    } catch (error) {
      logger.error('Failed to initialize AppNameProvider:', error);
      // Create a fallback provider that always returns 'unknown'
      this.appNameProvider = {
        getActiveAppName: async () => 'unknown'
      };
      logger.info('Using fallback AppNameProvider');
    }
    
    // Listen for text insertion events from TextInsertionService
    try {
      const textInsertionService = this.getService('textInsertion');
      if (textInsertionService) {
        textInsertionService.on('textInserted', (result) => {
          logger.debug('Received textInserted event:', { metadata: result });
          
          // If the insertion failed but we want to suppress error sound,
          // emit our own event to let others know
          if (result && !result.success && result.suppressErrorSound) {
            this.emit('insertFailed', { 
              suppressErrorSound: true,
              length: result.length
            });
          }
        });
        logger.info('Set up text insertion event listener');
      }
    } catch (error) {
      logger.warn('Error setting up text insertion event listener:', error);
    }
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
      
      // Enable audio feedback for the next sounds
      try {
        const audioService = this.getService('audio');
        if (audioService && typeof audioService.enableAudio === 'function') {
          audioService.enableAudio();
          logger.debug('Enabled audio feedback for transcription process');
        }
      } catch (audioError) {
        logger.warn('Error enabling audio feedback:', audioError);
        // Continue even if enabling audio fails
      }
      
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
      
      // Add a flag to suppress error sound for any error coming from 
      // the audio processing pipeline, since the stop sound already played
      error.suppressErrorSound = true;
      
      this.notify(`Error processing audio: ${error.message}`, 'error');
      this.emit('error', error);
      return false;
    } finally {
      // Disable audio feedback after processing completes
      // This ensures no unexpected sounds play after the processing is done
      try {
        const audioService = this.getService('audio');
        if (audioService && typeof audioService.disableAudio === 'function') {
          // Increase wait time to ensure insertion has completed before disabling audio
          // This prevents race conditions where audio is disabled before text insertion completes
          setTimeout(() => {
            audioService.disableAudio();
            logger.debug('Disabled audio feedback after transcription process');
          }, 2000); // Increased from 1000ms to 2000ms
        }
      } catch (audioError) {
        logger.warn('Error disabling audio feedback:', audioError);
      }
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
      logger.warn('No transcribed text to process');
      return false;
    }
    
    try {
      const normalizedText = transcribedText.trim();
      logger.debug(`Processing transcribed text: "${normalizedText.substring(0, 50)}${normalizedText.length > 50 ? '...' : ''}"`);
      
      // OPTIMIZATION: Initialize services in parallel rather than sequentially
      const [aiService, textInsertionService, selectionService] = await Promise.all([
        Promise.resolve(this.getService('ai')),
        Promise.resolve(this.getService('textInsertion')),
        Promise.resolve(this.getService('selection'))
      ]);
      
      logger.debug(`Service availability check: AI=${Boolean(aiService)}, TextInsertion=${Boolean(textInsertionService)}, Selection=${Boolean(selectionService)}`);
      
      // Check if this is an AI command - run async and non-blocking 
      const isAICommand = aiService ? await aiService.isAICommand(normalizedText) : false;
      
      if (aiService && isAICommand) {
        logger.info('AI command detected, processing...');
        
        // OPTIMIZATION: Start getting selected text in parallel with preparing AI services
        const selectedTextPromise = this._getSelectedTextSafely(selectionService);
        
        // Prepare AI processing - do this while we're getting the selected text
        const aiProcessMethod = typeof aiService.processCommand === 'function' 
          ? 'processCommand' 
          : (typeof aiService.processRequest === 'function' ? 'processRequest' : null);
        
        if (!aiProcessMethod) {
          logger.error('AI service has no valid processing method');
          this.notify('AI service misconfigured', 'error');
          return false;
        }
        
        // Now wait for selected text
        const selectedText = await selectedTextPromise;
          
        try {
          // Log the values being passed
          logger.debug(`Calling AI service ${aiProcessMethod} with:`, {
            command: normalizedText,
            hasSelectedText: Boolean(selectedText),
            selectedTextLength: selectedText ? selectedText.length : 0
          });
          
          const aiResponse = await aiService[aiProcessMethod](normalizedText, selectedText);
          
          if (aiResponse) {
            // Check if the response is a string or an object
            let responseText = aiResponse;
            
            // Handle response object format (from newer AI service versions)
            if (typeof aiResponse === 'object' && aiResponse !== null) {
              responseText = aiResponse.text || aiResponse.response || '';
            }
            
            if (responseText) {
              logger.info('AI response received, inserting text');
              
              // OPTIMIZATION: Add response to history in parallel with text insertion
              await Promise.all([
                this.insertText(responseText),
                this._addToHistoryInBackground(responseText, true) // true for AI response
              ]);
              
              return true;
            } else {
              logger.warn('AI processing returned empty response');
              this.notify('AI returned no response', 'warning');
              return false;
            }
          } else {
            logger.warn('AI processing returned null response');
            this.notify('AI returned no response', 'warning');
            return false;
          }
        } catch (aiError) {
          logger.error('Error processing AI request:', { 
            metadata: { 
              error: aiError.message, 
              stack: aiError.stack 
            } 
          });
          this.notify(`AI error: ${aiError.message}`, 'error');
          return false;
        }
      } else {
        // This is regular text, just insert it
        logger.info('Inserting regular transcribed text');
        
        if (!textInsertionService) {
          logger.error('Text insertion service not available');
          this.notify('Text insertion service not available', 'error');
          return false;
        }
        
        try {
          // OPTIMIZATION: Add to history in parallel with text insertion
          const [insertionResult] = await Promise.all([
            this.insertText(normalizedText),
            this._addToHistoryInBackground(normalizedText, false) // false for regular text
          ]);
          
          logger.debug(`Text insertion result: ${insertionResult}`);
          return insertionResult;
        } catch (insertionError) {
          logger.error('Error during text insertion:', { 
            metadata: { 
              error: insertionError.message, 
              stack: insertionError.stack 
            } 
          });
          this.notify(`Text insertion failed: ${insertionError.message}`, 'error');
          return false; 
        }
      }
    } catch (error) {
      logger.error('Error processing transcribed text:', { 
        metadata: { 
          error: error.message, 
          stack: error.stack 
        } 
      });
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
    const startTime = Date.now();
    try {
      if (!text) {
        logger.warn('No text provided for insertion');
        return false;
      }
      
      const textInsertionService = this.getService('textInsertion');
      if (!textInsertionService) {
        logger.error('Text insertion service not available');
        throw new Error('Text insertion service not available');
      }
      
      logger.debug(`Inserting text: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}" (${text.length} chars)`);
      
      // Check if the service methods exist
      if (typeof textInsertionService.insertText !== 'function') {
        logger.error('Text insertion service missing insertText method');
        throw new Error('Text insertion service missing insertText method');
      }
      
      // Retry mechanism for text insertion
      let attempts = 0;
      const maxAttempts = 2;
      let lastError = null;
      
      while (attempts < maxAttempts) {
        try {
          // Call the insertText method with detailed logging
          logger.debug(`Calling textInsertionService.insertText (attempt ${attempts + 1}/${maxAttempts})`);
          const insertStartTime = Date.now();
          const result = await textInsertionService.insertText(text);
          logger.debug(`Text insertion attempt completed in ${Date.now() - insertStartTime}ms, result: ${result}`);
          
          if (!result) {
            logger.warn('Text insertion returned false');
            // Show a backup notification with copy button
            this.notify('Text copied to clipboard for manual pasting', 'info');
            // Keep text in clipboard as fallback
            const { clipboard } = require('electron');
            clipboard.writeText(text);
          }
          
          // Log total insertion time
          logger.info(`Text insertion completed in ${Date.now() - startTime}ms (${attempts + 1} attempts)`);
          return result;
        } catch (err) {
          lastError = err;
          logger.warn(`Text insertion attempt ${attempts + 1} failed after ${Date.now() - startTime}ms`, {
            metadata: { error: err.message }
          });
          attempts++;
          
          if (attempts < maxAttempts) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 300 * attempts));
          }
        }
      }
      
      // If we reach here, all attempts failed
      throw lastError;
    } catch (error) {
      logger.error(`Text insertion failed after ${Date.now() - startTime}ms:`, { 
        metadata: { 
          error: error.message, 
          stack: error.stack 
        } 
      });
      
      // Fallback: Copy to clipboard for manual paste
      try {
        const { clipboard } = require('electron');
        clipboard.writeText(text);
        logger.debug('Text copied to clipboard as fallback');
        this.notify('Text copied to clipboard for manual pasting', 'info');
        
        // Add a flag to the error to suppress error sounds
        // since the text is at least available in the clipboard
        if (error) {
          error.suppressErrorSound = true;
        }
      } catch (clipboardError) {
        logger.error('Error copying to clipboard:', clipboardError);
      }
      
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
      const notificationService = this.getService('notification');
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
    const startTime = Date.now();
    const timings = {
      contextGathering: 0,
      aiProcessing: 0,
      textInsertion: 0,
      total: 0
    };
    
    try {
      // Show processing notification with faster timeout
      this.getService('notification').show({
        title: 'Processing AI Command',
        body: 'Analyzing context...',
        type: 'info',
        timeout: 1500  // Reduced from 2000
      });
      
      logger.info('Processing as AI command');
      
      const aiService = this.getService('ai');
      // Set a timeout for AI processing
      const aiProcessingStartTime = Date.now();
      const aiProcessingPromise = aiService.processCommand(text, highlightedText).then(result => {
        timings.aiProcessing = Date.now() - aiProcessingStartTime;
        return result;
      });
      
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
        this.getService('notification').show({
          title: 'AI Processing Failed',
          body: 'Falling back to normal transcription.',
          type: 'warning',
          timeout: 1500
        });
        
        timings.total = Date.now() - startTime;
        logger.info('AI command processing failed, fallback triggered', {
          aiProcessingTime: `${timings.aiProcessing}ms`,
          totalTime: `${timings.total}ms`
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
      const textInsertionStartTime = Date.now();
      await this.getService('textInsertion').insertText(aiResponse.text, highlightedText);
      timings.textInsertion = Date.now() - textInsertionStartTime;
      
      // Update stats
      this.processingStats.aiCommandCount++;
      
      // Log total AI processing time
      timings.total = Date.now() - startTime;
      logger.info('AI command processing completed', {
        aiProcessingTime: `${timings.aiProcessing}ms (${Math.round(timings.aiProcessing/timings.total*100)}%)`,
        textInsertionTime: `${timings.textInsertion}ms (${Math.round(timings.textInsertion/timings.total*100)}%)`,
        totalTime: `${timings.total}ms (100%)`
      });
      
      return aiResponse.text;
    } catch (aiError) {
      // Calculate total time even when error occurs
      timings.total = Date.now() - startTime;
      logger.error(`AI command processing failed after ${timings.total}ms:`, aiError);
      
      // Fall back to normal text processing if AI fails
      logger.info('Falling back to normal text processing due to AI error');
      
      // Show notification to user
      this.getService('notification').show({
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
      
      this.getService('notification').show({
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
    
    // Add timing markers for performance tracking
    const timings = {
      start: startTime,
      audioConversion: 0,
      apiRequest: 0,
      textProcessing: 0,
      total: 0
    };
    
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
        this.getService('notification').show({
          title: 'Using cached transcription',
          body: 'Processing text...',
          type: 'success',
          timeout: 800
        });
        
        // Process the cached text
        await this.processAndInsertText(cachedText);
        return cachedText;
      }

      // ENHANCED OPTIMIZATION: Run multiple independent operations in parallel
      const parallelOperations = [
        // 1. Convert PCM to WAV (CPU-intensive)
        AudioUtils.convertPcmToWav(audioBuffer).then(result => {
          timings.audioConversion = Date.now() - startTime;
          return result;
        }),
        
        // 2. Show notification (network/UI operation)
        this.getService('notification')?.show({
          title: 'Processing Audio',
          body: 'Preparing your recording...',
          type: 'info',
          timeout: 1000
        })?.catch?.(err => {
          logger.warn('Non-critical error showing notification:', err);
          return null; // Non-critical error, continue processing
        }) || Promise.resolve(null),
        
        // 3. Preload app name for future operations (improves text insertion speed later)
        (this.getService('selection')?.preloadAppName instanceof Function 
          ? this.getService('selection').preloadAppName().catch(err => {
              logger.warn('Non-critical error preloading app name:', err);
              return null; // Non-critical error, continue processing
            })
          : Promise.resolve(null)),
        
        // 4. Pre-initialize dictionary/context for improved transcription 
        (this.getService('dictionary')?.preloadDictionary instanceof Function
          ? this.getService('dictionary').preloadDictionary().catch(err => {
              logger.warn('Non-critical error preloading dictionary:', err);
              return null; // Non-critical error, continue processing
            })
          : Promise.resolve(null)),
        
        // 5. Prepare any AI services that might be needed
        (this.getService('ai')?.preloadModels instanceof Function
          ? this.getService('ai').preloadModels().catch(err => {
              logger.warn('Non-critical error preloading AI models:', err);
              return null; // Non-critical error, continue processing
            })
          : Promise.resolve(null))
      ];
      
      // Wait for parallel operations to complete
      const [wavData, ...rest] = await Promise.all(parallelOperations);
      
      // Now that we have the WAV data, create a temp file
      // (This can't be parallelized as it depends on wavData)
      const createTempFilePromise = AudioUtils.createTempFile(wavData);
      
      // While the file is being created, prepare the API options in parallel
      const apiOptionsPromise = this._prepareTranscriptionOptions();
      
      // Wait for both operations to complete
      const [tempFilePath, apiOptions] = await Promise.all([
        createTempFilePromise,
        apiOptionsPromise
      ]);
      
      tempFile = tempFilePath;

      // Make API request using the WhisperAPIClient with timeout
      const apiStartTime = Date.now();
      const apiPromise = this.apiClient.transcribeAudio(tempFile, apiOptions).then(result => {
        timings.apiRequest = Date.now() - apiStartTime;
        return result;
      });
      
      // Add timeout to the API call to prevent hanging
      // Ensure proper error handling by wrapping all promises in a try/catch block
      let response;
      try {
        response = await Promise.race([
          apiPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Whisper API timeout')), this.timeouts.apiRequest)
          )
        ]);
      } catch (apiError) {
        // Handle API-specific errors appropriately
        logger.error('API error during transcription:', apiError);
        throw new Error(`Transcription API error: ${apiError.message || 'Unknown API error'}`);
      }
      
      // Ensure response exists before accessing properties
      if (!response) {
        throw new Error('Empty response from transcription API');
      }
      
      const transcribedText = response.text || '';
      
      // Start cache update in the background without waiting
      if (audioSignature && transcribedText) {
        // Don't await this, let it run in the background
        this._updateAudioCache(audioSignature, transcribedText);
      }
      
      // If transcription is empty, show notification and return early
      if (!transcribedText || transcribedText.trim() === '') {
        logger.info('Empty transcription received, skipping processing');
        this.getService('notification').show({
          title: 'No Speech Detected',
          body: 'The recording contained no recognizable speech.',
          type: 'info',
          timeout: 1500
        });
        return '';
      }
      
      // Now process the text while simultaneously showing a notification
      const textProcessingStartTime = Date.now();
      const [insertionResult, _] = await Promise.all([
        this.processAndInsertText(transcribedText).then(result => {
          timings.textProcessing = Date.now() - textProcessingStartTime;
          return result;
        }),
        (this.getService('notification')?.show instanceof Function 
          ? this.getService('notification').show({
              title: 'Transcribing',
              body: 'Processing text...',
              type: 'success',
              timeout: 1000
            }).catch(err => {
              logger.warn('Non-critical error showing notification:', err);
              return null; // Non-critical error, continue processing
            })
          : Promise.resolve(null))
      ]);
      
      // Check if text insertion was successful
      if (!insertionResult) {
        logger.warn('Text processing/insertion was not successful, attempting fallback');
        
        // Try direct insertion as fallback
        try {
          const textInsertionService = this.getService('textInsertion');
          if (textInsertionService && typeof textInsertionService.insertText === 'function') {
            logger.debug('Attempting direct text insertion fallback');
            await textInsertionService.insertText(transcribedText);
          } else {
            // Use clipboard as last resort
            const { clipboard } = require('electron');
            clipboard.writeText(transcribedText);
            logger.debug('Text copied to clipboard as last resort fallback');
            this.notify('Text copied to clipboard for manual pasting', 'info');
          }
        } catch (fallbackError) {
          logger.error('Fallback text insertion failed:', fallbackError);
        }
      }
      
      // OPTIMIZATION: Clean up in the background
      setTimeout(() => {
        AudioUtils.cleanupTempFile(tempFile).catch(err => {
          logger.error('Error cleaning up temp file:', err);
        });
      }, 100);
      
      // Log performance
      const totalTime = Date.now() - startTime;
      timings.total = totalTime;
      logger.info(`Performance breakdown:`, {
        audioConversion: `${timings.audioConversion}ms (${Math.round(timings.audioConversion/totalTime*100)}%)`,
        apiRequest: `${timings.apiRequest}ms (${Math.round(timings.apiRequest/totalTime*100)}%)`, 
        textProcessing: `${timings.textProcessing}ms (${Math.round(timings.textProcessing/totalTime*100)}%)`,
        total: `${totalTime}ms (100%)`
      });

      return transcribedText;
    } catch (error) {
      logger.error('Error in transcription:', error);
      
      // Update error stats
      this.processingStats.errorCount++;
      
      // Show error notification
      this.getService('notification').show({
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
   * Helper method to update the audio cache
   * @param {string} signature - Audio signature
   * @param {string} text - Transcription text
   * @private
   */
  _updateAudioCache(signature, text) {
    try {
      // Add to cache
      this.audioSignatureCache.set(signature, text);
      
      // Limit cache size
      if (this.audioSignatureCache.size > this.cacheMaxSize) {
        // Remove oldest entry
        const firstKey = this.audioSignatureCache.keys().next().value;
        this.audioSignatureCache.delete(firstKey);
      }
    } catch (error) {
      logger.warn('Non-critical error updating audio cache:', error);
    }
  }
  
  /**
   * Prepare API options for transcription
   * @returns {Promise<Object>} API options
   * @private
   */
  async _prepareTranscriptionOptions() {
    // Can be extended to include more dynamic options in the future
    return {
      useCache: true,
      language: 'en',
      temperature: 0.0, // Use 0.0 temperature to minimize hallucinations
      response_format: 'json', // Ensure we get JSON for faster parsing
      formatText: true // Enable text formatting with proper capitalization and punctuation
    };
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

  async startTranscription(...args) {
    console.log('[TranscriptionService] startTranscription called with args:', args);
    try {
      // ... existing code ...
      console.log('[TranscriptionService] Transcription started');
    } catch (error) {
      console.error('[TranscriptionService] Error starting transcription:', error);
      throw error;
    }
  }

  async stopTranscription(...args) {
    console.log('[TranscriptionService] stopTranscription called with args:', args);
    try {
      // ... existing code ...
      console.log('[TranscriptionService] Transcription stopped');
    } catch (error) {
      console.error('[TranscriptionService] Error stopping transcription:', error);
      throw error;
    }
  }

  /**
   * Get selected text with retry logic and robust error handling
   * @param {Object} selectionService - The selection service
   * @returns {Promise<string>} - Selected text or empty string
   * @private
   */
  async _getSelectedTextSafely(selectionService) {
    let selectedText = '';
    
    if (!selectionService) {
      logger.warn('Selection service not available, proceeding without selected text');
      return '';
    }
    
    if (typeof selectionService.getSelectedText !== 'function') {
      logger.warn('Selection service missing getSelectedText method');
      return '';
    }
    
    try {
      logger.debug('Attempting to get selected text...');
      
      // First try - sometimes fails silently
      selectedText = await Promise.resolve(selectionService.getSelectedText()).catch(err => {
        logger.warn('Error on first attempt to get selected text:', err);
        return '';
      });
      
      if (!selectedText && process.platform === 'darwin') {
        // On macOS, we can try a second time after a small delay
        logger.debug('First attempt returned no text, trying again after delay...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        selectedText = await Promise.resolve(selectionService.getSelectedText()).catch(err => {
          logger.warn('Error on second attempt to get selected text:', err);
          return '';
        });
        
        if (!selectedText) {
          // Last attempt - try using the clipboard as fallback
          logger.debug('Second attempt failed, trying clipboard fallback...');
          try {
            // Try clipboard-based fallback if available
            if (typeof selectionService._getSelectionFromClipboard === 'function') {
              selectedText = await Promise.resolve(selectionService._getSelectionFromClipboard()).catch(err => {
                logger.warn('Error using clipboard fallback:', err);
                return '';
              });
              
              if (selectedText) {
                logger.debug('Got selection from clipboard fallback');
              }
            }
          } catch (clipboardError) {
            logger.warn('Clipboard fallback failed:', clipboardError);
          }
        }
      }
      
      logger.debug(`Selected text retrieved, length: ${selectedText ? selectedText.length : 0}`);
      
      if (selectedText) {
        logger.debug(`Selection content: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`);
      } else {
        logger.debug('No text selected in the active application');
        // Notify user that no text is selected - with safe notify call
        try {
          this.notify('No text is selected. The AI command will run without context.', 'info');
        } catch (notifyError) {
          logger.warn('Error showing notification:', notifyError);
        }
      }
      
      return selectedText || '';
    } catch (selectionError) {
      logger.warn('Failed to get selected text for AI context:', selectionError);
      // Continue with empty selection, but notify user - with safe notify call
      try {
        this.notify('Could not access selected text. The AI command will run without context.', 'warning');
      } catch (notifyError) {
        logger.warn('Error showing notification:', notifyError);
      }
      return '';
    }
  }
  
  /**
   * Add text to history in the background
   * @param {string} text - Text to add to history
   * @param {boolean} isAIResponse - Whether this is an AI response
   * @returns {Promise<void>}
   * @private
   */
  async _addToHistoryInBackground(text, isAIResponse) {
    try {
      const historyService = this.getService('history');
      if (historyService && typeof historyService.addTranscription === 'function') {
        await historyService.addTranscription(text, { isAIResponse });
      }
    } catch (error) {
      // Just log the error but don't interrupt the main flow
      logger.warn('Failed to add text to history:', error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TranscriptionService(); 