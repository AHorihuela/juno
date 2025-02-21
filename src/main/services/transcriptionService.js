/**
 * A stub implementation of the transcription service.
 * This will be replaced with actual Whisper API integration later.
 */
const OpenAI = require('openai');
const configService = require('./configService');
const textProcessing = require('./textProcessing');
const aiService = require('./aiService');
const textInsertionService = require('./textInsertionService');
const notificationService = require('./notificationService');
const selectionService = require('./selectionService');
const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const dictionaryService = require('./dictionaryService');

// WAV header constants
const RIFF_HEADER_SIZE = 44;
const SAMPLE_RATE = 16000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

class TranscriptionService {
  constructor() {
    this.openai = null;
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
   * Initialize OpenAI client with API key
   * @throws {Error} If API key is not set
   */
  async initializeOpenAI() {
    const apiKey = await configService.getOpenAIApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    this.openai = new OpenAI({ apiKey });
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
    console.log('[TranscriptionService] Starting text processing pipeline');
    console.log('[TranscriptionService] Raw text:', text);

    // Get selected text if any
    const highlightedText = await selectionService.getSelectedText();
    console.log('[TranscriptionService] Selected text:', highlightedText);

    // First check if this is an AI command
    const isAICommand = await aiService.isAICommand(text);
    console.log('[TranscriptionService] Is AI command:', isAICommand);

    if (isAICommand) {
      console.log('[TranscriptionService] Processing as AI command');
      const aiResponse = await aiService.processCommand(text, highlightedText);
      console.log('[TranscriptionService] AI response:', aiResponse);
      
      // Insert the AI response
      await textInsertionService.insertText(aiResponse.text, highlightedText);
      return aiResponse.text;
    }

    // If not an AI command, proceed with normal text processing
    console.log('[TranscriptionService] Processing as normal text');

    // First apply dictionary processing
    const dictionaryProcessed = await dictionaryService.processTranscribedText(text);
    console.log('[TranscriptionService] After dictionary processing:', dictionaryProcessed);

    // Then continue with other text processing
    const processed = textProcessing.processText(dictionaryProcessed);
    console.log('[TranscriptionService] Final processed text:', processed);

    // Insert the processed text
    await textInsertionService.insertText(processed, highlightedText);
    
    return processed;
  }

  /**
   * Transcribe audio data to text using OpenAI Whisper
   * @param {Buffer} audioBuffer - The raw audio data to transcribe
   * @param {string} highlightedText - Currently highlighted text
   * @returns {Promise<string>} The transcribed text
   */
  async transcribeAudio(audioBuffer, highlightedText = '') {
    console.log('\n[Transcription] Starting transcription process...');
    
    try {
      // Get API key
      const apiKey = await configService.getOpenAIApiKey();
      console.log('[Transcription] Retrieved OpenAI API key');
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Get dictionary prompt
      const prompt = await dictionaryService.generateWhisperPrompt();
      if (prompt) {
        console.log('[Transcription] Using dictionary-enhanced prompt');
      } else {
        console.log('[Transcription] No dictionary prompt available');
      }

      // Convert PCM to WAV
      console.log('[Transcription] Converting PCM to WAV format...');
      const wavData = this.convertPcmToWav(audioBuffer);

      // Create temp WAV file
      const tempFile = path.join(require('os').tmpdir(), `whisper-${Date.now()}.wav`);
      console.log('[Transcription] Creating temp WAV file:', tempFile);
      
      // Write WAV data to file
      fs.writeFileSync(tempFile, wavData);
      const fileSize = fs.statSync(tempFile).size;
      console.log('[Transcription] WAV file written, size:', fileSize);

      // Create form data
      const form = new FormData();
      form.append('file', fs.createReadStream(tempFile), {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      form.append('model', 'whisper-1');
      form.append('language', 'en');
      if (prompt) {
        form.append('prompt', prompt);
      }

      console.log('[Transcription] Sending request to Whisper API...');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...form.getHeaders()
        },
        body: form
      });

      console.log('[Transcription] Response received:', {
        ok: response.ok,
        status: response.status
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[Transcription] Error details:', errorData);
        throw new Error(`Whisper API error: ${response.status}\nDetails: ${errorData}`);
      }

      const data = await response.json();
      
      // Log the raw transcription before dictionary processing
      console.log('\n[Transcription] Raw transcription:', data.text);
      
      // Process and insert the transcribed text
      const processedText = await this.processAndInsertText(data.text);
      
      // Get dictionary stats
      const dictStats = dictionaryService.getStats();
      
      // Log effectiveness summary
      console.log('\n[Transcription] Dictionary effectiveness summary:');
      console.log('  - Dictionary size:', dictStats.dictionarySize, 'words');
      console.log('  - Exact match rate:', dictStats.effectiveness.exactMatchRate);
      console.log('  - Fuzzy match rate:', dictStats.effectiveness.fuzzyMatchRate);
      console.log('  - Unmatched rate:', dictStats.effectiveness.unmatchedRate);
      
      // Compare original vs processed
      if (data.text !== processedText) {
        console.log('\n[Transcription] Text changes:');
        console.log('  Original:', data.text);
        console.log('  Processed:', processedText);
      } else {
        console.log('\n[Transcription] No dictionary-based changes were made');
      }

      // Clean up temp file
      fs.unlinkSync(tempFile);
      console.log('[Transcription] Temporary file cleaned up');
      
      return processedText;

    } catch (error) {
      console.error('[Transcription] Error:', error);
      throw error;
    }
  }
}

module.exports = new TranscriptionService(); 