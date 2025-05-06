require('openai/shims/node');

// Mock dependencies but don't mock util since other modules depend on it
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ size: 1024 }),
  },
  writeFile: jest.fn().mockImplementation((path, data, callback) => {
    callback(null);
  }),
  unlink: jest.fn().mockImplementation((path, callback) => {
    callback(null);
  }),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  createReadStream: jest.fn().mockReturnValue('mock-stream'),
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
  }),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
  stat: jest.fn().mockImplementation((path, callback) => {
    callback(null, { size: 1024 });
  }),
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn(),
}));

jest.mock('electron', () => ({
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn()
  })),
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path'),
    getName: jest.fn().mockReturnValue('Juno AI Dictation'),
    getVersion: jest.fn().mockReturnValue('1.0.0')
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

// Mock WhisperAPIClient
jest.mock('../api/WhisperAPIClient', () => {
  return jest.fn().mockImplementation(() => ({
    transcribeAudio: jest.fn().mockResolvedValue({ text: 'Test transcription' }),
    getCacheStats: jest.fn().mockReturnValue({ 
      size: 0, 
      maxSize: 10, 
      hitRate: 0 
    })
  }));
});

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
  showNotification: jest.fn(),
  on: jest.fn()
}));

jest.mock('../selectionService', () => ({
  getSelectedText: jest.fn().mockResolvedValue(''),
  appNameProvider: {
    getActiveAppName: jest.fn().mockResolvedValue('TestApp')
  }
}));

jest.mock('../selection/AppNameProvider', () => {
  return jest.fn().mockImplementation(() => ({
    getActiveAppName: jest.fn().mockResolvedValue('TestApp')
  }));
});

// Import the TranscriptionService factory
const transcriptionServiceFactory = require('../transcriptionService');

describe('TranscriptionService Core Functionality Tests', () => {
  let transcriptionService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  it('should create a valid transcription service with required methods', () => {
    // Instantiate the service
    transcriptionService = transcriptionServiceFactory();
    
    // Verify the API shape - key methods
    expect(transcriptionService).toBeDefined();
    expect(typeof transcriptionService.processAudio).toBe('function');
    expect(typeof transcriptionService.processAndInsertText).toBe('function');
    expect(typeof transcriptionService._initialize).toBe('function');
  });

  it('should have a factory function that returns a new instance', () => {
    // Get two instances
    const instance1 = transcriptionServiceFactory();
    const instance2 = transcriptionServiceFactory();
    
    // Verify they are different objects
    expect(instance1).not.toBe(instance2);
  });
}); 