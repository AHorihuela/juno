const selectionService = require('./selectionService');
const contextService = require('./contextService');
const audioFeedback = require('./audioFeedback');
const windowService = require('./windowService');

class RecordingService {
  constructor() {
    this.isRecording = false;
    this.audioRecorder = null;
    this.audioData = [];
    this.hasAudioContent = false;
  }

  /**
   * Start recording audio
   */
  async startRecording() {
    if (this.isRecording) {
      console.log('Already recording');
      return;
    }

    try {
      // Get highlighted text before showing any UI
      const highlightedText = await selectionService.getSelectedText();
      
      console.log('Using system default device for recording');
      const settings = {
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw'
      };
      console.log('Starting recording with settings:', settings);

      // Start recording and context tracking
      this.audioRecorder.start(settings);
      this.isRecording = true;
      this.audioData = [];
      this.hasAudioContent = false;
      
      // Initialize context with highlighted text
      await contextService.startRecording(highlightedText);

      // Show minimal recording indicator without stealing focus
      windowService.showRecordingIndicator();

      // Play start sound
      audioFeedback.playStartSound();

      console.log('Recording started');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    if (!this.isRecording) {
      console.log('Not recording');
      return;
    }

    try {
      console.log('Stopping recording...');
      
      // Stop recording first
      this.audioRecorder.stop();
      this.isRecording = false;
      
      // Stop context tracking
      contextService.stopRecording();
      
      // Play stop sound
      audioFeedback.playStopSound();
      
      // Hide the recording indicator
      windowService.hideWindow();

      // Analyze final audio
      const totalDuration = (this.audioData.length * 8192) / 16000;
      const chunksWithSound = this.audioData.filter(chunk => chunk.hasSound).length;
      const percentageAboveThreshold = Math.round((chunksWithSound / this.audioData.length) * 100);
      
      const analysis = {
        totalDuration: `${totalDuration.toFixed(2)}s`,
        percentageAboveThreshold: `${percentageAboveThreshold}%`,
        totalChunks: this.audioData.length,
        hasAudioContent: this.hasAudioContent,
        averageRMS: Math.round(this.audioData.reduce((sum, chunk) => sum + (chunk.rms || 0), 0) / this.audioData.length)
      };
      
      console.log('Final audio analysis:', analysis);
      
      const audioResult = {
        totalSize: this.audioData.reduce((sum, chunk) => sum + chunk.length, 0),
        chunks: this.audioData.length,
        hadAudioContent: this.hasAudioContent
      };
      
      console.log('Complete audio data:', audioResult);
      
      // Clear audio data
      this.audioData = [];
      this.hasAudioContent = false;
      
      return audioResult;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  // ... rest of the class implementation ...
} 