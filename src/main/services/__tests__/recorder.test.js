jest.mock('node-record-lpcm16', () => ({
  record: jest.fn().mockReturnValue({
    stream: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
    }),
    stop: jest.fn(),
  }),
}));

jest.mock('../transcriptionService', () => ({
  transcribeAudio: jest.fn().mockResolvedValue('This is a stub transcription.'),
}));

const recorder = require('../recorder');
const record = require('node-record-lpcm16');
const transcriptionService = require('../transcriptionService');

describe('AudioRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset recorder state
    recorder.recording = false;
    recorder.recorder = null;
    recorder.audioData = [];
  });

  it('starts recording when start() is called', () => {
    const startListener = jest.fn();
    recorder.on('start', startListener);

    recorder.start();

    expect(record.record).toHaveBeenCalledWith({
      sampleRate: 16000,
      channels: 1,
      audioType: 'raw',
    });
    expect(recorder.isRecording()).toBe(true);
    expect(startListener).toHaveBeenCalled();
  });

  it('stops recording and gets transcription when stop() is called', async () => {
    const stopListener = jest.fn();
    const transcriptionListener = jest.fn();
    recorder.on('stop', stopListener);
    recorder.on('transcription', transcriptionListener);

    // Start recording first
    recorder.start();
    expect(recorder.isRecording()).toBe(true);

    // Simulate some audio data
    const testData = Buffer.from('test audio data');
    recorder.audioData.push(testData);

    // Then stop
    await recorder.stop();

    expect(recorder.isRecording()).toBe(false);
    expect(stopListener).toHaveBeenCalled();
    expect(transcriptionService.transcribeAudio).toHaveBeenCalledWith(expect.any(Buffer));
    expect(transcriptionListener).toHaveBeenCalledWith('This is a stub transcription.');
  });

  it('emits error events when recording fails', () => {
    const errorListener = jest.fn();
    recorder.on('error', errorListener);

    // Mock record to throw an error
    record.record.mockImplementationOnce(() => {
      throw new Error('Recording failed');
    });

    recorder.start();

    expect(errorListener).toHaveBeenCalledWith(expect.any(Error));
    expect(recorder.isRecording()).toBe(false);
  });

  it('handles data events from the recorder', (done) => {
    const testData = Buffer.from('test audio data');
    const dataListener = jest.fn();

    // Mock the stream to emit data
    record.record.mockReturnValueOnce({
      stream: () => ({
        on: (event, callback) => {
          if (event === 'data') {
            process.nextTick(() => callback(testData));
          }
          return { on: jest.fn() };
        }
      }),
      stop: jest.fn(),
    });

    recorder.on('data', dataListener);
    recorder.start();

    process.nextTick(() => {
      expect(dataListener).toHaveBeenCalledWith(testData);
      expect(recorder.audioData).toContainEqual(testData);
      done();
    });
  });

  it('handles transcription errors gracefully', async () => {
    const errorListener = jest.fn();
    recorder.on('error', errorListener);

    // Mock transcription to fail
    transcriptionService.transcribeAudio.mockRejectedValueOnce(new Error('Transcription failed'));

    // Start and stop recording
    recorder.start();
    await recorder.stop();

    expect(errorListener).toHaveBeenCalledWith(expect.any(Error));
  });
}); 