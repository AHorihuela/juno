// Add OpenAI shim for Node environment
require('openai/shims/node');
const { Response, Headers } = require('node-fetch');

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const wav = require('wav');
const configService = require('../configService');
const textProcessing = require('../textProcessing');
const aiService = require('../aiService');
const transcriptionService = require('../transcriptionService');
const dictionaryService = require('../dictionaryService');
const textInsertionService = require('../textInsertionService');

// Mock fetch
global.fetch = jest.fn();

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

// Mock textProcessing
jest.mock('../textProcessing', () => ({
  processText: jest.fn(text => text),
}));

// Mock aiService
jest.mock('../aiService', () => ({
  isAICommand: jest.fn(),
  processCommand: jest.fn(),
}));

// Mock wav module
jest.mock('wav', () => {
  const EventEmitter = require('events');
  
  class MockWriter extends EventEmitter {
    constructor() {
      super();
      this.ended = false;
    }
    
    write(data) {
      if (!this.ended) {
        return true;
      }
    }
    
    end() {
      this.ended = true;
      process.nextTick(() => {
        this.emit('finish');
      });
    }
  }

  return {
    FileWriter: jest.fn().mockImplementation(() => new MockWriter()),
  };
});

// Mock fs operations
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
  createReadStream: jest.fn().mockReturnValue('mock-stream'),
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
  }),
  statSync: jest.fn().mockReturnValue({ size: 1024 }), // Mock a non-empty file
}));

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/path'),
  },
}));

