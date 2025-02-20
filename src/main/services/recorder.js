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
      console.log('Starting recording with settings:', {
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw'
      });
      
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
          console.log('Audio data chunk received:', {
            chunkSize: data.length,
            totalSize: this.audioData.reduce((sum, chunk) => sum + chunk.length, 0),
            chunks: this.audioData.length
          });
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
      console.log('Stopping recording...');
      if (this.recorder) {
        this.recorder.stop();
        this.recorder = null;
      }
      this.recording = false;

      // Combine all audio data into a single buffer
      const completeAudioData = Buffer.concat(this.audioData);
      console.log('Complete audio data:', {
        totalSize: completeAudioData.length,
        chunks: this.audioData.length
      });
      
      // Get transcription
      try {
        console.log('Sending audio for transcription...');
        const transcription = await transcriptionService.transcribeAudio(completeAudioData);
        this.emit('transcription', transcription);
        console.log('Transcription received:', transcription);
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