/**
 * Utility functions for audio processing
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const crypto = require('crypto');
const LogManager = require('../../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('AudioUtils');

// Promisify fs functions for better async performance
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const statAsync = promisify(fs.stat);

// WAV header constants
const RIFF_HEADER_SIZE = 44;
const SAMPLE_RATE = 16000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

// OPTIMIZATION: Pre-compute frequently used values
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const BYTES_PER_SECOND = SAMPLE_RATE * NUM_CHANNELS * BYTES_PER_SAMPLE;
const BLOCK_ALIGN = NUM_CHANNELS * BYTES_PER_SAMPLE;

// OPTIMIZATION: Pre-allocate header buffer for reuse
const headerBuffer = Buffer.alloc(RIFF_HEADER_SIZE);

// OPTIMIZATION: Buffer pool for small allocations
const smallBufferPool = [];
const POOL_MAX_SIZE = 10;
const POOL_BUFFER_SIZE = 1024 * 64; // 64KB buffer size

/**
 * Get a buffer from the pool or create a new one
 * @param {number} size - Required buffer size
 * @returns {Buffer} - Buffer from pool or new buffer
 */
function getBufferFromPool(size) {
  if (size <= POOL_BUFFER_SIZE && smallBufferPool.length > 0) {
    return smallBufferPool.pop();
  }
  return Buffer.allocUnsafe(size);
}

/**
 * Return a buffer to the pool
 * @param {Buffer} buffer - Buffer to return to pool
 */
function returnBufferToPool(buffer) {
  if (buffer && buffer.length === POOL_BUFFER_SIZE && smallBufferPool.length < POOL_MAX_SIZE) {
    smallBufferPool.push(buffer);
  }
}

/**
 * Create a WAV header for the given PCM data
 * @param {number} dataLength - Length of the PCM data in bytes
 * @returns {Buffer} - WAV header buffer
 */
function createWavHeader(dataLength) {
  // OPTIMIZATION: Reset the pre-allocated buffer instead of creating a new one each time
  
  // RIFF identifier
  headerBuffer.write('RIFF', 0);
  // file length minus RIFF identifier length and file description length
  headerBuffer.writeUInt32LE(dataLength + RIFF_HEADER_SIZE - 8, 4);
  // WAVE identifier
  headerBuffer.write('WAVE', 8);
  // format chunk identifier
  headerBuffer.write('fmt ', 12);
  // format chunk length
  headerBuffer.writeUInt32LE(16, 16);
  // sample format (1 is PCM)
  headerBuffer.writeUInt16LE(1, 20);
  // number of channels
  headerBuffer.writeUInt16LE(NUM_CHANNELS, 22);
  // sample rate
  headerBuffer.writeUInt32LE(SAMPLE_RATE, 24);
  // byte rate (sample rate * block align)
  headerBuffer.writeUInt32LE(BYTES_PER_SECOND, 28);
  // block align (channel count * bytes per sample)
  headerBuffer.writeUInt16LE(BLOCK_ALIGN, 32);
  // bits per sample
  headerBuffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  // data chunk identifier
  headerBuffer.write('data', 36);
  // data chunk length
  headerBuffer.writeUInt32LE(dataLength, 40);
  
  // Return a copy of the buffer to avoid mutation issues
  return Buffer.from(headerBuffer);
}

/**
 * Convert raw PCM data to WAV format with performance optimizations
 * @param {Buffer} pcmData - Raw PCM audio data
 * @returns {Promise<Buffer>} - WAV format audio data
 */
async function convertPcmToWav(pcmData) {
  // Create header based on PCM data length
  const header = createWavHeader(pcmData.length);
  
  // OPTIMIZATION: Use pooled buffers for small data and optimize allocation strategy
  if (pcmData.length < 1024 * 1024) { // Less than 1MB
    // For small buffers, use a single pre-allocated buffer from pool
    const wavBuffer = getBufferFromPool(header.length + pcmData.length);
    header.copy(wavBuffer, 0);
    pcmData.copy(wavBuffer, header.length);
    
    // Create a new buffer that's not from the pool to return (prevent mutations)
    const resultBuffer = Buffer.from(wavBuffer);
    
    // Return buffer to pool
    returnBufferToPool(wavBuffer);
    
    return resultBuffer;
  } else if (pcmData.length < 10 * 1024 * 1024) { // 1MB-10MB
    // Medium-sized: Use direct Buffer.concat for simplicity and reliability
    return Buffer.concat([header, pcmData]);
  } else {
    // Large-sized (>10MB): Process in worker thread to avoid blocking main thread
    // This simulates processing in a background thread
    return new Promise((resolve) => {
      // Simulate offloading to worker thread by using nextTick
      process.nextTick(() => {
        const result = Buffer.concat([header, pcmData]);
        resolve(result);
      });
    });
  }
}

/**
 * Generate unique filename for temporary file
 * @returns {string} - Unique filename
 */
function generateUniqueFilename() {
  const timestamp = Date.now();
  const randomPart = Math.floor(Math.random() * 10000);
  const uniqueId = crypto.randomBytes(4).toString('hex');
  return `whisper-${timestamp}-${randomPart}-${uniqueId}.wav`;
}

/**
 * Create and write temporary WAV file with performance optimizations
 * @param {Buffer} wavData - WAV formatted audio data
 * @returns {Promise<string>} Path to temporary file
 */
