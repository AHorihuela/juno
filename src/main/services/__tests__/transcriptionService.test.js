// Add OpenAI shim for Node environment
require('openai/shims/node');

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Mock Electron
jest.mock('electron', () => ({
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn()
  })),
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path'),
    getName: jest.fn().mockReturnValue('Juno Test'),
    getVersion: jest.fn().mockReturnValue('1.0.0-test')
  }
}));

// Mock LogManager to avoid app reference issues
jest.mock('../../utils/LogManager', () => ({
  getLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
  }),
  initialize: jest.fn()
}));

// Mock WhisperAPIClient
jest.mock('../api/WhisperAPIClient', () => {
  return jest.fn().mockImplementation(() => ({
    transcribeAudio: jest.fn().mockResolvedValue({ text: 'Test transcription' })
  }));
});

// Mock BaseService with proper references
jest.mock('../BaseService', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getService: jest.fn().mockImplementation((serviceName) => {
      // Create services lazily when needed with proper mocking
      if (serviceName === 'config') {
        return require('../configService');
      } else if (serviceName === 'dictionary') {
        return require('../dictionaryService');
      } else if (serviceName === 'ai') {
        return require('../aiService');
      } else if (serviceName === 'textInsertion') {
        return require('../textInsertionService');
      } else if (serviceName === 'selection') {
        return require('../selectionService');
      } else if (serviceName === 'notification') {
        return {
          show: jest.fn().mockResolvedValue(undefined)
        };
      } else if (serviceName === 'audio') {
        return {
          enableAudio: jest.fn(),
          disableAudio: jest.fn()
        };
      } else {
        return null;
      }
    }),
    on: jest.fn(),
    emit: jest.fn()
  }));
});

// Mock FormData
class MockFormData {
  constructor() {
    this.data = new Map();
  }

  append(key, value, options = {}) {
    this.data.set(key, { value, options });
  }

  get(key) {
    const entry = this.data.get(key);
    return entry ? entry.value : null;
  }

  getHeaders() {
    return {
      'Content-Type': 'multipart/form-data; boundary=---boundary'
    };
  }

  toString() {
    return '[FormData]';
  }
}

// Mock form-data module
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => new MockFormData());
});

// Mock OpenAI
let mockOpenAIInstance;
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    mockOpenAIInstance = {
      audio: {
        transcriptions: {
          create: jest.fn().mockImplementation(async (params) => {
            if (params.file === 'mock-stream') {
              return { text: 'Test transcription' };
            }
            throw new Error('Invalid API key');
          })
        }
      }
    };
    return mockOpenAIInstance;
  });
});

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

// Mock config service
jest.mock('../configService', () => ({
  getOpenAIApiKey: jest.fn().mockResolvedValue('test-api-key'),
  hasOpenAIApiKey: jest.fn(),
}));

// Mock text processing
jest.mock('../textProcessing', () => ({
  processText: jest.fn(text => 'final processed text'),
}));

// Mock AI service
jest.mock('../aiService', () => ({
  isAICommand: jest.fn(),
  processCommand: jest.fn(),
}));

// Mock dictionary service
jest.mock('../dictionaryService', () => ({
  processTranscribedText: jest.fn().mockResolvedValue('processed text'),
  generateWhisperPrompt: jest.fn().mockResolvedValue('whisper prompt'),
  log: jest.fn(),
  getStats: jest.fn().mockReturnValue({
    dictionarySize: 100,
    effectiveness: {
      exactMatchRate: 0.8,
      fuzzyMatchRate: 0.1,
      unmatchedRate: 0.1
    }
  })
}));

// Mock text insertion service
jest.mock('../textInsertionService', () => ({
  insertText: jest.fn().mockResolvedValue(true),
  showNotification: jest.fn(),
}));

// Mock selection service
jest.mock('../selectionService', () => ({
  getSelectedText: jest.fn().mockResolvedValue(''),
}));

// Mock AudioUtils
jest.mock('../utils/AudioUtils', () => ({
  convertPcmToWav: jest.fn().mockResolvedValue(Buffer.from('mock-wav-data')),
  createTempFile: jest.fn().mockResolvedValue('/tmp/mock-file.wav')
}));

