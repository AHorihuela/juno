const record = require('node-record-lpcm16');
const { EventEmitter } = require('events');
const transcriptionService = require('./transcriptionService');

class AudioRecorder extends EventEmitter {
  constructor() {
    super();
    this.recording = false;
    this.recorder = null;
    this.audioData = [];
  }

  start() {
    if (this.recording) return;
    
    try {
      this.recorder = record.record({
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw',
      });

      // Reset audio data buffer
      this.audioData = [];

      // Log audio data for testing
      this.recorder.stream()
        .on('data', (data) => {
          this.audioData.push(data);
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

  async stop() {
    if (!this.recording) return;
    
    try {
      if (this.recorder) {
        this.recorder.stop();
        this.recorder = null;
      }
      this.recording = false;

      // Combine all audio data into a single buffer
      const completeAudioData = Buffer.concat(this.audioData);
      
      // Get transcription
      try {
        const transcription = await transcriptionService.transcribeAudio(completeAudioData);
        this.emit('transcription', transcription);
        console.log('Transcription:', transcription);
      } catch (error) {
        console.error('Transcription error:', error);
        this.emit('error', error);
      }

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