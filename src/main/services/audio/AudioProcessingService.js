/**
 * AudioProcessingService - Handle audio processing operations
 * 
 * This service manages audio data manipulation, conversion, and temporary storage
 * for the transcription pipeline.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const BaseService = require('../BaseService');
const LogManager = require('../../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('AudioProcessingService');

class AudioProcessingService extends BaseService {
  constructor() {
    super('AudioProcessing');
    
    // Audio caching
    this.audioSignatureCache = new Map();
    this.cacheMaxSize = 100; // Maximum number of cached audio signatures
  }
  
  /**
   * Initialize the service
   * @private
   */
  async _initialize() {
    logger.info('Initializing AudioProcessingService');
  }
  
  /**
   * Shutdown the service
   * @private
   */
  async _shutdown() {
    logger.info('Shutting down AudioProcessingService');
    this.audioSignatureCache.clear();
  }

  /**
   * Calculate a simple audio signature for caching
   * @param {Buffer} audioBuffer - Raw audio buffer 
   * @returns {string} Audio signature
   */
  calculateAudioSignature(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) return '';
    
    // Calculate a simple signature based on buffer size and first few bytes
    const sampleSize = Math.min(audioBuffer.length, 1000);
    let signature = `size:${audioBuffer.length}`;
    
    // Add first 100 bytes sampled every 10 bytes
    for (let i = 0; i < sampleSize; i += 10) {
      signature += `:${audioBuffer[i]}`;
    }
    
    return signature;
  }
  
  /**
   * Check if audio has been previously processed
   * @param {string} audioSignature - Audio signature to check
   * @returns {string|null} Cached transcription text or null if not found
   */
  getCachedTranscription(audioSignature) {
    if (!audioSignature) return null;
    
    if (this.audioSignatureCache.has(audioSignature)) {
      logger.info('Found cached transcription for similar audio');
      return this.audioSignatureCache.get(audioSignature);
    }
    
    return null;
  }
  
  /**
   * Store transcription result for audio signature
   * @param {string} audioSignature - Audio signature
   * @param {string} transcribedText - Transcribed text to cache
   */
  cacheTranscriptionResult(audioSignature, transcribedText) {
    if (!audioSignature || !transcribedText) return;
    
    // Add to cache
    this.audioSignatureCache.set(audioSignature, transcribedText);
    
    // Limit cache size
    if (this.audioSignatureCache.size > this.cacheMaxSize) {
      // Remove oldest entry
      const firstKey = this.audioSignatureCache.keys().next().value;
      this.audioSignatureCache.delete(firstKey);
    }
  }
  
  /**
   * Clear audio cache
   */
  clearCache() {
    this.audioSignatureCache.clear();
    logger.info('Audio cache cleared');
  }
  
  /**
   * Prepare audio for transcription
   * @param {Buffer} audioBuffer - Raw audio buffer
   * @returns {Promise<{wavData: Buffer, tempFile: string}>} Prepared WAV data and temp file path
   */
  async prepareAudioForTranscription(audioBuffer) {
    const AudioUtils = require('../utils/AudioUtils');
    
    try {
      // Convert PCM to WAV format
      const wavData = await AudioUtils.convertPcmToWav(audioBuffer);
      
      // Create temporary file
      const tempFile = await AudioUtils.createTempFile(wavData);
      
      return { wavData, tempFile };
    } catch (error) {
      logger.error('Error preparing audio for transcription:', error);
      throw error;
    }
  }
  
  /**
   * Clean up temporary audio file
   * @param {string} tempFilePath - Path to temporary file
   */
  async cleanupTempFile(tempFilePath) {
    if (!tempFilePath) return;
    
    const AudioUtils = require('../utils/AudioUtils');
    try {
      await AudioUtils.cleanupTempFile(tempFilePath);
    } catch (error) {
      logger.error('Error cleaning up temp file:', error);
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new AudioProcessingService(); 