/**
 * Manages the audio data recording, including chunks, timing and metadata
 */
class AudioRecording {
  constructor() {
    this.chunks = [];
    this.startTime = Date.now();
    this.totalPausedTime = 0;
    this.pauseStartTime = null;
  }

  addChunk(chunk) {
    if (chunk) {
      this.chunks.push(chunk);
      return true;
    }
    return false;
  }

  reset() {
    this.chunks = [];
    this.startTime = Date.now();
    this.totalPausedTime = 0;
    this.pauseStartTime = null;
  }

  startPause() {
    if (!this.pauseStartTime) {
      this.pauseStartTime = Date.now();
      return true;
    }
    return false;
  }

  endPause() {
    if (this.pauseStartTime) {
      this.totalPausedTime += (Date.now() - this.pauseStartTime);
      this.pauseStartTime = null;
      return this.totalPausedTime;
    }
    return this.totalPausedTime;
  }

  getDurationSeconds() {
    const totalElapsed = Date.now() - this.startTime;
    const actualDuration = (totalElapsed - this.totalPausedTime) / 1000;
    return actualDuration; 
  }

  getCombinedData() {
    return Buffer.concat(this.chunks);
  }

  getChunkCount() {
    return this.chunks.length;
  }

  getTotalBytes() {
    return this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  }

  getAudioDurationEstimate() {
    // LPCM 16-bit mono at 16kHz = 2 bytes per sample, 16000 samples per second
    return (this.getTotalBytes() / (2 * 16000)).toFixed(2) + 's';
  }
}

module.exports = AudioRecording; 