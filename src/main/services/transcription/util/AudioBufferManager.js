/**
 * AudioBufferManager - Manages audio buffers for transcription
 * 
 * This utility handles collecting and processing audio buffers
 * for efficient processing and background transcription.
 */

const logger = require('../../../logger');
const { Buffer } = require('buffer');

class AudioBufferManager {
  constructor(options = {}) {
    this.options = {
      maxBufferSize: 10 * 1024 * 1024, // 10MB default max buffer size
      chunkSize: 4000, // ~250ms of 16-bit 16kHz audio
      ...options
    };
    
    this.reset();
  }
  
  /**
   * Reset all buffers and state
   */
  reset() {
    this.audioBuffers = [];
    this.processedBuffers = [];
    this.totalBytes = 0;
    this.isProcessing = false;
    this.lastAddTime = 0;
    
    logger.debug('AudioBufferManager reset');
  }
  
  /**
   * Add a new audio buffer chunk
   * @param {Buffer} buffer Audio buffer to add
   * @returns {boolean} Whether buffer was added successfully
   */
  addBuffer(buffer) {
    if (!buffer || !(buffer instanceof Buffer)) {
      logger.warn('Invalid buffer provided to AudioBufferManager');
      return false;
    }
    
    // Skip empty buffers
    if (buffer.length === 0) {
      return false;
    }
    
    // Check if we'd exceed max size
    if (this.totalBytes + buffer.length > this.options.maxBufferSize) {
      logger.warn(`Audio buffer would exceed max size (${this.options.maxBufferSize} bytes)`);
      return false;
    }
    
    this.audioBuffers.push(buffer);
    this.totalBytes += buffer.length;
    this.lastAddTime = Date.now();
    
    return true;
  }
  
  /**
   * Mark all current buffers as processed
   */
  markCurrentBuffersAsProcessed() {
    // Move current buffers to processed list
    if (this.audioBuffers.length > 0) {
      this.processedBuffers = [...this.processedBuffers, ...this.audioBuffers];
      this.audioBuffers = [];
    }
  }
  
  /**
   * Get combined audio data from all unprocessed buffers
   * @returns {Buffer} Combined buffer
   */
  getCombinedBuffer() {
    if (this.audioBuffers.length === 0) {
      return Buffer.alloc(0);
    }
    
    return Buffer.concat(this.audioBuffers);
  }
  
  /**
   * Get all audio data (including processed buffers)
   * @returns {Buffer} Combined buffer with all audio
   */
  getAllAudioData() {
    const allBuffers = [...this.processedBuffers, ...this.audioBuffers];
    
    if (allBuffers.length === 0) {
      return Buffer.alloc(0);
    }
    
    return Buffer.concat(allBuffers);
  }
  
  /**
   * Get total duration of recorded audio (estimated)
   * @param {number} bytesPerSecond Bytes per second of audio (default: 32000 for 16kHz 16-bit mono)
   * @returns {number} Estimated duration in seconds
   */
  getEstimatedDuration(bytesPerSecond = 32000) {
    if (this.totalBytes === 0 || bytesPerSecond === 0) {
      return 0;
    }
    
    return this.totalBytes / bytesPerSecond;
  }
  
  /**
   * Check if there's enough new audio data to process 
   * @returns {boolean} Whether there's enough new data
   */
  hasEnoughNewDataToProcess() {
    const unprocessedBuffer = this.getCombinedBuffer();
    return unprocessedBuffer.length >= this.options.chunkSize;
  }
  
  /**
   * Get stats about the current buffers
   * @returns {Object} Buffer statistics
   */
  getStats() {
    return {
      totalBytes: this.totalBytes,
      unprocessedBytes: this.getCombinedBuffer().length,
      processedBytes: this.processedBuffers.reduce((acc, buf) => acc + buf.length, 0),
      bufferCount: this.audioBuffers.length,
      processedBufferCount: this.processedBuffers.length,
      estimatedDuration: this.getEstimatedDuration(),
      lastAddTime: this.lastAddTime
    };
  }
}

module.exports = AudioBufferManager; 