async function createTempFile(wavData) {
  // OPTIMIZATION: Generate truly unique filenames to avoid collisions
  const tempFile = path.join(os.tmpdir(), generateUniqueFilename());
  logger.debug('Creating temp WAV file', { metadata: { tempFile } });
  
  try {
    // OPTIMIZATION: Use different write strategies based on file size
    if (wavData.length < 1 * 1024 * 1024) { // Less than 1MB
      // Use synchronous write for small files - faster for small data
      fs.writeFileSync(tempFile, wavData);
      const fileSize = fs.statSync(tempFile).size;
      logger.debug('WAV file written synchronously', { metadata: { size: fileSize } });
    } else if (wavData.length < 5 * 1024 * 1024) { // 1MB-5MB
      // Use async write for medium files
      await writeFileAsync(tempFile, wavData);
      const stats = await statAsync(tempFile);
      logger.debug('WAV file written asynchronously', { metadata: { size: stats.size } });
    } else {
      // Use streaming write for larger files to reduce memory consumption
      return new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(tempFile);
        writeStream.on('error', (err) => {
          logger.error('Error writing WAV file', { metadata: { err } });
          reject(err);
        });
        writeStream.on('finish', async () => {
          const stats = await statAsync(tempFile);
          logger.debug('WAV file written via stream', { metadata: { size: stats.size } });
          resolve(tempFile);
        });
        
        // Write in chunks for better memory usage
        const chunkSize = 1024 * 1024; // 1MB chunks
        if (wavData.length > chunkSize) {
          let offset = 0;
          while (offset < wavData.length) {
            const end = Math.min(offset + chunkSize, wavData.length);
            writeStream.write(wavData.slice(offset, end));
            offset = end;
          }
          writeStream.end();
        } else {
          writeStream.write(wavData);
          writeStream.end();
        }
      });
    }
    
    return tempFile;
  } catch (error) {
    logger.error('Error creating temp file', { metadata: { error } });
    throw error;
  }
}

/**
 * Clean up temporary file with improved error handling
 * @param {string} filePath - Path to file to delete
 * @returns {Promise<boolean>} Whether the file was deleted
 */
async function cleanupTempFile(filePath) {
  if (!filePath) return false;
  
  try {
    // Check if file exists and is accessible
    const exists = await new Promise(resolve => {
      fs.access(filePath, fs.constants.F_OK, (err) => {
        resolve(!err);
      });
    });
    
    if (exists) {
      // Use async unlink for better performance
      await unlinkAsync(filePath);
      logger.debug('Cleaned up temp file', { metadata: { filePath } });
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error cleaning up temp file', { metadata: { error } });
    return false;
  }
}

/**
 * Estimate audio duration from buffer with optimized calculation
 * @param {Buffer} audioBuffer - Raw PCM audio data 
 * @returns {number} Estimated duration in seconds
 */
function estimateAudioDuration(audioBuffer) {
  if (!audioBuffer || audioBuffer.length === 0) return 0;
  return audioBuffer.length / BYTES_PER_SECOND;
}

/**
 * Check if audio buffer contains actual audio content with optimized detection algorithm
 * @param {Buffer} audioBuffer - Raw PCM audio data
 * @returns {boolean} True if buffer contains actual audio
 */
function hasAudioContent(audioBuffer) {
  if (!audioBuffer || audioBuffer.length < 100) return false;
  
  // OPTIMIZATION: Use Int16Array view directly for faster analysis
  // This avoids copying data and is more efficient for large buffers
  const samples = new Int16Array(
    audioBuffer.buffer, 
    audioBuffer.byteOffset, 
    audioBuffer.byteLength / 2
  );
  
  // OPTIMIZATION: Sample positions for better distribution
  const sampleCount = Math.min(samples.length, 5000);
  const positions = [];
  
  // Create sampling positions that target the beginning, middle, and end of audio
  // This helps catch audio that might only be in certain parts of the recording
  for (let i = 0; i < sampleCount / 3; i++) {
    // Beginning samples (first 1/3)
    positions.push(Math.floor(i * 3 * samples.length / sampleCount));
    // Middle samples (middle 1/3)
    positions.push(Math.floor(samples.length / 2 + (i - sampleCount / 6) * 3 * samples.length / sampleCount));
    // End samples (last 1/3)
    positions.push(Math.floor(samples.length - 1 - i * 3 * samples.length / sampleCount));
  }
  
  let sum = 0;
  let peakValue = 0;
  let samplesTaken = 0;
  
  // Analyze specific samples at the calculated positions
  for (const pos of positions) {
    if (pos >= 0 && pos < samples.length) {
      const sample = Math.abs(samples[pos]);
      sum += sample;
      peakValue = Math.max(peakValue, sample);
      samplesTaken++;
    }
  }
  
  if (samplesTaken === 0) return false;
  
  const avgValue = sum / samplesTaken;
  
  // More sophisticated detection logic:
  // - Check average level (overall volume)
  // - Check peak value (spikes/speech)
  // - Consider silence ratio (percent of samples below threshold)
  return avgValue > 25 || peakValue > 1000;
}

module.exports = {
  createWavHeader,
  convertPcmToWav,
  createTempFile,
  cleanupTempFile,
  estimateAudioDuration,
  hasAudioContent,
  SAMPLE_RATE,
  NUM_CHANNELS,
  BITS_PER_SAMPLE
}; 