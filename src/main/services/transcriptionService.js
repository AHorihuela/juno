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
    try {
      if (!this.initialized) {
        throw new Error('TranscriptionService not initialized');
      }

      console.log('[TranscriptionService] Starting text processing pipeline');
      console.log('[TranscriptionService] Raw text:', text);

      // Get selected text if any
      const highlightedText = await this.getService('selection').getSelectedText();
      console.log('[TranscriptionService] Selected text:', highlightedText);

      // First check if this is an AI command
      const isAICommand = await this.getService('ai').isAICommand(text);
      console.log('[TranscriptionService] Is AI command:', isAICommand);

      if (isAICommand) {
        console.log('[TranscriptionService] Processing as AI command');
        const aiResponse = await this.getService('ai').processCommand(text, highlightedText);
        console.log('[TranscriptionService] AI response:', aiResponse);
        
        // Insert the AI response
        await this.getService('textInsertion').insertText(aiResponse.text, highlightedText);
        return aiResponse.text;
      }

      // If not an AI command, proceed with normal text processing
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
      
      return processed;
    } catch (error) {
      throw this.emitError(error);
    }
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

        // Process and insert the transcribed text
        const processedText = await this.processAndInsertText(transcribedText);

        // Log metrics
        await this.logTranscriptionMetrics(transcribedText, processedText);

        return processedText;
      } finally {
        // Clean up temp file
        await this.cleanupTempFile(tempFile);
      }
    } catch (error) {
      this.getService('notification').showTranscriptionError(error);
      throw this.emitError(error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TranscriptionService(); 