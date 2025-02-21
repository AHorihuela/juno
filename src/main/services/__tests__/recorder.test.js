// Add OpenAI shim for Node environment
require('openai/shims/node');

const { systemPreferences } = require('electron');
const AudioRecorder = require('../recorder');
const transcriptionService = require('../transcriptionService');
const notificationService = require('../notificationService');

// Mock dependencies
jest.mock('electron', () => ({
  systemPreferences: {
    getMediaAccessStatus: jest.fn(),
    askForMediaAccess: jest.fn()
  }
}));

jest.mock('../notificationService');
jest.mock('node-record-lpcm16', () => ({
  record: jest.fn().mockReturnValue({
    stream: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis()
    }),
    stop: jest.fn()
  })
}));

describe('AudioRecorder', () => {
  let recorder;

  beforeEach(() => {
    jest.clearAllMocks();
    recorder = new AudioRecorder();
    // Reset recorder state
    recorder.recording = false;
    recorder.recorder = null;
    recorder.audioData = [];
    recorder.hasAudioContent = false;
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
}); 