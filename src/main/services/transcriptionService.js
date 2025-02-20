/**
 * A stub implementation of the transcription service.
 * This will be replaced with actual Whisper API integration later.
 */
const OpenAI = require('openai');
const configService = require('./configService');
const textProcessing = require('./textProcessing');
const aiService = require('./aiService');
const fs = require('fs');
const os = require('os');
const path = require('path');

class TranscriptionService {
  constructor() {
    this.openai = null;
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
      await fs.promises.unlink(filePath);
    } catch (error) {
      console.warn('Failed to cleanup temp file:', error);
    }
  }

  /**
   * Process transcribed text through AI if it's a command
   * @param {string} text - The transcribed text
   * @param {string} highlightedText - Currently highlighted text
   * @returns {Promise<Object>} Processed result with text and metadata
   */
  async processTranscribedText(text, highlightedText = '') {
    const processedText = textProcessing.processText(text);
    
    // Check if this is an AI command
    if (await aiService.isAICommand(processedText)) {
      return {
        isAICommand: true,
        result: await aiService.processCommand(processedText, highlightedText),
      };
    }

    // Regular transcription
    return {
      isAICommand: false,
      result: {
        text: processedText,
        hasHighlight: false,
        originalCommand: null,
      },
    };
  }

  /**
   * Transcribe audio data to text using OpenAI Whisper
   * @param {Buffer} audioData - The raw audio data to transcribe
   * @param {string} highlightedText - Currently highlighted text
   * @returns {Promise<Object>} A promise that resolves to the processed result
   * @throws {Error} If transcription fails
   */
  async transcribeAudio(audioData, highlightedText = '') {
    if (!this.openai) {
      await this.initializeOpenAI();
    }

    let tempFile = null;
    try {
      // Save audio data to temp file
      tempFile = await this.saveToTempFile(audioData);

      // Create file stream for OpenAI
      const fileStream = fs.createReadStream(tempFile);

      // Call Whisper API
      const response = await this.openai.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1',
        language: 'en',
      });

      // Process the transcribed text
      return await this.processTranscribedText(response.text, highlightedText);

    } catch (error) {
      if (error.message === 'OpenAI API key not configured') {
        throw error;
      }

      // Handle specific API errors
      if (error.response) {
        const status = error.response.status;
        switch (status) {
          case 401:
            throw new Error('Invalid OpenAI API key');
          case 429:
            throw new Error('OpenAI API rate limit exceeded');
          default:
            throw new Error(`Transcription failed: ${error.message}`);
        }
      }

      // Handle network or other errors
      throw new Error(`Transcription failed: ${error.message}`);
    } finally {
      // Cleanup temp file
      if (tempFile) {
        await this.cleanupTempFile(tempFile);
      }
    }
  }
}

module.exports = new TranscriptionService(); 