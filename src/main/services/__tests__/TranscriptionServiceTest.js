require('openai/shims/node');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  createReadStream: jest.fn().mockReturnValue('mock-stream'),
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
  }),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn(),
}));

jest.mock('electron', () => ({
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn()
  })),
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  }
}));

// Mock form-data module
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn().mockReturnValue({
      'Content-Type': 'multipart/form-data; boundary=---boundary'
    }),
    toString: jest.fn().mockReturnValue('[FormData]')
  }));
});

// Mock OpenAI
const mockOpenAI = {
  audio: {
    transcriptions: {
      create: jest.fn().mockResolvedValue({ text: 'Test transcription' })
    }
  }
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

// Mock services
jest.mock('../configService', () => ({
  getOpenAIApiKey: jest.fn().mockResolvedValue('test-api-key'),
  hasOpenAIApiKey: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockImplementation(key => {
    if (key === 'openai.apiKey') return 'test-api-key';
    if (key === 'transcription.format') return 'text';
    if (key === 'transcription.language') return 'en';
    if (key === 'transcription.prompt') return '';
    return null;
  })
}));

jest.mock('../textProcessing', () => ({
  processText: jest.fn().mockImplementation(text => text),
}));

jest.mock('../aiService', () => ({
  isAICommand: jest.fn().mockResolvedValue(false),
  processCommand: jest.fn().mockResolvedValue({
    text: 'AI response',
    hasHighlight: false,
    originalCommand: 'test command'
  })
}));

jest.mock('../dictionaryService', () => ({
  processTranscribedText: jest.fn().mockImplementation(text => text),
  generateWhisperPrompt: jest.fn().mockResolvedValue('test prompt')
}));

jest.mock('../textInsertionService', () => ({
  insertText: jest.fn().mockResolvedValue(true),
  showNotification: jest.fn()
}));

jest.mock('../selectionService', () => ({
  getSelectedText: jest.fn().mockResolvedValue(''),
}));

// Add these mocks before requiring transcriptionService
jest.mock('../../utils/LogManager', () => ({
  getLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  })
}));

jest.mock('../../utils/ErrorManager', () => ({
  APIError: class APIError extends Error {
    constructor(code, message, metadata = {}) {
      super(message);
      this.code = code;
      this.metadata = metadata;
    }
  }
}));

// Import the transcription service
const transcriptionService = require('../transcriptionService');

// Import the mocked services for direct access in tests
const aiService = require('../aiService');
const dictionaryService = require('../dictionaryService');
const textInsertionService = require('../textInsertionService');

describe('TranscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Audio Transcription', () => {
    it('should transcribe audio successfully', async () => {
      const audioData = Buffer.from('test audio data');
      const result = await transcriptionService.transcribeAudio(audioData);
      
      expect(result).toBe('Test transcription');
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalled();
    });

    it('should handle transcription errors gracefully', async () => {
      const error = new Error('Transcription failed');
      mockOpenAI.audio.transcriptions.create.mockRejectedValueOnce(error);
      
      const audioData = Buffer.from('test audio data');
      
      try {
        await transcriptionService.transcribeAudio(audioData);
        // Use 'expect.fail()' for tests that should throw errors
        expect(true).toBe(false); // This line should not be reached
      } catch (e) {
        expect(e.message).toContain('Transcription failed');
      }
    });
  });

  describe('Text Processing and Insertion', () => {
    it('should detect and process AI commands', async () => {
      // Setup AI command detection
      aiService.isAICommand.mockResolvedValue(true);
      
      const text = 'Juno help me';
      const result = await transcriptionService.processAndInsertText(text);
      
      expect(result).toBe('AI response');
      expect(aiService.processCommand).toHaveBeenCalledWith(text, expect.any(String));
      expect(textInsertionService.insertText).toHaveBeenCalled();
    });

    it('should process regular text', async () => {
      // Setup to NOT detect AI command
      aiService.isAICommand.mockResolvedValue(false);
      
      const text = 'Normal transcription text';
      const result = await transcriptionService.processAndInsertText(text);
      
      expect(result).toBe(text);
      expect(dictionaryService.processTranscribedText).toHaveBeenCalledWith(text);
      expect(textInsertionService.insertText).toHaveBeenCalled();
    });
  });
}); 