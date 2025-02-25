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
    
    // Show notification to user
    this.getService('notification').showNotification({
      title: 'Transcribing Audio',
      body: 'Sending audio to Whisper API...',
      type: 'info',
      timeout: 3000
    });
    
    const openai = await this.getService('resource').getOpenAIClient();

    try {
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: 'whisper-1',
        language: 'en',
        prompt: await this.getService('dictionary').generateWhisperPrompt()
      });

      console.log('[Transcription] Response received:', response);
      return response;
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
    
    try {
      if (!this.initialized) {
        throw new Error('TranscriptionService not initialized');
      }

      // Prepare audio data
      const wavData = await this.prepareAudioData(audioBuffer);
      const tempFile = await this.createTempFile(wavData);

      try {
        // Make API request
        const response = await this.callWhisperAPI(tempFile);
        const transcribedText = response.text;
        
        // Show transcription success notification
        this.getService('notification').showNotification({
          title: 'Transcription Complete',
          body: 'Processing transcribed text...',
          type: 'success',
          timeout: 2000
        });

        // Process and insert the transcribed text
        const processedText = await this.processAndInsertText(transcribedText);

        // Log metrics
        await this.logTranscriptionMetrics(transcribedText, processedText);
        
        // Log performance
        const totalTime = Date.now() - startTime;
        console.log(`[Transcription] Total processing time: ${totalTime}ms`);

        return processedText;
      } finally {
        // Clean up temp file
        await this.cleanupTempFile(tempFile);
      }
    } catch (error) {
      this.getService('notification').showTranscriptionError(error);
      
      // Update error stats
      this.processingStats.errorCount++;
      
      throw this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TranscriptionService(); 