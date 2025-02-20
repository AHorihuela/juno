const record = require('node-record-lpcm16');
const { EventEmitter } = require('events');

class AudioRecorder extends EventEmitter {
  constructor() {
    super();
    this.recording = false;
    this.recorder = null;
  }

  start() {
    if (this.recording) return;
    
    try {
      this.recorder = record.record({
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw',
      });

      // Log audio data for testing
      this.recorder.stream()
        .on('data', (data) => {
          this.emit('data', data);
          console.log('Audio data received:', data.length, 'bytes');
        })
        .on('error', (err) => {
          console.error('Recording error:', err);
          this.emit('error', err);
          this.stop();
        });

      this.recording = true;
      this.emit('start');
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.emit('error', error);
    }
  }

  stop() {
    if (!this.recording) return;
    
    try {
      if (this.recorder) {
        this.recorder.stop();
        this.recorder = null;
      }
      this.recording = false;
      this.emit('stop');
      console.log('Recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.emit('error', error);
    }
  }

  isRecording() {
    return this.recording;
  }
}

module.exports = new AudioRecorder(); 