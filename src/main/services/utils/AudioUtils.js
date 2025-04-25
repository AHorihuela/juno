/**
 * Utility functions for audio processing
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

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
 * Convert raw PCM data to WAV format
 * @param {Buffer} pcmData - Raw PCM audio data
 * @returns {Buffer} - WAV format audio data
 */
function convertPcmToWav(pcmData) {
  const header = createWavHeader(pcmData.length);
  
  // OPTIMIZATION: Use Buffer.concat more efficiently
  // For small buffers, use a single allocation strategy
  if (pcmData.length < 1024 * 1024) { // Less than 1MB
    const wavBuffer = Buffer.allocUnsafe(header.length + pcmData.length);
    header.copy(wavBuffer, 0);
    pcmData.copy(wavBuffer, header.length);
    return wavBuffer;
  } else {
    // For larger buffers, use standard concat
    return Buffer.concat([header, pcmData]);
  }
}

/**
 * Create and write temporary WAV file
 * @param {Buffer} wavData - WAV formatted audio data
 * @returns {Promise<string>} Path to temporary file
 */
async function createTempFile(wavData) {
  // OPTIMIZATION: Use randomized filenames to avoid collisions in high-volume scenarios
  const randomId = Math.floor(Math.random() * 10000);
  const tempFile = path.join(os.tmpdir(), `whisper-${Date.now()}-${randomId}.wav`);
  console.log('[AudioUtils] Creating temp WAV file:', tempFile);
  
  // OPTIMIZATION: Use optimized write strategy based on file size
  if (wavData.length < 5 * 1024 * 1024) { // Less than 5MB
    // Use synchronous write for small files - faster for small data
    fs.writeFileSync(tempFile, wavData);
    const fileSize = fs.statSync(tempFile).size;
    console.log('[AudioUtils] WAV file written synchronously, size:', fileSize);
  } else {
    // Use streaming write for larger files to reduce memory consumption
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(tempFile);
      writeStream.on('error', (err) => {
        console.error('[AudioUtils] Error writing WAV file:', err);
        reject(err);
      });
      writeStream.on('finish', () => {
        const fileSize = fs.statSync(tempFile).size;
        console.log('[AudioUtils] WAV file written via stream, size:', fileSize);
        resolve(tempFile);
      });
      
      writeStream.write(wavData);
      writeStream.end();
    });
  }
  
  return tempFile;
}

/**
 * Clean up temporary file
 * @param {string} filePath - Path to file to delete
 * @returns {Promise<boolean>} Whether the file was deleted
 */
async function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[AudioUtils] Cleaned up temp file:', filePath);
      return true;
    }
  } catch (error) {
    console.error('[AudioUtils] Error cleaning up temp file:', error);
  }
  return false;
}

/**
 * Estimate audio duration from buffer
 * @param {Buffer} audioBuffer - Raw PCM audio data 
 * @returns {number} Estimated duration in seconds
 */
function estimateAudioDuration(audioBuffer) {
  if (!audioBuffer || audioBuffer.length === 0) return 0;
  return audioBuffer.length / BYTES_PER_SECOND;
}

/**
 * Check if audio buffer contains actual audio content
 * @param {Buffer} audioBuffer - Raw PCM audio data
 * @returns {boolean} True if buffer contains actual audio
 */
function hasAudioContent(audioBuffer) {
  if (!audioBuffer || audioBuffer.length < 100) return false;
  
  // Convert to Int16Array for sample analysis
  const samples = new Int16Array(audioBuffer.buffer);
  
  // Analyze a subset of samples for performance
  const sampleCount = Math.min(samples.length, 10000);
  const sampleStep = Math.max(1, Math.floor(samples.length / sampleCount));
  
  let sum = 0;
  let peakValue = 0;
  
  for (let i = 0; i < samples.length; i += sampleStep) {
    const sample = Math.abs(samples[i]);
    sum += sample;
    peakValue = Math.max(peakValue, sample);
  }
  
  const avgValue = sum / (samples.length / sampleStep);
  return avgValue > 10 || peakValue > 500;
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