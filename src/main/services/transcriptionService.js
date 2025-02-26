/**
 * A stub implementation of the transcription service.
 * This will be replaced with actual Whisper API integration later.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const BaseService = require('./BaseService');

// WAV header constants
const RIFF_HEADER_SIZE = 44;
const SAMPLE_RATE = 16000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

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
  }

  async _initialize() {
    // Nothing to initialize yet
  }

  async _shutdown() {
    // Nothing to clean up
  }

  /**
   * Create a WAV header for the given PCM data
   * @param {number} dataLength - Length of the PCM data in bytes
   * @returns {Buffer} - WAV header buffer
   */
  createWavHeader(dataLength) {
    const buffer = Buffer.alloc(RIFF_HEADER_SIZE);
    
    // RIFF identifier
    buffer.write('RIFF', 0);
    // file length minus RIFF identifier length and file description length
    buffer.writeUInt32LE(dataLength + RIFF_HEADER_SIZE - 8, 4);
    // WAVE identifier
    buffer.write('WAVE', 8);
    // format chunk identifier
    buffer.write('fmt ', 12);
    // format chunk length
    buffer.writeUInt32LE(16, 16);
    // sample format (1 is PCM)
    buffer.writeUInt16LE(1, 20);
    // number of channels
    buffer.writeUInt16LE(NUM_CHANNELS, 22);
    // sample rate
    buffer.writeUInt32LE(SAMPLE_RATE, 24);
    // byte rate (sample rate * block align)
    buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE / 8, 28);
    // block align (channel count * bytes per sample)
    buffer.writeUInt16LE(NUM_CHANNELS * BITS_PER_SAMPLE / 8, 32);
    // bits per sample
    buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
    // data chunk identifier
    buffer.write('data', 36);
    // data chunk length
    buffer.writeUInt32LE(dataLength, 40);
    
    return buffer;
  }

  /**
   * Convert raw PCM data to WAV format
   * @param {Buffer} pcmData - Raw PCM audio data
   * @returns {Buffer} - WAV format audio data
   */
  convertPcmToWav(pcmData) {
    const header = this.createWavHeader(pcmData.length);
    return Buffer.concat([header, pcmData]);
  }

  /**
   * Save audio buffer to a temporary file
   * @param {Buffer} audioData - Raw audio data
   * @returns {Promise<string>} Path to temporary file
   */
  async saveToTempFile(audioData) {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `whisper-${Date.now()}.wav`);
    await fs.promises.writeFile(tempFile, audioData);
    return tempFile;
  }

  /**
   * Clean up temporary file
   * @param {string} filePath - Path to file to delete
   */
  async cleanupTempFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch (error) {
      console.error('[Transcription] Error cleaning up temp file:', error);
    }
    return false;
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

      console.log('[TranscriptionService] Starting text processing pipeline');
      console.log('[TranscriptionService] Raw text:', text);

      // Skip processing if text is empty or just whitespace
      if (!text || !text.trim()) {
        console.log('[TranscriptionService] Empty text, skipping processing');
        return '';
      }

      // Get selected text if any - use the optimized selection service
      const selectionService = this.getService('selection');
      const highlightedText = await selectionService.getSelectedText();
      console.log('[TranscriptionService] Selected text:', highlightedText);
      
      // Preload app name for future operations
      selectionService.preloadAppName().catch(err => {
        console.error('[TranscriptionService] Error preloading app name:', err);
      });
      
      // Store the highlighted text in context service for future reference
      const contextService = this.getService('context');
      if (highlightedText) {
        await contextService.startRecording(highlightedText);
      }

      // First check if this is an AI command
      const aiService = this.getService('ai');
      isAICommand = await aiService.isAICommand(text);
      console.log('[TranscriptionService] Is AI command:', isAICommand);

      if (isAICommand) {
        try {
          // Show processing notification
          this.getService('notification').showNotification({
            title: 'Processing AI Command',
            body: 'Analyzing context and preparing response...',
            type: 'info',
            timeout: 2000
          });
          
          console.log('[TranscriptionService] Processing as AI command');
          const aiResponse = await aiService.processCommand(text, highlightedText);
          
          // Check if the AI request was cancelled or failed
          if (!aiResponse) {
            console.log('[TranscriptionService] AI request was cancelled or failed');
            return '';
          }
          
          console.log('[TranscriptionService] AI response:', aiResponse);
          
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
          console.error('[TranscriptionService] Error processing AI command:', aiError);
          
          // Fall back to normal text processing if AI fails
          console.log('[TranscriptionService] Falling back to normal text processing due to AI error');
          
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
      console.log('[TranscriptionService] Processing as normal text');

      // First apply dictionary processing
      const dictionaryProcessed = await this.getService('dictionary').processTranscribedText(text);
      console.log('[TranscriptionService] After dictionary processing:', dictionaryProcessed);

      // Then continue with other text processing
      const textProcessing = this.getService('textProcessing');
      const processed = textProcessing.processText(dictionaryProcessed);
      console.log('[TranscriptionService] Final processed text:', processed);

      // Insert the processed text
      await this.getService('textInsertion').insertText(processed, highlightedText);
      
      // Update stats
      this.processingStats.normalTranscriptionCount++;
      
      return processed;
    } catch (error) {
      console.error('[TranscriptionService] Error in processAndInsertText:', error);
      
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
      
      console.log('[TranscriptionService] Processing completed in', processingTime, 'ms');
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
    
    console.log('[TranscriptionService] Updated processing stats:', {
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
   * Validate and retrieve OpenAI API key
   * @returns {Promise<string>} API key
   * @throws {Error} If API key is not configured
   */
  async validateAndGetApiKey() {
    const apiKey = await this.getService('config').getOpenAIApiKey();
    console.log('[Transcription] Retrieved OpenAI API key');
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    return apiKey;
  }

  /**
   * Prepare audio data for transcription
   * @param {Buffer} audioBuffer - Raw audio buffer
   * @returns {Promise<Buffer>} WAV formatted audio data
   */
  async prepareAudioData(audioBuffer) {
    console.log('[Transcription] Converting PCM to WAV format...');
    return this.convertPcmToWav(audioBuffer);
  }

  /**
   * Create and write temporary WAV file
   * @param {Buffer} wavData - WAV formatted audio data
   * @returns {Promise<string>} Path to temporary file
   */
  async createTempFile(wavData) {
    const tempFile = path.join(os.tmpdir(), `whisper-${Date.now()}.wav`);
    console.log('[Transcription] Creating temp WAV file:', tempFile);
    
    await fs.promises.writeFile(tempFile, wavData);
    const fileSize = fs.statSync(tempFile).size;
    console.log('[Transcription] WAV file written, size:', fileSize);
    
    return tempFile;
  }

  /**
   * Make request to Whisper API
   * @param {string} tempFile - Path to temporary WAV file
   * @returns {Promise<Object>} API response data
   */
  async callWhisperAPI(tempFile) {
    console.log('[Transcription] Sending request to Whisper API...');
    
    // Show notification to user - but don't wait for it to complete
    this.getService('notification').showNotification({
      title: 'Transcribing Audio',
      body: 'Processing your recording...',
      type: 'info',
      timeout: 3000
    });
    
    // Prepare OpenAI client in parallel with file stats
    const [openai, fileStats] = await Promise.all([
      this.getService('resource').getOpenAIClient(),
      fs.promises.stat(tempFile)
    ]);

    try {
      // Calculate audio duration
      const fileSize = fileStats.size;
      const audioLengthSeconds = (fileSize - 44) / (16000 * 2); // Approximate duration in seconds
      
      console.log(`[Transcription] Estimated audio duration: ${audioLengthSeconds.toFixed(2)}s`);
      
      // Skip dictionary prompt for very short recordings (less than 1.5 seconds)
      // Short recordings are more likely to be just ambient noise
      let dictionaryPrompt = '';
      if (audioLengthSeconds >= 1.5) {
        // Start preparing the API request while dictionary prompt is being generated
        const fileStream = fs.createReadStream(tempFile);
        
        // Generate dictionary prompt in parallel
        dictionaryPrompt = await this.getService('dictionary').generateWhisperPrompt();
        
        // Create API request with parameters to reduce hallucinations
        const response = await openai.audio.transcriptions.create({
          file: fileStream,
          model: 'whisper-1',
          language: 'en',
          prompt: dictionaryPrompt,
          temperature: 0.0,  // Lower temperature reduces hallucinations
          response_format: 'verbose_json'  // Get confidence scores
        });

        console.log('[Transcription] Response received:', response);
        
        // Check confidence - if very low confidence, likely no real speech
        if (response.segments && response.segments.length > 0) {
          const avgConfidence = response.segments.reduce((sum, segment) => sum + segment.confidence, 0) / response.segments.length;
          console.log(`[Transcription] Average confidence: ${avgConfidence.toFixed(4)}`);
          
          // If confidence is very low and audio is short, likely no real speech
          if (avgConfidence < 0.5 && audioLengthSeconds < 3) {
            console.log('[Transcription] Low confidence transcription, likely no real speech');
            return { text: '' };  // Return empty text
          }
        }
        
        return response;
      } else {
        console.log('[Transcription] Audio too short, skipping dictionary prompt');
        
        // For very short recordings, use a simpler request
        const response = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFile),
          model: 'whisper-1',
          language: 'en',
          temperature: 0.0,
          response_format: 'verbose_json'
        });
        
        console.log('[Transcription] Response received:', response);
        return response;
      }
    } catch (error) {
      console.error('[Transcription] Error details:', error);
      throw error;
    }
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
    console.log('\n[Transcription] Dictionary effectiveness summary:');
    console.log('  - Dictionary size:', dictStats.dictionarySize, 'words');
    console.log('  - Exact match rate:', dictStats.effectiveness.exactMatchRate);
    console.log('  - Fuzzy match rate:', dictStats.effectiveness.fuzzyMatchRate);
    console.log('  - Unmatched rate:', dictStats.effectiveness.unmatchedRate);
    
    // Compare original vs processed
    if (originalText !== processedText) {
      console.log('\n[Transcription] Text changes:');
      console.log('  Original:', originalText);
      console.log('  Processed:', processedText);
    }
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

      // Make API request
      const response = await this.callWhisperAPI(tempFile);
      const transcribedText = response.text;
      
      // If transcription is empty, show notification and return early
      if (!transcribedText || transcribedText.trim() === '') {
        console.log('[Transcription] Empty transcription received, skipping processing');
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

      // Log metrics in the background without waiting
      this.logTranscriptionMetrics(transcribedText, processedText).catch(err => {
        console.error('[Transcription] Error logging metrics:', err);
      });
      
      // Log performance
      const totalTime = Date.now() - startTime;
      console.log(`[Transcription] Total processing time: ${totalTime}ms`);

      return processedText;
    } catch (error) {
      console.error('[Transcription] Error in transcription:', error);
      throw error;
    } finally {
      // Clean up temp file if it was created
      if (tempFile) {
        this.cleanupTempFile(tempFile).catch(err => {
          console.error('[Transcription] Error cleaning up temp file:', err);
        });
      }
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TranscriptionService(); 