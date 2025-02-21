const { EventEmitter } = require('events');
const record = require('node-record-lpcm16');
const transcriptionService = require('./transcriptionService');
const notificationService = require('./notificationService');
const contextService = require('./contextService');
const { systemPreferences } = require('electron');

class AudioRecorder extends EventEmitter {
  constructor() {
    super();
    this.recording = false;
    this.recorder = null;
    this.audioData = [];
    this.hasAudioContent = false;
    this.silenceThreshold = 100; // Adjust this value based on testing
  }

  async checkMicrophonePermission() {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      
      if (status === 'not-determined') {
        const granted = await systemPreferences.askForMediaAccess('microphone');
        return granted;
      }
      
      return status === 'granted';
    }
    
    // For non-macOS platforms, we'll assume permission is granted
    // and handle any errors during recording
    return true;
  }

  async start() {
    if (this.recording) return;
    
    try {
      // Check microphone permission
      const hasPermission = await this.checkMicrophonePermission();
      if (!hasPermission) {
        notificationService.showMicrophoneError();
        this.emit('error', new Error('Microphone access denied'));
        return;
      }

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

      // Reset audio data buffer and flags
      this.audioData = [];
      this.hasAudioContent = false;

      // Start tracking recording session in context service
      contextService.startRecording();

      // Log audio data for testing
      this.recorder.stream()
        .on('data', (data) => {
          // Check audio levels
          const hasSound = this.checkAudioLevels(data);
          if (hasSound) {
            this.hasAudioContent = true;
          }

          this.audioData.push(data);
          this.emit('data', data);
          console.log('Audio data chunk received:', {
            chunkSize: data.length,
            totalSize: this.audioData.reduce((sum, chunk) => sum + chunk.length, 0),
            chunks: this.audioData.length,
            hasSound
          });
        })
        .on('error', (err) => {
          console.error('Recording error:', err);
          notificationService.showNotification(
            'Recording Error',
            err.message || 'Failed to record audio',
            'error'
          );
          this.emit('error', err);
          this.stop();
        });

      this.recording = true;
      this.emit('start');
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      notificationService.showNotification(
        'Recording Error',
        error.message || 'Failed to start recording',
        'error'
      );
      this.emit('error', error);
    }
  }

  checkAudioLevels(buffer) {
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
    
    // Calculate percentage of samples above threshold
    const percentageAboveThreshold = (samplesAboveThreshold / samples.length) * 100;
    
    // Log detailed audio metrics
    console.log('Enhanced Audio metrics:', {
      rms: Math.round(rms),
      peakToPeak: max - min,
      max: max,
      min: min,
      samplesAboveThreshold,
      totalSamples: samples.length,
      threshold: this.silenceThreshold,
      percentageAboveThreshold: Math.round(percentageAboveThreshold),
      maxConsecutiveSamplesAboveThreshold,
      isLikelySpeech: percentageAboveThreshold > 30 && maxConsecutiveSamplesAboveThreshold > 100
    });
    
    // Consider it real audio only if we have a significant percentage of samples above threshold
    // AND we have some consecutive samples above threshold (indicating sustained sound)
    return percentageAboveThreshold > 30 && maxConsecutiveSamplesAboveThreshold > 100;
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

      // Stop tracking recording session in context service
      contextService.stopRecording();

      // Calculate final audio metrics
      const totalSamples = this.audioData.reduce((sum, chunk) => sum + chunk.length, 0);
      const samplesAboveThreshold = this.audioData.reduce((sum, chunk) => {
        const samples = new Int16Array(chunk.buffer);
        return sum + samples.filter(s => Math.abs(s) > this.silenceThreshold).length;
      }, 0);
      
      const percentageAboveThreshold = (samplesAboveThreshold / totalSamples) * 100;
      
      console.log('Final audio analysis:', {
        totalDuration: (totalSamples / 16000).toFixed(2) + 's',
        percentageAboveThreshold: Math.round(percentageAboveThreshold) + '%',
        totalChunks: this.audioData.length,
        hasAudioContent: this.hasAudioContent,
        averageRMS: Math.round(
          this.audioData.reduce((sum, chunk) => {
            const samples = new Int16Array(chunk.buffer);
            const rms = Math.sqrt(samples.reduce((s, sample) => s + sample * sample, 0) / samples.length);
            return sum + rms;
          }, 0) / this.audioData.length
        )
      });

      // Skip transcription if no real audio content detected
      if (!this.hasAudioContent) {
        console.log('No significant audio content detected, skipping transcription');
        notificationService.showNoAudioDetected();
        this.emit('stop');
        return;
      }

      // Combine all audio data into a single buffer
      const completeAudioData = Buffer.concat(this.audioData);
      console.log('Complete audio data:', {
        totalSize: completeAudioData.length,
        chunks: this.audioData.length,
        hadAudioContent: this.hasAudioContent
      });
      
      // Get transcription
      try {
        console.log('Sending audio for transcription...');
        const transcription = await transcriptionService.transcribeAudio(completeAudioData);
        this.emit('transcription', transcription);
        console.log('Transcription received:', transcription);
      } catch (error) {
        console.error('Transcription error:', error);
        notificationService.showTranscriptionError(error);
        this.emit('error', error);
      }

      this.emit('stop');
      console.log('Recording stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      notificationService.showNotification(
        'Recording Error',
        error.message || 'Failed to stop recording',
        'error'
      );
      this.emit('error', error);
    }
  }

  isRecording() {
    return this.recording;
  }
}

module.exports = new AudioRecorder(); 