/**
 * TranscriptionOrchestrator - Coordinate transcription workflow
 * 
 * This service orchestrates the entire transcription process,
 * coordinating between audio processing, API calls, and text processing.
 */
const BaseService = require('../BaseService');
const LogManager = require('../../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('TranscriptionOrchestrator');

class TranscriptionOrchestrator extends BaseService {
  constructor() {
    super('TranscriptionOrchestrator');
    
    // Operational state
    this.isCommandMode = false;
    this.isProcessing = false;
    
    // Metrics
    this.processingStats = {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      commandCount: 0
    };
  }
  
  /**
   * Initialize the service
   * @private
   */
  async _initialize() {
    logger.info('Initializing TranscriptionOrchestrator');
    
    // Get required services
    this.audioProcessingService = await this.getService('audioProcesing');
    this.transcriptionAPIService = await this.getService('transcriptionAPI');
    this.textProcessingService = await this.getService('textProcessing');
  }
  
  /**
   * Shutdown the service
   * @private
   */
  async _shutdown() {
    logger.info('Shutting down TranscriptionOrchestrator');
    
    // Reset services
    this.audioProcessingService = null;
    this.transcriptionAPIService = null;
    this.textProcessingService = null;
  }
  
  /**
   * Check if the service is currently processing
   * @returns {boolean} Processing status
   */
  isCurrentlyProcessing() {
    return this.isProcessing;
  }
  
  /**
   * Get current processing statistics
   * @returns {Object} Processing statistics
   */
  getProcessingStats() {
    return { ...this.processingStats };
  }
  
  /**
   * Reset processing statistics
   */
  resetProcessingStats() {
    this.processingStats = {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      commandCount: 0
    };
    
    logger.info('Processing statistics reset');
  }
  
  /**
   * Toggle command mode
   * @param {boolean} enabled - Enable or disable command mode
   */
  setCommandMode(enabled) {
    this.isCommandMode = enabled;
    logger.info(`Command mode ${enabled ? 'enabled' : 'disabled'}`);
    
    // Show notification
    this.getService('notification').showNotification({
      title: 'Command Mode',
      body: `Command mode ${enabled ? 'enabled' : 'disabled'}`,
      type: 'info',
      timeout: 1500
    });
  }
  
  /**
   * Process audio for transcription
   * @param {Buffer} audioBuffer - Raw audio buffer from recording
   * @returns {Promise<{success: boolean, text: string, isCommand: boolean}>} Transcription result
   */
  async processAudioTranscription(audioBuffer) {
    // Guard against concurrent processing
    if (this.isProcessing) {
      logger.warn('Already processing an audio transcription');
      return { success: false, text: '', isCommand: false };
    }
    
    // Set processing flag
    this.isProcessing = true;
    this.processingStats.totalRequests++;
    
    // Show initial notification
    this.getService('notification').showNotification({
      title: 'Processing Audio',
      body: 'Preparing your recording...',
      type: 'info',
      timeout: 1000
    });
    
    try {
      // Calculate audio signature for cache check
      const audioSignature = this.audioProcessingService.calculateAudioSignature(audioBuffer);
      
      // Check cache for matches
      const cachedTranscription = this.audioProcessingService.getCachedTranscription(audioSignature);
      
      // If cached, use that result
      if (cachedTranscription) {
        await this._handleCachedTranscription(cachedTranscription);
        return { success: true, text: cachedTranscription, isCommand: this.isCommandMode };
      }
      
      // Prepare audio for transcription (convert to WAV, create temp file)
      const { wavData, tempFile } = await this.audioProcessingService.prepareAudioForTranscription(audioBuffer);
      
      // Show processing notification
      this.getService('notification').showNotification({
        title: 'Transcribing Audio',
        body: 'Converting speech to text...',
        type: 'info',
        timeout: 1500
      });
      
      // Prepare context to help with transcription accuracy
      const contextService = await this.getService('context');
      const transcriptionContext = await contextService.getContextForTranscription();
      
      // Call transcription API
      const transcribedText = await this.transcriptionAPIService.transcribeAudio(
        tempFile,
        { 
          prompt: transcriptionContext,
          language: 'en'
        }
      );
      
      // Process the transcribed text
      const processedTextResult = await this.textProcessingService.processText(
        transcribedText,
        { 
          isCommandMode: this.isCommandMode,
          shouldCapitalize: true,
          checkForCommands: true
        }
      );
      
      // Cache successful result
      this.audioProcessingService.cacheTranscriptionResult(audioSignature, processedTextResult.text);
      
      // Handle result based on whether it's a command
      if (processedTextResult.isCommand) {
        await this._handleAICommand(processedTextResult.text);
      } else {
        await this._handleDictationText(processedTextResult.text);
      }
      
      // Cleanup temp file
      await this.audioProcessingService.cleanupTempFile(tempFile);
      
      // Increment success counter
      this.processingStats.successCount++;
      
      // Return result
      return {
        success: true,
        text: processedTextResult.text,
        isCommand: processedTextResult.isCommand
      };
    } catch (error) {
      logger.error('Error processing audio transcription:', error);
      
      // Show error notification
      this.getService('notification').showNotification({
        title: 'Transcription Failed',
        body: 'Could not transcribe audio.',
        type: 'error',
        timeout: 1500
      });
      
      // Increment error counter
      this.processingStats.errorCount++;
      
      return {
        success: false,
        text: '',
        isCommand: false
      };
    } finally {
      // Reset processing flag
      this.isProcessing = false;
    }
  }
  
  /**
   * Handle cached transcription result
   * @param {string} transcription - Cached transcription text
   * @private
   */
  async _handleCachedTranscription(transcription) {
    logger.info('Using cached transcription result');
    
    // Show notification
    this.getService('notification').showNotification({
      title: 'Using Cached Result',
      body: 'Using previously transcribed text',
      type: 'info',
      timeout: 1000
    });
    
    // Process as either command or dictation based on mode
    if (this.isCommandMode) {
      await this._handleAICommand(transcription);
    } else {
      await this._handleDictationText(transcription);
    }
  }
  
  /**
   * Handle AI command
   * @param {string} commandText - Command text
   * @private
   */
  async _handleAICommand(commandText) {
    logger.info('Processing AI command:', commandText);
    
    try {
      // Get AI service
      const aiService = await this.getService('ai');
      
      // Show notification
      this.getService('notification').showNotification({
        title: 'Processing AI Command',
        body: 'Executing your command...',
        type: 'info',
        timeout: 1500
      });
      
      // Process command
      const result = await aiService.processCommand(commandText);
      
      if (result.success) {
        // Show success notification
        this.getService('notification').showNotification({
          title: 'Command Completed',
          body: 'Your command was processed successfully',
          type: 'success',
          timeout: 1500
        });
      } else {
        // Show error notification
        this.getService('notification').showNotification({
          title: 'Command Failed',
          body: result.error || 'Failed to process command',
          type: 'error',
          timeout: 2000
        });
      }
      
      // Increment command counter
      this.processingStats.commandCount++;
    } catch (error) {
      logger.error('Error processing AI command:', error);
      
      // Show error notification
      this.getService('notification').showNotification({
        title: 'Command Failed',
        body: 'Error processing AI command',
        type: 'error',
        timeout: 2000
      });
    }
  }
  
  /**
   * Handle dictation text
   * @param {string} text - Processed dictation text
   * @private
   */
  async _handleDictationText(text) {
    logger.info('Inserting dictation text');
    
    try {
      // Insert text
      const inserted = await this.textProcessingService.insertText(text);
      
      if (inserted) {
        // Show success notification
        this.getService('notification').showNotification({
          title: 'Text Inserted',
          body: 'Dictation complete',
          type: 'success',
          timeout: 1000
        });
      } else {
        // Show error notification
        this.getService('notification').showNotification({
          title: 'Insertion Failed',
          body: 'Could not insert dictated text',
          type: 'error',
          timeout: 1500
        });
      }
    } catch (error) {
      logger.error('Error inserting dictation text:', error);
      
      // Show error notification
      this.getService('notification').showNotification({
        title: 'Insertion Failed',
        body: 'Error inserting dictated text',
        type: 'error',
        timeout: 1500
      });
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new TranscriptionOrchestrator(); 