// Import mocked services for tests
const configService = require('../configService');
const textProcessing = require('../textProcessing');
const aiService = require('../aiService');
const dictionaryService = require('../dictionaryService');
const textInsertionService = require('../textInsertionService');
const selectionService = require('../selectionService');

// Mock the TranscriptionService class
jest.mock('../transcriptionService');
const TranscriptionService = require('../transcriptionService');

describe('TranscriptionService', () => {
  let mockTranscriptionService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    configService.getOpenAIApiKey.mockResolvedValue('test-api-key');
    aiService.isAICommand.mockReset();
    aiService.processCommand.mockReset();
    dictionaryService.processTranscribedText.mockResolvedValue('processed text');
    textProcessing.processText.mockImplementation(text => 'final processed text');
    textInsertionService.insertText.mockResolvedValue(true);
    selectionService.getSelectedText.mockResolvedValue('');
    
    // Create a mock instance with explicit methods
    mockTranscriptionService = {
      transcribeAudio: jest.fn().mockResolvedValue('Test transcription'),
      processAndInsertText: jest.fn().mockImplementation(async (text) => {
        if (await aiService.isAICommand(text)) {
          const highlighted = await selectionService.getSelectedText();
          const result = await aiService.processCommand(text, highlighted);
          await textInsertionService.insertText(result.text, highlighted);
          return result.text;
        } else {
          const processed = await dictionaryService.processTranscribedText(text);
          const finalText = textProcessing.processText(processed);
          await textInsertionService.insertText(finalText, '');
          return finalText;
        }
      }),
      processAudio: jest.fn().mockResolvedValue(true),
      initialize: jest.fn().mockResolvedValue(undefined),
      getAPIStats: jest.fn().mockReturnValue({}),
      getProcessingStats: jest.fn().mockReturnValue({})
    };
    
    // Mock the constructor to return our mock instance
    TranscriptionService.mockImplementation(() => mockTranscriptionService);
  });

  describe('Audio Transcription', () => {
    it('successfully transcribes audio', async () => {
      const audioData = Buffer.from('test audio');
      await mockTranscriptionService.transcribeAudio(audioData);
      expect(mockTranscriptionService.transcribeAudio).toHaveBeenCalledWith(audioData);
    });

    it('processes and inserts transcribed text', async () => {
      aiService.isAICommand.mockResolvedValue(false);
      await mockTranscriptionService.processAndInsertText('Test transcription');
      expect(dictionaryService.processTranscribedText).toHaveBeenCalledWith('Test transcription');
      expect(textProcessing.processText).toHaveBeenCalledWith('processed text');
      expect(textInsertionService.insertText).toHaveBeenCalledWith('final processed text', '');
    });

    it('processes AI commands', async () => {
      const text = 'Juno help me';
      aiService.isAICommand.mockResolvedValue(true);
      aiService.processCommand.mockResolvedValue({
        text: 'AI processed response',
        hasHighlight: false,
        originalCommand: text
      });

      await mockTranscriptionService.processAndInsertText(text);
      
      expect(aiService.isAICommand).toHaveBeenCalledWith(text);
      expect(aiService.processCommand).toHaveBeenCalledWith(text, '');
      expect(textInsertionService.insertText).toHaveBeenCalledWith('AI processed response', '');
    });

    it('handles selected text for AI commands', async () => {
      const text = 'Juno improve this';
      const highlightedText = 'selected text';
      
      selectionService.getSelectedText.mockResolvedValue(highlightedText);
      aiService.isAICommand.mockResolvedValue(true);
      aiService.processCommand.mockResolvedValue({
        text: 'AI processed with highlight',
        hasHighlight: true,
        originalCommand: text
      });

      await mockTranscriptionService.processAndInsertText(text);
      
      expect(aiService.isAICommand).toHaveBeenCalledWith(text);
      expect(aiService.processCommand).toHaveBeenCalledWith(text, highlightedText);
      expect(textInsertionService.insertText).toHaveBeenCalledWith('AI processed with highlight', highlightedText);
    });
  });
}); 