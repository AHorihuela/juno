const LogManager = require('../../utils/LogManager');
const RecorderUtilities = require('./RecorderUtilities');

const logger = LogManager.getLogger('RecorderTranscription');

/**
 * Handles transcription processing for the recorder
 */
class RecorderTranscription {
  /**
   * Creates a new transcription handler
   * @param {Object} serviceProvider - Object with getService method
   */
  constructor(serviceProvider) {
    this.serviceProvider = serviceProvider;
  }

  /**
   * Transcribes audio data and emits events
   * @param {Buffer} audioData - The audio data to transcribe
   * @param {Object} analysisResult - Results from audio analysis
   * @param {Function} emitEvent - Function to emit events (transcription, error)
   * @returns {Promise<string|null>} - Transcription text if successful
   */
  async transcribeAudio(audioData, analysisResult, emitEvent) {
    logger.info('Starting audio transcription process', {
      metadata: {
        audioSize: audioData.length,
        hasAudioContent: analysisResult?.hasAudioContent || false
      }
    });

    try {
      // Get transcription service
      const transcriptionService = this.serviceProvider.getService('transcription');
      if (!transcriptionService) {
        throw new Error('Transcription service not available');
      }

      // Perform transcription
      const transcription = await transcriptionService.transcribeAudio(audioData);
      
      // Process result with type safety
      if (transcription) {
        // Emit transcription event
        if (emitEvent) {
          emitEvent('transcription', transcription);
        }
        
        // Get type-safe transcription data
        const typeSafeData = RecorderUtilities.getTypeSafeTranscription(transcription);
        
        logger.info('Transcription received:', { 
          metadata: { 
            transcriptionLength: typeSafeData.length,
            transcriptionPreview: typeSafeData.preview
          } 
        });
        
        return transcription;
      } else {
        // Handle empty transcription
        logger.warn('Empty transcription received');
        // No error notification needed since TranscriptionService already handles this
        return null;
      }
    } catch (error) {
      return this.handleTranscriptionError(error, emitEvent);
    }
  }

  /**
   * Handles transcription errors
   * @param {Error} error - The error that occurred
   * @param {Function} emitEvent - Function to emit error event
   * @returns {null} - Always returns null
   */
  handleTranscriptionError(error, emitEvent) {
    // Only log as error and show notification if it's a real error
    logger.error('Transcription error:', { 
      metadata: { 
        error: error.message || 'Unknown error',
        stack: error.stack
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        cpus: require('os').cpus().length
      }
    });
    
    // Check if this is a suppressed error that we shouldn't play sound for
    // This can be the case when text is in the clipboard but insertion failed
    const shouldSuppressErrorSound = error && 
      error.suppressErrorSound === true;
    
    // Get notification service
    const notificationService = this.serviceProvider.getService('notification');
    
    if (notificationService) {
      // Only show error notification if we're not suppressing the error
      if (!shouldSuppressErrorSound) {
        notificationService.showNotification(
          'Transcription Failed',
          error.message || 'Failed to transcribe audio',
          'error'
        );
      } else {
        // For suppressed errors, show a more helpful notification
        notificationService.showNotification(
          'Manual Paste Required',
          'Text is in your clipboard. Press Cmd+V or Ctrl+V to paste.',
          'info'
        );
        logger.info('Error sound suppressed for clipboard fallback scenario');
      }
    }
    
    // Emit error event
    if (emitEvent) {
      emitEvent('error', error);
    }
    
    return null;
  }
}

module.exports = RecorderTranscription; 