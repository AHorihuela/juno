const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const configService = require('../configService');
const transcriptionService = require('../transcriptionService');

// Mock OpenAI
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: mockCreate,
      },
    },
  }));
  MockOpenAI.mockCreate = mockCreate;
  return MockOpenAI;
});

// Mock configService
jest.mock('../configService', () => ({
  getOpenAIApiKey: jest.fn(),
  hasOpenAIApiKey: jest.fn(),
}));

// Mock fs operations
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
  createReadStream: jest.fn().mockReturnValue('mock-stream'),
}));

describe('TranscriptionService', () => {
  let mockOpenAI;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup successful API key
    configService.getOpenAIApiKey.mockReturnValue('test-api-key');
    
    // Reset transcriptionService state
    transcriptionService.openai = null;
  });

  it('initializes OpenAI client with API key', () => {
    transcriptionService.initializeOpenAI();
    expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
  });

  it('throws error if API key is not configured', () => {
    configService.getOpenAIApiKey.mockReturnValue(null);
    expect(() => transcriptionService.initializeOpenAI())
      .toThrow('OpenAI API key not configured');
  });

  it('successfully transcribes audio', async () => {
    const mockResponse = { text: 'Hello, this is a test transcription.' };
    OpenAI.mockCreate.mockResolvedValue(mockResponse);

    const audioData = Buffer.from('test audio data');
    const result = await transcriptionService.transcribeAudio(audioData);

    expect(result).toBe(mockResponse.text);
    expect(fs.promises.writeFile).toHaveBeenCalled();
    expect(fs.createReadStream).toHaveBeenCalled();
    expect(fs.promises.unlink).toHaveBeenCalled();
  });

  it('handles invalid API key error', async () => {
    const error = new Error('Unauthorized');
    error.response = { status: 401 };
    OpenAI.mockCreate.mockRejectedValue(error);

    const audioData = Buffer.from('test audio data');
    await expect(transcriptionService.transcribeAudio(audioData))
      .rejects
      .toThrow('Invalid OpenAI API key');
  });

  it('handles rate limit error', async () => {
    const error = new Error('Too Many Requests');
    error.response = { status: 429 };
    OpenAI.mockCreate.mockRejectedValue(error);

    const audioData = Buffer.from('test audio data');
    await expect(transcriptionService.transcribeAudio(audioData))
      .rejects
      .toThrow('OpenAI API rate limit exceeded');
  });

  it('handles network errors', async () => {
    const error = new Error('Network Error');
    OpenAI.mockCreate.mockRejectedValue(error);

    const audioData = Buffer.from('test audio data');
    await expect(transcriptionService.transcribeAudio(audioData))
      .rejects
      .toThrow('Transcription failed: Network Error');
  });

  it('cleans up temp file even if transcription fails', async () => {
    const error = new Error('API Error');
    OpenAI.mockCreate.mockRejectedValue(error);

    const audioData = Buffer.from('test audio data');
    try {
      await transcriptionService.transcribeAudio(audioData);
    } catch (e) {
      // Expected to throw
    }

    expect(fs.promises.unlink).toHaveBeenCalled();
  });
}); 