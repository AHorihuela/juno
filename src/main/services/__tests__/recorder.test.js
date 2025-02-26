// Add OpenAI shim for Node environment
require('openai/shims/node');

// Mock dependencies
jest.mock('electron', () => ({
  systemPreferences: {
    getMediaAccessStatus: jest.fn(),
    askForMediaAccess: jest.fn()
  },
  app: {
    isReady: jest.fn().mockReturnValue(true),
    on: jest.fn(),
    getPath: jest.fn().mockReturnValue('/mock/user/data/path')
  }
}));

jest.mock('../transcriptionService', () => ({
  transcribeAudio: jest.fn()
}));

jest.mock('../notificationService', () => ({
  showMicrophoneError: jest.fn(),
  showNotification: jest.fn(),
  showNoAudioDetected: jest.fn(),
  showTranscriptionError: jest.fn()
}));

jest.mock('../contextService', () => ({
  startRecording: jest.fn(),
  stopRecording: jest.fn()
}));

jest.mock('node-record-lpcm16');

// Import dependencies after mocks
const { systemPreferences } = require('electron');
const recorderFactory = require('../recorder');
const transcriptionService = require('../transcriptionService');
const notificationService = require('../notificationService');
const contextService = require('../contextService');
const { EventEmitter } = require('events');
const record = require('node-record-lpcm16');
const AudioLevelAnalyzer = require('../recorder/AudioLevelAnalyzer');

