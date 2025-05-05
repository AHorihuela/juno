/**
 * SilenceDetector - Utility to detect silence in audio
 * 
 * This detects when the user has stopped speaking to help
 * provide faster transcription results
 */

const logger = require('../../../logger');

class SilenceDetector {
  /**
   * Create a new silence detector
   * @param {Object} options Configuration options
   * @param {number} options.silenceThreshold Volume level below which audio is considered silent (0-1)
   * @param {number} options.silenceDuration Duration of silence needed to trigger end of speech (ms)
   * @param {number} options.minSpeechDuration Minimum speech duration before silence detection (ms)
   */
  constructor(options = {}) {
    this.options = {
      silenceThreshold: 0.1, // Default threshold (0-1)
      silenceDuration: 1000, // Default 1 second of silence to detect end
      minSpeechDuration: 500, // Need at least 500ms of speech before we check for silence
      ...options
    };

    this.reset();
  }

  /**
   * Reset the detector state
   */
  reset() {
    this.silenceStart = null;
    this.speechStart = null;
    this.isSilent = true;
    this.hasSpeechOccurred = false;
    this.lastAudioLevel = 0;
    this.lastProcessTime = Date.now();
    this.audioSamples = [];
    
    logger.debug('Silence detector reset');
  }

  /**
   * Process an audio buffer to detect silence
   * @param {Buffer} buffer Raw audio buffer to analyze
   * @returns {boolean} Whether silence has been detected for the required duration
   */
  processAudio(buffer) {
    if (!buffer || buffer.length === 0) {
      return false;
    }

    // Calculate audio level from buffer (16-bit PCM assumed)
    const audioLevel = this._calculateAudioLevel(buffer);
    this.lastAudioLevel = audioLevel;
    
    // Current time for tracking
    const now = Date.now();
    
    // Store sample for analysis
    this.audioSamples.push({
      level: audioLevel,
      timestamp: now
    });
    
    // Keep only recent samples for memory efficiency
    const MAX_SAMPLES = 20;
    if (this.audioSamples.length > MAX_SAMPLES) {
      this.audioSamples.shift();
    }

    // Detect if current buffer is silent
    const currentlyIsSilent = audioLevel < this.options.silenceThreshold;

    // If we have speech transition to non-silent
    if (!currentlyIsSilent && this.isSilent) {
      logger.debug(`Speech detected, audio level: ${audioLevel.toFixed(2)}`);
      this.isSilent = false;
      this.silenceStart = null;
      
      // Mark the start of speech if not already set
      if (!this.speechStart) {
        this.speechStart = now;
      }
      
      // Mark that some speech has occurred in this session
      this.hasSpeechOccurred = true;
    }
    
    // If we have silence after speech, start/continue tracking silence duration
    if (currentlyIsSilent && !this.isSilent) {
      if (!this.silenceStart) {
        logger.debug(`Silence started after speech, audio level: ${audioLevel.toFixed(2)}`);
        this.silenceStart = now;
      }
      
      // Check if we've had silence long enough to return to silent state
      if (now - this.silenceStart >= this.options.silenceDuration) {
        logger.debug('Silence duration threshold reached, returning to silent state');
        this.isSilent = true;
      }
    }

    // Check if we need to report end of speech
    // Only if: 
    // 1. We've detected speech long enough
    // 2. We're now in a silent period
    // 3. Silence has lasted long enough
    const speechDetected = this.hasSpeechOccurred && this.speechStart;
    const speechLongEnough = speechDetected && (now - this.speechStart >= this.options.minSpeechDuration);
    const endingDetected = speechLongEnough && currentlyIsSilent && this.silenceStart;
    const silenceLongEnough = endingDetected && (now - this.silenceStart >= this.options.silenceDuration);
    
    this.lastProcessTime = now;
    
    return silenceLongEnough;
  }
  
  /**
   * Calculate audio level from a PCM buffer (root mean square)
   * @param {Buffer} buffer Raw audio PCM buffer
   * @returns {number} Audio level between 0-1
   * @private
   */
  _calculateAudioLevel(buffer) {
    // Early exit for empty buffer
    if (!buffer || buffer.length < 2) {
      return 0;
    }
    
    try {
      let sum = 0;
      let samples = 0;
      
      // Process as 16-bit PCM
      for (let i = 0; i < buffer.length; i += 2) {
        if (i + 1 >= buffer.length) break;
        
        // Convert to signed 16-bit
        const sample = buffer.readInt16LE(i);
        
        // Square the sample and add to sum
        sum += sample * sample;
        samples++;
      }
      
      if (samples === 0) return 0;
      
      // Calculate RMS
      const rms = Math.sqrt(sum / samples);
      
      // Normalize to 0-1 (65536 is max for 16-bit)
      return rms / 32768;
    } catch (error) {
      logger.error('Error calculating audio level:', error);
      return 0;
    }
  }

  /**
   * Calculate average audio level from recent samples
   * @returns {number} Average audio level (0-1)
   */
  getAverageAudioLevel() {
    if (this.audioSamples.length === 0) {
      return 0;
    }
    
    const sum = this.audioSamples.reduce((acc, sample) => acc + sample.level, 0);
    return sum / this.audioSamples.length;
  }
  
  /**
   * Check if speech has been detected and ended
   * @returns {boolean} Whether speech has ended
   */
  hasSpeechEnded() {
    // We need to have detected speech first
    if (!this.hasSpeechOccurred || !this.speechStart) {
      return false;
    }
    
    // Need minimum speech duration
    const now = Date.now();
    if (now - this.speechStart < this.options.minSpeechDuration) {
      return false;
    }
    
    // Need to be in silence state with enough silence duration
    return this.isSilent && this.silenceStart && 
           (now - this.silenceStart >= this.options.silenceDuration);
  }
}

module.exports = SilenceDetector; 