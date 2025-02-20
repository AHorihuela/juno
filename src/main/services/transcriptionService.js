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
const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
const wav = require('wav');
const FormData = require('form-data');

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
   * Process transcribed text and insert it
   * @param {string} text - The transcribed text
   * @param {string} highlightedText - Currently highlighted text
   * @returns {Promise<void>}
   */
  async processAndInsertText(text, highlightedText = '') {
    try {
      const processedText = textProcessing.processText(text);
      
      // Check if this is an AI command
      if (await aiService.isAICommand(processedText)) {
        const aiResponse = await aiService.processCommand(processedText, highlightedText);
        if (aiResponse) {
          // Try to insert the AI response
          const success = await textInsertionService.insertText(
            aiResponse.text,
            aiResponse.hasHighlight
          );

          // If insertion failed, show popup
          if (!success) {
            textInsertionService.showCopyPopup(aiResponse.text);
          }
        }
      } else {
        // Regular transcription - try to insert
        const success = await textInsertionService.insertText(processedText);
        
        // If insertion failed, show popup
        if (!success) {
          textInsertionService.showCopyPopup(processedText);
        }
      }
    } catch (error) {
      console.error('Failed to process and insert text:', error);
      notificationService.showTranscriptionError(error);
      throw error;
    }
  }

  /**
   * Transcribe audio data to text using OpenAI Whisper
   * @param {Buffer} audioBuffer - The raw audio data to transcribe
   * @param {string} highlightedText - Currently highlighted text
   * @returns {Promise<void>}
   */
  async transcribeAudio(audioBuffer, highlightedText = '') {
    try {
      const apiKey = await configService.getOpenAIApiKey();
      console.log('Using OpenAI API key for transcription, length:', apiKey ? apiKey.length : 0);
      console.log('Audio buffer size:', audioBuffer.length, 'bytes');
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please set it in the settings.');
      }

      // Create temporary WAV file with proper headers
      const tempFile = path.join(os.tmpdir(), `whisper-${Date.now()}.wav`);
      console.log('Creating temp WAV file:', tempFile);

      // Create WAV file writer with proper settings
      const writer = new wav.FileWriter(tempFile, {
        channels: 1,
        sampleRate: 16000,
        bitDepth: 16
      });

      // Write audio data and wait for it to finish
      await new Promise((resolve, reject) => {
        writer.on('error', reject);
        writer.on('finish', resolve);
        
        // Write the audio data in chunks to avoid memory issues
        const chunkSize = 8192;
        for (let i = 0; i < audioBuffer.length; i += chunkSize) {
          const chunk = audioBuffer.slice(i, i + chunkSize);
          writer.write(chunk);
        }
        writer.end();
      });

      const fileSize = fs.statSync(tempFile).size;
      console.log('WAV file written, size:', fileSize);
      
      if (fileSize === 0) {
        throw new Error('WAV file is empty');
      }

      // Create form data
      const form = new FormData();
      form.append('file', fs.createReadStream(tempFile));
      form.append('model', 'whisper-1');
      form.append('language', 'en');
      form.append('response_format', 'json');

      console.log('Sending request to Whisper API...');

      try {
        // Make the API request
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            ...form.getHeaders()
          },
          body: form
        });

        // Clean up temp file
        await fs.promises.unlink(tempFile);

        if (!response.ok) {
          const error = await response.text();
          console.error('Transcription API error:', error);
          if (response.status === 401) {
            throw new Error('Invalid OpenAI API key');
          } else if (response.status === 429) {
            throw new Error('OpenAI API rate limit exceeded');
          }
          throw new Error(`Transcription failed: ${response.status} ${error}`);
        }

        const result = await response.json();
        console.log('Transcription received:', result);

        // Process and insert the transcribed text
        await this.processAndInsertText(result.text, highlightedText);

      } catch (error) {
        // Clean up temp file in case of error
        await fs.promises.unlink(tempFile).catch(() => {});
        throw error;
      }

    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }
}

module.exports = new TranscriptionService(); 