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
      console.log('[TranscriptionService] Starting text processing pipeline');
      console.log('[TranscriptionService] Raw text:', text);
      
      // First check if this is an AI command before any text processing
      console.log('[TranscriptionService] Checking for AI command');
      const isCommand = await aiService.isAICommand(text);
      console.log('[TranscriptionService] Is AI command:', isCommand);

      if (isCommand) {
        console.log('[TranscriptionService] Processing AI command');
        const aiResponse = await aiService.processCommand(text, highlightedText);
        console.log('[TranscriptionService] AI response received:', aiResponse);
        
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
        console.log('[TranscriptionService] Processing as regular transcription');
        // Regular transcription - process text first
        const processedText = textProcessing.processText(text);
        console.log('[TranscriptionService] Processed text:', processedText);
        
        // Try to insert
        const success = await textInsertionService.insertText(processedText);
        
        // If insertion failed, show popup
        if (!success) {
          textInsertionService.showCopyPopup(processedText);
        }
      }
    } catch (error) {
      console.error('[TranscriptionService] Error in processAndInsertText:', error);
      console.error('[TranscriptionService] Error stack:', error.stack);
      notificationService.showTranscriptionError(error);
      throw error;
    }
  }

  /**
   * Transcribe audio data to text using OpenAI Whisper
   * @param {Buffer} audioBuffer - The raw audio data to transcribe
   * @param {string} highlightedText - Currently highlighted text
   * @returns {Promise<string>} The transcribed text
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

        console.log('Response received:', {
          ok: response.ok,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Transcription API error:', error);
          console.log('Error response details:', {
            status: response.status,
            errorParsed: JSON.parse(error)
          });
          if (response.status === 401) {
            throw new Error('Invalid OpenAI API key');
          } else if (response.status === 429) {
            throw new Error('OpenAI API rate limit exceeded');
          }
          throw new Error(`Transcription failed: ${response.status} ${error}`);
        }

        console.log('Response is OK, parsing JSON');
        const result = await response.json();
        
        // Log detailed API response
        console.log('Whisper API Response:', {
          result,
          responseStatus: response.status,
          responseHeaders: Object.fromEntries(response.headers.entries()),
          requestDetails: {
            fileSize: fileSize,
            language: 'en',
            model: 'whisper-1'
          }
        });

        // Process and insert the transcribed text
        await this.processAndInsertText(result.text, highlightedText);
        
        // Return the transcribed text
        return result.text;

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