describe('TranscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup successful API key
    configService.getOpenAIApiKey.mockResolvedValue('test-api-key');
    configService.hasOpenAIApiKey.mockResolvedValue(true);
    
    // Reset transcriptionService state
    transcriptionService.openai = null;

    // Reset AI service mocks
    aiService.isAICommand.mockReset();
    aiService.processCommand.mockReset();
    aiService.isAICommand.mockResolvedValue(false);
    aiService.processCommand.mockResolvedValue({
      text: 'AI response',
      hasHighlight: false,
      originalCommand: null,
    });

    // Reset fetch mock
    global.fetch.mockReset();
  });

  it('initializes OpenAI client with API key', async () => {
    await transcriptionService.initializeOpenAI();
    expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
  });

  it('throws error if API key is not configured', async () => {
    configService.getOpenAIApiKey.mockResolvedValue(null);
    configService.hasOpenAIApiKey.mockResolvedValue(false);
    await expect(transcriptionService.initializeOpenAI())
      .rejects
      .toThrow('OpenAI API key not configured');
  });

  it('successfully transcribes audio', async () => {
    const mockHeaders = new Headers({
      'content-type': 'application/json',
      'content-length': '100'
    });

    console.log('Setting up mock response for successful transcription');
    const mockSuccessResponse = new Response(
      JSON.stringify({ text: 'Test transcription' }),
      {
        ok: true,
        status: 200,
        headers: mockHeaders
      }
    );

    console.log('Mock response setup:', {
      ok: mockSuccessResponse.ok,
      status: mockSuccessResponse.status,
      headers: Object.fromEntries(mockSuccessResponse.headers.entries())
    });

    global.fetch = jest.fn().mockResolvedValue(mockSuccessResponse);
    const audioData = Buffer.from('test audio data');
    
    console.log('Calling transcribeAudio');
    const result = await transcriptionService.transcribeAudio(audioData);
    console.log('Transcription result:', result);
    
    expect(result).toBe('Test transcription');
  }, 10000);

  it('handles invalid API key error', async () => {
    const mockHeaders = new Headers({
      'content-type': 'application/json',
      'content-length': '100'
    });

    console.log('Setting up mock response for invalid API key');
    const errorResponse = {
      error: {
        message: 'Incorrect API key provided: test-api-key',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    };

    const mockInvalidKeyResponse = new Response(
      JSON.stringify(errorResponse),
      {
        ok: false,
        status: 401,
        headers: mockHeaders
      }
    );

    console.log('Mock error response setup:', {
      ok: mockInvalidKeyResponse.ok,
      status: mockInvalidKeyResponse.status,
      headers: Object.fromEntries(mockInvalidKeyResponse.headers.entries())
    });

    global.fetch = jest.fn().mockResolvedValue(mockInvalidKeyResponse);
    const audioData = Buffer.from('test audio data');
    
    console.log('Calling transcribeAudio with invalid key');
    await expect(transcriptionService.transcribeAudio(audioData))
      .rejects
      .toThrow('Invalid OpenAI API key');
  }, 10000);

  it('handles rate limit error', async () => {
    const mockHeaders = new Headers({
      'content-type': 'application/json',
      'content-length': '100'
    });

    const errorResponse = {
      error: {
        message: 'Rate limit exceeded',
        type: 'rate_limit_error'
      }
    };

    const mockRateLimitResponse = new Response(
      JSON.stringify(errorResponse),
      {
        ok: false,
        status: 429,
        headers: mockHeaders
      }
    );

    global.fetch = jest.fn().mockResolvedValue(mockRateLimitResponse);
    const audioData = Buffer.from('test audio data');
    await expect(transcriptionService.transcribeAudio(audioData))
      .rejects
      .toThrow('OpenAI API rate limit exceeded');
  }, 10000);

  it('cleans up temp file even if transcription fails', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const audioData = Buffer.from('test audio data');
    try {
      await transcriptionService.transcribeAudio(audioData);
    } catch (e) {
      // Expected to throw
    }

    expect(fs.promises.unlink).toHaveBeenCalled();
  }, 10000);

  describe('AI Integration', () => {
    it('detects and processes AI commands', async () => {
      const mockHeaders = new Headers({
        'content-type': 'application/json',
        'content-length': '100'
      });

      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: mockHeaders,
        json: () => Promise.resolve({ text: 'Hey AI, write a poem about coding' }),
        text: () => Promise.resolve(JSON.stringify({ text: 'Hey AI, write a poem about coding' }))
      };

      global.fetch = jest.fn().mockResolvedValue(mockSuccessResponse);
      const audioData = Buffer.from('test audio data');
      const result = await transcriptionService.transcribeAudio(audioData);
      expect(result).toBe('Hey AI, write a poem about coding');
      expect(aiService.processCommand).toHaveBeenCalledWith('write a poem about coding');
    }, 10000);

    it('processes regular transcription when not an AI command', async () => {
      const mockHeaders = new Headers({
        'content-type': 'application/json',
        'content-length': '100'
      });

      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: mockHeaders,
        json: () => Promise.resolve({ text: 'Just a regular transcription' }),
        text: () => Promise.resolve(JSON.stringify({ text: 'Just a regular transcription' }))
      };

      global.fetch = jest.fn().mockResolvedValue(mockSuccessResponse);
      const audioData = Buffer.from('test audio data');
      const result = await transcriptionService.transcribeAudio(audioData);
      expect(result).toBe('Just a regular transcription');
      expect(aiService.processCommand).not.toHaveBeenCalled();
    }, 10000);
  });

  describe('AI Command Processing', () => {
    test('detects and processes AI commands', async () => {
      // Setup AI command detection
      aiService.isAICommand.mockResolvedValue(true);
      aiService.processCommand.mockResolvedValue({
        text: 'AI processed response',
        hasHighlight: false,
        originalCommand: 'Juno help me'
      });

      const result = await transcriptionService.processAndInsertText('Juno help me');

      // Verify AI command was checked
      expect(aiService.isAICommand).toHaveBeenCalledWith('Juno help me');
      
      // Verify AI command was processed
      expect(aiService.processCommand).toHaveBeenCalledWith('Juno help me', '');
      
      // Verify AI response was inserted
      expect(textInsertionService.insertText).toHaveBeenCalledWith('AI processed response', '');
      
      // Verify the response was returned
      expect(result).toBe('AI processed response');
      
      // Verify dictionary and text processing were NOT called
      expect(dictionaryService.processTranscribedText).not.toHaveBeenCalled();
      expect(textProcessing.processText).not.toHaveBeenCalled();
    });

    test('processes normal text when not an AI command', async () => {
      // Setup non-AI text
      aiService.isAICommand.mockResolvedValue(false);
      dictionaryService.processTranscribedText.mockResolvedValue('dictionary processed');
      textProcessing.processText.mockReturnValue('final processed text');

      const result = await transcriptionService.processAndInsertText('normal text');

      // Verify AI command was checked but not processed
      expect(aiService.isAICommand).toHaveBeenCalledWith('normal text');
      expect(aiService.processCommand).not.toHaveBeenCalled();
      
      // Verify normal text processing occurred
      expect(dictionaryService.processTranscribedText).toHaveBeenCalledWith('normal text');
      expect(textProcessing.processText).toHaveBeenCalledWith('dictionary processed');
      
      // Verify processed text was inserted
      expect(textInsertionService.insertText).toHaveBeenCalledWith('final processed text', '');
      
      // Verify the processed text was returned
      expect(result).toBe('final processed text');
    });

    test('handles highlighted text with AI commands', async () => {
      // Setup AI command with highlight
      aiService.isAICommand.mockResolvedValue(true);
      aiService.processCommand.mockResolvedValue({
        text: 'AI processed with highlight',
        hasHighlight: true,
        originalCommand: 'Juno improve this'
      });

      const highlightedText = 'selected text';
      const result = await transcriptionService.processAndInsertText('Juno improve this', highlightedText);

      // Verify AI command processing included highlight
      expect(aiService.processCommand).toHaveBeenCalledWith('Juno improve this', highlightedText);
      
      // Verify AI response was inserted with highlight
      expect(textInsertionService.insertText).toHaveBeenCalledWith('AI processed with highlight', highlightedText);
      
      // Verify the response was returned
      expect(result).toBe('AI processed with highlight');
    });
  });
}); 