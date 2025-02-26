/**
 * Analyzes audio levels and detects speech vs. silence
 */
class AudioLevelAnalyzer {
  constructor(services) {
    this.services = services;
    this.silenceThreshold = 20;
    this.levelSmoothingFactor = 0.7;
    this.currentLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.hasAudioContent = false;
  }

  /**
   * Resets the analyzer state
   */
  reset() {
    this.hasAudioContent = false;
    this.currentLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  /**
   * Processes an audio buffer to detect levels and speech
   * @param {Buffer} buffer - The audio buffer to analyze
   * @param {boolean} isPaused - Whether recording is paused
   * @returns {boolean} - True if speech was detected
   */
  processBuffer(buffer, isPaused = false) {
    if (!buffer || isPaused) return false;
    
    // Convert buffer to 16-bit samples
    const samples = new Int16Array(buffer.buffer);
    
    // Calculate RMS (Root Mean Square) of the audio samples
    let sum = 0;
    let max = 0;
    let min = 0;
    let samplesAboveThreshold = 0;
    let consecutiveSamplesAboveThreshold = 0;
    let maxConsecutiveSamplesAboveThreshold = 0;
    let currentConsecutive = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.abs(samples[i]);
      sum += sample * sample;
      max = Math.max(max, sample);
      min = Math.min(min, sample);
      
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
    
    // Even more sensitive normalization (reduced from 2000 to 1800)
    // Apply an even stronger non-linear curve to significantly amplify quieter sounds
    // The power of 0.5 makes the curve more aggressive for low values
    const normalizedLevel = Math.min(1, Math.pow(rms / 1800, 0.5));
    
    // Update smoothed levels with enhanced randomization for more visual interest
    for (let i = 0; i < this.currentLevels.length; i++) {
      // Higher minimum level (0.28) to ensure bars are always visibly moving
      // Add more randomization for more dynamic visualization
      const targetLevel = Math.max(0.28, normalizedLevel * (0.6 + Math.random() * 0.8));
      
      // Apply smoothing with the updated factor
      this.currentLevels[i] = this.currentLevels[i] * (1 - this.levelSmoothingFactor) +
                           targetLevel * this.levelSmoothingFactor;
    }

    // Send levels to overlay service
    if (this.services) {
      const overlayService = this.services.overlay;
      if (overlayService) {
        overlayService.updateOverlayAudioLevels(this.currentLevels);
      }
    }
    
    // Calculate percentage of samples above threshold
    const percentageAboveThreshold = (samplesAboveThreshold / samples.length) * 100;
    
    // More stringent thresholds to better distinguish between ambient noise and actual speech
    // Requires both a minimum percentage of samples above threshold AND a minimum RMS value
    const isActualSpeech = percentageAboveThreshold > 12 && 
                          maxConsecutiveSamplesAboveThreshold > 30 &&
                          rms > 300;
    
    // Log detailed audio metrics for debugging
    if (isActualSpeech) {
      console.log('Speech detected:', {
        rms: Math.round(rms),
        percentageAboveThreshold: Math.round(percentageAboveThreshold),
        maxConsecutive: maxConsecutiveSamplesAboveThreshold
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
      return {
        hasRealSpeech: false,
        percentageAboveThreshold: 0,
        averageRMS: 0
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
    
    // Calculate RMS value for better audio content detection
    const averageRMS = Math.round(
      audioData.reduce((sum, chunk) => {
        const samples = new Int16Array(chunk.buffer);
        const rms = Math.sqrt(samples.reduce((s, sample) => s + sample * sample, 0) / samples.length);
        return sum + rms;
      }, 0) / audioData.length
    );
    
    // More stringent check for audio content - requires both percentage above threshold
    // and minimum RMS value to consider it valid speech
    const hasRealSpeech = percentageAboveThreshold > 15 && averageRMS > 300;
    
    return {
      hasRealSpeech,
      percentageAboveThreshold,
      averageRMS
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