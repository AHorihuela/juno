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

/**
 * Create a WAV header for the given PCM data
 * @param {number} dataLength - Length of the PCM data in bytes
 * @returns {Buffer} - WAV header buffer
 */
function createWavHeader(dataLength) {
  const buffer = Buffer.alloc(RIFF_HEADER_SIZE);
  
  // RIFF identifier
  buffer.write('RIFF', 0);
  // file length minus RIFF identifier length and file description length
  buffer.writeUInt32LE(dataLength + RIFF_HEADER_SIZE - 8, 4);
  // WAVE identifier
  buffer.write('WAVE', 8);
  // format chunk identifier
  buffer.write('fmt ', 12);
  // format chunk length
  buffer.writeUInt32LE(16, 16);
  // sample format (1 is PCM)
  buffer.writeUInt16LE(1, 20);
  // number of channels
  buffer.writeUInt16LE(NUM_CHANNELS, 22);
  // sample rate
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  // byte rate (sample rate * block align)
  buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE / 8, 28);
  // block align (channel count * bytes per sample)
  buffer.writeUInt16LE(NUM_CHANNELS * BITS_PER_SAMPLE / 8, 32);
  // bits per sample
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  // data chunk identifier
  buffer.write('data', 36);
  // data chunk length
  buffer.writeUInt32LE(dataLength, 40);
  
  return buffer;
}

/**
 * Convert raw PCM data to WAV format
 * @param {Buffer} pcmData - Raw PCM audio data
 * @returns {Buffer} - WAV format audio data
 */
function convertPcmToWav(pcmData) {
  const header = createWavHeader(pcmData.length);
  return Buffer.concat([header, pcmData]);
}

/**
 * Create and write temporary WAV file
 * @param {Buffer} wavData - WAV formatted audio data
 * @returns {Promise<string>} Path to temporary file
 */
async function createTempFile(wavData) {
  const tempFile = path.join(os.tmpdir(), `whisper-${Date.now()}.wav`);
  console.log('[AudioUtils] Creating temp WAV file:', tempFile);
  
  // Use writeFileSync for smaller files to reduce overhead
  if (wavData.length < 10 * 1024 * 1024) { // Less than 10MB
    fs.writeFileSync(tempFile, wavData);
    const fileSize = fs.statSync(tempFile).size;
    console.log('[AudioUtils] WAV file written synchronously, size:', fileSize);
  } else {
    await fs.promises.writeFile(tempFile, wavData);
    const fileSize = fs.statSync(tempFile).size;
    console.log('[AudioUtils] WAV file written asynchronously, size:', fileSize);
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

module.exports = {
  createWavHeader,
  convertPcmToWav,
  createTempFile,
  cleanupTempFile,
  SAMPLE_RATE,
  NUM_CHANNELS,
  BITS_PER_SAMPLE
}; 