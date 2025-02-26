/**
 * Analyzes audio levels and detects speech vs. silence
 */
const LogManager = require('../../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('AudioLevelAnalyzer');

class AudioLevelAnalyzer {
  constructor(services) {
    this.services = services;
    this.silenceThreshold = 15;
    this.levelSmoothingFactor = 0.7;
    this.currentLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.hasAudioContent = false;
    this.peakRMS = 0; // Track peak RMS value
    this.updateCount = 0; // Track number of updates
    
    logger.info('AudioLevelAnalyzer initialized', {
      metadata: {
        silenceThreshold: this.silenceThreshold,
        levelSmoothingFactor: this.levelSmoothingFactor,
        servicesAvailable: Object.keys(this.services || {})
      }
    });
  }

  /**
   * Resets the analyzer state
   */
  reset() {
    this.hasAudioContent = false;
    this.currentLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.peakRMS = 0;
    this.updateCount = 0;
    logger.debug('AudioLevelAnalyzer reset');
  }

  /**
   * Processes an audio buffer to detect levels and speech
   * @param {Buffer} buffer - The audio buffer to analyze
   * @param {boolean} isPaused - Whether recording is paused
   * @returns {boolean} - True if speech was detected
   */
  processBuffer(buffer, isPaused = false) {
    if (!buffer || isPaused) {
      if (!buffer) logger.debug('Empty buffer received, skipping processing');
      if (isPaused) logger.debug('Recording is paused, skipping processing');
      return false;
    }
    
    // Convert buffer to 16-bit samples
    const samples = new Int16Array(buffer.buffer);
    
    // Calculate RMS (Root Mean Square) of the audio samples
    let sum = 0;
    let samplesAboveThreshold = 0;
    let maxConsecutiveSamplesAboveThreshold = 0;
    let currentConsecutive = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.abs(samples[i]);
      sum += sample * sample;
      
      if (sample > this.silenceThreshold) {
        samplesAboveThreshold++;
        currentConsecutive++;
        maxConsecutiveSamplesAboveThreshold = Math.max(
          maxConsecutiveSamplesAboveThreshold,
          currentConsecutive
        );
      } else {
        currentConsecutive = 0;
      }
    }
    
    const rms = Math.sqrt(sum / samples.length);
    
    // Track peak RMS value
    this.peakRMS = Math.max(this.peakRMS, rms);
    
    // More sensitive normalization - lower divisor makes it more responsive
    // Reduced from 2500 to 1500 for higher sensitivity
    const normalizedLevel = Math.min(1, rms / 1500);
    
    // Update levels with minimal smoothing for more responsiveness
    for (let i = 0; i < this.currentLevels.length; i++) {
      // Add more variation between bars (±25%) for more dynamic movement
      const variation = 0.75 + (Math.random() * 0.5);
      
      // Ensure a small minimum level so bars are always slightly visible
      const targetLevel = Math.max(0.1, normalizedLevel * variation);
      
      // Even less smoothing (0.2) for more immediate response to audio
      this.currentLevels[i] = this.currentLevels[i] * 0.2 + targetLevel * 0.8;
    }

    // Send levels to overlay service
    this.updateCount++;
    if (this.services) {
      const overlayService = this.services.overlay;
      if (overlayService) {
        try {
          // Send every update for more responsive visualization
          overlayService.updateOverlayAudioLevels(this.currentLevels);
          
          // Log every 20th update to avoid flooding logs
          if (this.updateCount % 20 === 0) {
            logger.debug('Updated overlay audio levels', {
              metadata: {
                updateCount: this.updateCount,
                rms: Math.round(rms),
                normalizedLevel: normalizedLevel.toFixed(2),
                levels: this.currentLevels.map(l => l.toFixed(2)).join(',')
              }
            });
          }
        } catch (error) {
          logger.error('Error updating overlay audio levels', {
            metadata: { error }
          });
        }
      } else {
        if (this.updateCount === 1 || this.updateCount % 100 === 0) {
          logger.warn('Overlay service not available for audio level updates');
        }
      }
    } else {
      if (this.updateCount === 1) {
        logger.warn('No services available for audio level updates');
      }
    }
    
    // Calculate percentage of samples above threshold
    const percentageAboveThreshold = (samplesAboveThreshold / samples.length) * 100;
    
    // More stringent thresholds to better distinguish between ambient noise and actual speech
    // Requires both a minimum percentage of samples above threshold AND a minimum RMS value
    const isActualSpeech = percentageAboveThreshold > 8 &&
                          maxConsecutiveSamplesAboveThreshold > 20 &&
                          rms > 200;
    
    // Log detailed audio metrics for debugging
    if (isActualSpeech) {
      logger.debug('Speech detected:', {
        metadata: {
          rms: Math.round(rms),
          percentageAboveThreshold: Math.round(percentageAboveThreshold),
          maxConsecutive: maxConsecutiveSamplesAboveThreshold
        }
      });
    }
    
    if (isActualSpeech) {
      this.hasAudioContent = true;
    }
    
    return isActualSpeech;
  }

  /**
   * Analyzes the final audio data to determine if it contains speech
   * @param {Array<Buffer>} audioData - The complete audio data
   * @returns {Object} - Analysis results
   */
  analyzeAudioContent(audioData) {
    if (!audioData || audioData.length === 0) {
      logger.debug('No audio data to analyze');
      return {
        hasRealSpeech: false,
        percentageAboveThreshold: 0,
        averageRMS: 0,
        peakRMS: 0
      };
    }
    
    // Calculate total samples
    const totalSamples = audioData.reduce((sum, chunk) => sum + chunk.length, 0);
    
    // Calculate samples above threshold
    const samplesAboveThreshold = audioData.reduce((sum, chunk) => {
      const samples = new Int16Array(chunk.buffer);
      return sum + samples.filter(s => Math.abs(s) > this.silenceThreshold).length;
    }, 0);
    
    const percentageAboveThreshold = (samplesAboveThreshold / totalSamples) * 100;
    
    // Calculate RMS values for better audio content detection
    let peakRMS = 0;
    const averageRMS = Math.round(
      audioData.reduce((sum, chunk) => {
        const samples = new Int16Array(chunk.buffer);
        const rms = Math.sqrt(samples.reduce((s, sample) => s + sample * sample, 0) / samples.length);
        peakRMS = Math.max(peakRMS, rms);
        return sum + rms;
      }, 0) / audioData.length
    );
    
    // More stringent check for audio content - requires either:
    // 1. Sufficient average RMS value, OR
    // 2. A high peak RMS value with some minimum percentage above threshold
    const hasRealSpeech = 
      (percentageAboveThreshold > 10 && averageRMS > 100) || 
      (percentageAboveThreshold > 5 && peakRMS > 300);
    
    logger.info('Audio content analysis complete', {
      metadata: {
        hasRealSpeech,
        percentageAboveThreshold: percentageAboveThreshold.toFixed(2),
        averageRMS,
        peakRMS: Math.round(peakRMS),
        totalSamples,
        samplesAboveThreshold,
        audioChunks: audioData.length
      }
    });
    
    return {
      hasRealSpeech,
      percentageAboveThreshold,
      averageRMS,
      peakRMS: Math.round(peakRMS)
    };
  }

  /**
   * Gets the current audio levels
   * @returns {Array<number>} - The current audio levels
   */
  getLevels() {
    return this.currentLevels;
  }

  /**
   * Checks if audio content has been detected
   * @returns {boolean} - True if audio content has been detected
   */
  hasDetectedAudioContent() {
    return this.hasAudioContent;
  }
}

module.exports = AudioLevelAnalyzer; 