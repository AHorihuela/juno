const transcriptionService = require('../transcriptionService');

describe('TranscriptionService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns stub transcription text', async () => {
    const audioData = Buffer.from('test audio data');
    const transcriptionPromise = transcriptionService.transcribeAudio(audioData);
    
    // Fast-forward through the simulated processing time
    jest.advanceTimersByTime(500);
    
    const result = await transcriptionPromise;
    expect(result).toBe('This is a stub transcription.');
  });
}); 