describe('AudioRecorder', () => {
  let mockRecorder;
  let mockStream;
  let recorder;
  let audioAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a new AudioLevelAnalyzer instance for direct testing
    audioAnalyzer = new AudioLevelAnalyzer({
      overlay: {
        updateOverlayAudioLevels: jest.fn()
      }
    });
    
    // Reset recorder state
    recorder = recorderFactory();
    recorder.recording = false;
    recorder.recorder = null;
    recorder.audioData = [];
    recorder.hasAudioContent = false;
    recorder.currentDeviceId = null;

    // Setup mock stream
    mockStream = new EventEmitter();
    mockStream.stop = jest.fn();

    // Setup mock recorder
    mockRecorder = {
      stream: jest.fn().mockReturnValue(mockStream),
      stop: jest.fn(),
    };

    record.record.mockReturnValue(mockRecorder);
  });

  describe('Microphone Permission Handling', () => {
    it('checks microphone permission on start', async () => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
      
      await recorder.start();
      
      expect(systemPreferences.getMediaAccessStatus).toHaveBeenCalledWith('microphone');
    });

    it('requests permission if status is not-determined', async () => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('not-determined');
      systemPreferences.askForMediaAccess.mockResolvedValue(true);
      
      await recorder.start();
      
      expect(systemPreferences.askForMediaAccess).toHaveBeenCalledWith('microphone');
    });

    it('shows error notification if permission denied', async () => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('denied');
      
      await recorder.start();
      
      expect(notificationService.showMicrophoneError).toHaveBeenCalled();
      expect(recorder.recording).toBe(false);
    });

    it('shows error notification if permission request rejected', async () => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('not-determined');
      systemPreferences.askForMediaAccess.mockResolvedValue(false);
      
      await recorder.start();
      
      expect(notificationService.showMicrophoneError).toHaveBeenCalled();
      expect(recorder.recording).toBe(false);
    });

    it('proceeds with recording if permission granted', async () => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
      
      await recorder.start();
      
      expect(recorder.recording).toBe(true);
      expect(notificationService.showMicrophoneError).not.toHaveBeenCalled();
    });

    it('handles permission check errors gracefully', async () => {
      systemPreferences.getMediaAccessStatus.mockImplementation(() => {
        throw new Error('Permission check failed');
      });
      
      await recorder.start();
      
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        'Recording Error',
        'Permission check failed',
        'error'
      );
      expect(recorder.recording).toBe(false);
    });
  });

  describe('Recording State Management', () => {
    beforeEach(() => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
    });

    it('prevents multiple simultaneous recordings', async () => {
      await recorder.start();
      await recorder.start();
      
      // Should only set up recording once
      expect(recorder.recorder.stream).toHaveBeenCalledTimes(1);
    });

    it('cleans up resources on stop', async () => {
      await recorder.start();
      await recorder.stop();
      
      expect(recorder.recording).toBe(false);
      expect(recorder.recorder).toBeNull();
    });

    it('handles recording errors with notifications', async () => {
      const mockStream = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            callback(new Error('Recording failed'));
          }
          return mockStream;
        })
      };
      
      require('node-record-lpcm16').record.mockReturnValue({
        stream: jest.fn().mockReturnValue(mockStream),
        stop: jest.fn()
      });
      
      await recorder.start();
      
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        'Recording Error',
        'Recording failed',
        'error'
      );
    });
  });

  it('starts recording when not already recording', () => {
    recorder.start();
    expect(recorder.recording).toBe(true);
    expect(recorder.emit).toHaveBeenCalledWith('start');
  });

  it('does not start recording when already recording', () => {
    recorder.recording = true;
    recorder.start();
    expect(recorder.emit).not.toHaveBeenCalled();
  });

  it('stops recording and processes audio when audio content exists', async () => {
    recorder.recording = true;
    recorder.hasAudioContent = true;
    recorder.audioData = [Buffer.from('test audio data')];

    await recorder.stop();

    expect(recorder.recording).toBe(false);
    expect(transcriptionService.transcribeAudio).toHaveBeenCalled();
    expect(recorder.emit).toHaveBeenCalledWith('stop');
  });

  it('stops recording without processing when no audio content exists', async () => {
    recorder.recording = true;
    recorder.hasAudioContent = false;

    await recorder.stop();

    expect(recorder.recording).toBe(false);
    expect(transcriptionService.transcribeAudio).not.toHaveBeenCalled();
    expect(notificationService.showNoAudioDetected).toHaveBeenCalled();
    expect(recorder.emit).toHaveBeenCalledWith('stop');
  });

  it('handles recording errors', async () => {
    const error = new Error('Recording error');
    recorder.recording = true;
    transcriptionService.transcribeAudio.mockRejectedValue(error);
    recorder.hasAudioContent = true;
    recorder.audioData = [Buffer.from('test audio data')];

    await recorder.stop();

    expect(notificationService.showTranscriptionError).toHaveBeenCalledWith(error);
    expect(recorder.emit).toHaveBeenCalledWith('error', error);
  });

  it('correctly identifies audio content', () => {
    const samples = new Int16Array(1000);
    // Set some samples above threshold
    samples[100] = 5000; // Above default threshold
    const buffer = Buffer.from(samples.buffer);
    
    recorder.processAudioData(buffer);
    expect(recorder.hasAudioContent).toBe(true);
  });

  it('identifies silence', () => {
    const samples = new Int16Array(1000);
    // All samples at 0 (silence)
    const buffer = Buffer.from(samples.buffer);
    
    recorder.processAudioData(buffer);
    expect(recorder.hasAudioContent).toBe(false);
  });

  describe('Context Service Integration', () => {
    beforeEach(() => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
    });

    it('starts context tracking when recording starts', async () => {
      await recorder.start();
      
      expect(contextService.startRecording).toHaveBeenCalled();
    });

    it('stops context tracking when recording stops', async () => {
      recorder.recording = true;
      await recorder.stop();
      
      expect(contextService.stopRecording).toHaveBeenCalled();
    });

    it('handles context service errors gracefully', async () => {
      contextService.startRecording.mockImplementation(() => {
        throw new Error('Context service error');
      });
      
      await recorder.start();
      
      expect(notificationService.showNotification).toHaveBeenCalledWith(
        'Recording Error',
        'Context service error',
        'error'
      );
      expect(recorder.recording).toBe(false);
    });

    it('ensures context tracking stops even if transcription fails', async () => {
      recorder.recording = true;
      recorder.hasAudioContent = true;
      recorder.audioData = [Buffer.from('test audio data')];
      transcriptionService.transcribeAudio.mockRejectedValue(new Error('Transcription failed'));

      await recorder.stop();
      
      expect(contextService.stopRecording).toHaveBeenCalled();
    });
  });

  describe('checkMicrophonePermission', () => {
    it('handles already granted permission', async () => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
      
      const result = await recorder.checkMicrophonePermission();
      
      expect(result).toBe(true);
      expect(systemPreferences.askForMediaAccess).not.toHaveBeenCalled();
    });

    it('requests permission when not determined', async () => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('not-determined');
      systemPreferences.askForMediaAccess.mockResolvedValue(true);
      
      const result = await recorder.checkMicrophonePermission();
      
      expect(result).toBe(true);
      expect(systemPreferences.askForMediaAccess).toHaveBeenCalledWith('microphone');
    });

    it('throws error when permission denied', async () => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('denied');
      
      await expect(recorder.checkMicrophonePermission()).rejects.toThrow('Microphone access denied');
    });
  });

  describe('setDevice', () => {
    beforeEach(() => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
    });

    it('successfully sets a new device', async () => {
      const result = await recorder.setDevice('test-device');
      
      expect(result).toBe(true);
      expect(recorder.currentDeviceId).toBe('test-device');
      expect(record.record).toHaveBeenCalledWith(expect.objectContaining({
        device: 'test-device'
      }));
    });

    it('uses null device for default selection', async () => {
      const result = await recorder.setDevice('default');
      
      expect(result).toBe(true);
      expect(recorder.currentDeviceId).toBe('default');
      expect(record.record).toHaveBeenCalledWith(expect.objectContaining({
        device: null
      }));
    });

    it('handles device test failure', async () => {
      record.record.mockImplementation(() => {
        throw new Error('Device not available');
      });

      const result = await recorder.setDevice('test-device');
      
      expect(result).toBe(false);
      expect(recorder.currentDeviceId).toBe('default');
    });

    it('maintains recording state when switching devices', async () => {
      // Start recording
      await recorder.start();
      expect(recorder.isRecording()).toBe(true);

      // Switch device
      await recorder.setDevice('new-device');
      
      // Should still be recording
      expect(recorder.isRecording()).toBe(true);
      expect(recorder.currentDeviceId).toBe('new-device');
    });
  });

  describe('start', () => {
    beforeEach(() => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
    });

    it('starts recording with default device', async () => {
      await recorder.start();
      
      expect(recorder.isRecording()).toBe(true);
      expect(record.record).toHaveBeenCalledWith(expect.objectContaining({
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw'
      }));
    });

    it('starts recording with specific device', async () => {
      await recorder.setDevice('test-device');
      await recorder.start();
      
      expect(recorder.isRecording()).toBe(true);
      expect(record.record).toHaveBeenCalledWith(expect.objectContaining({
        device: 'test-device'
      }));
    });

    it('handles recording errors', async () => {
      const errorHandler = jest.fn();
      recorder.on('error', errorHandler);

      record.record.mockImplementation(() => {
        throw new Error('Recording failed');
      });

      await recorder.start();
      
      expect(errorHandler).toHaveBeenCalled();
      expect(recorder.isRecording()).toBe(false);
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      systemPreferences.getMediaAccessStatus.mockReturnValue('granted');
      await recorder.start();
    });

    it('stops recording', async () => {
      await recorder.stop();
      
      expect(recorder.isRecording()).toBe(false);
      expect(mockRecorder.stop).toHaveBeenCalled();
    });

    it('handles no audio content', async () => {
      recorder.hasAudioContent = false;
      const transcriptionHandler = jest.fn();
      recorder.on('transcription', transcriptionHandler);

      await recorder.stop();
      
      expect(transcriptionHandler).not.toHaveBeenCalled();
      expect(notificationService.showNoAudioDetected).toHaveBeenCalled();
    });

    it('processes audio content when present', async () => {
      recorder.hasAudioContent = true;
      recorder.audioData = [Buffer.from('test audio data')];
      transcriptionService.transcribeAudio.mockResolvedValue('test transcription');
      const transcriptionHandler = jest.fn();
      recorder.on('transcription', transcriptionHandler);

      await recorder.stop();
      
      expect(transcriptionService.transcribeAudio).toHaveBeenCalled();
      expect(transcriptionHandler).toHaveBeenCalledWith('test transcription');
    });

    it('handles transcription errors', async () => {
      recorder.hasAudioContent = true;
      recorder.audioData = [Buffer.from('test audio data')];
      const error = new Error('Transcription failed');
      transcriptionService.transcribeAudio.mockRejectedValue(error);

      await recorder.stop();
      
      expect(notificationService.showTranscriptionError).toHaveBeenCalledWith(error);
    });
  });

  describe('audio level detection', () => {
    it('detects silence', () => {
      const silentBuffer = Buffer.alloc(8192);
      // Test directly with the AudioLevelAnalyzer
      const result = audioAnalyzer.processBuffer(silentBuffer);
      expect(result).toBe(false);
      expect(audioAnalyzer.hasDetectedAudioContent()).toBe(false);
    });

    it('detects sound', () => {
      const buffer = Buffer.alloc(8192);
      for (let i = 0; i < buffer.length; i += 2) {
        buffer.writeInt16LE(5000, i); // Write higher values to exceed the new thresholds
      }
      // Test directly with the AudioLevelAnalyzer
      const result = audioAnalyzer.processBuffer(buffer);
      expect(result).toBe(true);
      expect(audioAnalyzer.hasDetectedAudioContent()).toBe(true);
    });
  });
}); 