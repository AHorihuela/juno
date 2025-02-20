jest.mock('node-record-lpcm16', () => ({
  record: jest.fn().mockReturnValue({
    stream: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
    }),
    stop: jest.fn(),
  }),
}));

const recorder = require('../recorder');
const record = require('node-record-lpcm16');

describe('AudioRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset recorder state
    recorder.recording = false;
    recorder.recorder = null;
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

  it('stops recording when stop() is called', () => {
    const stopListener = jest.fn();
    recorder.on('stop', stopListener);

    // Start recording first
    recorder.start();
    expect(recorder.isRecording()).toBe(true);

    // Then stop
    recorder.stop();

    expect(recorder.isRecording()).toBe(false);
    expect(stopListener).toHaveBeenCalled();
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
      done();
    });
  });
}); 