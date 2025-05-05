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
      // OPTIMIZATION: Safely get transcription service and parallelize with analysis
      const transcriptionService = this.serviceProvider.getService('transcription');
      if (!transcriptionService) {
        throw new Error('Transcription service not available');
      }
      
      // Enhance analysis in parallel with other operations
      const enhancedAnalysisResult = await this._enhanceAudioAnalysis(audioData, analysisResult);

      // Skip transcription if audio analysis shows no content
      if (enhancedAnalysisResult && !enhancedAnalysisResult.hasAudioContent) {
        logger.info('Skipping transcription for audio with no detected content');
        if (emitEvent) {
          emitEvent('transcription', '');
        }
        return '';
      }

      // Perform transcription
      logger.debug('Calling transcriptionService.transcribeAudio()');
      const transcription = await transcriptionService.transcribeAudio(audioData);
      
      // Process result with type safety
      if (transcription) {
        // Ensure we're working with a string for the transcription
        const transcriptionText = typeof transcription === 'string' 
          ? transcription 
          : (transcription && transcription.text ? transcription.text : 'Transcription received');
        
        // Log the actual transcription for debugging
        logger.debug(`Emitting transcription event with text: "${transcriptionText}"`);
        
        // Emit transcription event with the correct text
        if (typeof emitEvent === 'function') {
          emitEvent('transcription', transcriptionText);
        }
        
        // Get type-safe transcription data
        const typeSafeData = RecorderUtilities.getTypeSafeTranscription(transcriptionText);
        
        logger.info('Transcription received:', { 
          metadata: { 
            transcriptionLength: typeSafeData.length,
            transcriptionPreview: typeSafeData.preview
          } 
        });
        
        return transcriptionText;
      } else {
        // Handle empty transcription
        logger.warn('Empty transcription received');
        // Ensure we emit an empty string rather than null/undefined
        if (typeof emitEvent === 'function') {
          emitEvent('transcription', '');
        }
        return '';
      }
    } catch (error) {
      return this.handleTranscriptionError(error, emitEvent);
    }
  }
  
  /**
   * Enhance audio analysis with additional checks
   * @param {Buffer} audioData - The audio data to analyze
   * @param {Object} baseAnalysisResult - Initial analysis results
   * @returns {Promise<Object>} - Enhanced analysis results
   * @private
   */
  async _enhanceAudioAnalysis(audioData, baseAnalysisResult) {
    try {
      // Start with existing analysis
      const result = { ...baseAnalysisResult };
      
      // If we already know there's content, no need for further analysis
      if (result.hasAudioContent) {
        return result;
      }
      
      // Do a more thorough analysis for borderline cases
      const AudioUtils = require('../utils/AudioUtils');
      
      // Check if audioData is a valid buffer
      if (audioData && audioData.length > 0) {
        // Perform more detailed audio content detection
        result.hasAudioContent = AudioUtils.hasAudioContent(audioData);
        result.audioDuration = AudioUtils.estimateAudioDuration(audioData);
        
        logger.debug('Enhanced audio analysis:', {
          metadata: {
            hasAudioContent: result.hasAudioContent,
            audioDuration: result.audioDuration
          }
        });
      }
      
      return result;
    } catch (error) {
      logger.warn('Error in enhanced audio analysis:', error);
      // Return original analysis if enhanced analysis fails
      return baseAnalysisResult;
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
        error: error?.message || 'Unknown error',
        stack: error?.stack
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        cpus: require('os').cpus().length
      }
    });
    
    // Temporarily suppress system sounds on macOS to prevent the system error sound
    // This is a targeted workaround for macOS system sounds
    if (process.platform === 'darwin') {
      try {
        const { exec } = require('child_process');
        // Lower the alert volume temporarily
        exec('osascript -e "set volume alert volume 0"', (err) => {
          if (err) {
            logger.warn('Failed to lower system alert volume:', err);
          } else {
            // Restore after 2 seconds
            setTimeout(() => {
              exec('osascript -e "set volume alert volume 5"', (restoreErr) => {
                if (restoreErr) {
                  logger.warn('Failed to restore system alert volume:', restoreErr);
                }
              });
            }, 2000);
          }
        });
      } catch (macErr) {
        logger.warn('Error suppressing macOS system sounds:', macErr);
      }
    }
    
    // Check if this is a suppressed error that we shouldn't play sound for
    // This can be the case when text is in the clipboard but insertion failed
    // OR when the error happens during the end of the recording flow
    // (which means the stop sound has already played)
    let shouldSuppressErrorSound = error && 
      (error.suppressErrorSound === true || 
       error.message?.includes('catch') ||  // Common error in transcription flow
       error.message?.includes('undefined') ||  // Common error in transcription flow
       error.message?.includes('API')); // API errors should not repeat the error sound
    
    // Always suppress error sound on macOS to avoid system sounds
    if (process.platform === 'darwin') {
      shouldSuppressErrorSound = true;
      logger.info('Suppressing error sound on macOS to avoid system sounds');
    }
    
    // Get notification service
    const notificationService = this.serviceProvider?.getService('notification');
    
    if (notificationService && typeof notificationService.show === 'function') {
      // Only show error notification if we're not suppressing the error
      if (!shouldSuppressErrorSound) {
        notificationService.show({
          title: 'Transcription Failed',
          body: error?.message || 'Failed to transcribe audio',
          type: 'error'
        });
      } else {
        // For suppressed errors, show a more helpful notification
        if (error?.message?.includes('API')) {
          // API error
          notificationService.show({
            title: 'Transcription Service Issue',
            body: 'There was a problem with the transcription service. Your recording is complete.',
            type: 'warning'
          });
        } else {
          // Other suppressed errors
          notificationService.show({
            title: 'Processing Issue',
            body: 'Your recording is complete, but there was an issue with text processing.',
            type: 'info'
          });
        }
        logger.info('Error sound suppressed for error:', error?.message);
      }
    }
    
    // Emit error event
    if (typeof emitEvent === 'function') {
      // Set suppressErrorSound flag to true for the emitted error
      // to ensure other handlers know this error sound should be suppressed
      const modifiedError = error || new Error('Unknown transcription error');
      modifiedError.suppressErrorSound = true;
      
      emitEvent('error', modifiedError);
    }
    
    return null;
  }
}

module.exports = RecorderTranscription; 