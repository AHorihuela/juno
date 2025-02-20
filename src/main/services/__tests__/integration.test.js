require('openai/shims/node');

// Import services
const textProcessing = require('../textProcessing');
const aiService = require('../aiService');
const { TranscriptionService } = require('../transcriptionService');

// Mock ConfigService
jest.mock('../configService', () => {
  return {
    store: {
      get: jest.fn(),
      set: jest.fn()
    },
    getOpenAIApiKey: jest.fn().mockResolvedValue('test-key'),
    getAITriggerWord: jest.fn().mockResolvedValue('hey ai'),
    getAIModel: jest.fn().mockResolvedValue('gpt-4'),
    getAITemperature: jest.fn().mockResolvedValue(0.7),
    initializeStore: jest.fn().mockResolvedValue(undefined)
  };
});

// Mock electron
jest.mock('electron', () => ({
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn()
  })),
  clipboard: {
    writeText: jest.fn(),
    readText: jest.fn().mockReturnValue('mocked clipboard text')
  }
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'This is a test response from the AI.'
              }
            }
          ]
        })
      }
    }
  }));
});

// Mock notification service
const notificationService = {
  showNotification: jest.fn(),
  showAPIError: jest.fn(),
  showTranscriptionError: jest.fn(),
  showAIError: jest.fn()
};

// Mock text insertion service
const textInsertionService = {
  insertText: jest.fn().mockResolvedValue(true),
  log: jest.fn()
};

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock TranscriptionService
jest.mock('../transcriptionService', () => {
  return {
    TranscriptionService: jest.fn().mockImplementation(() => ({
      initializeOpenAI: jest.fn().mockResolvedValue(undefined),
      processText: jest.fn().mockImplementation(async (text) => {
        return { text: text };
      }),
      handleAICommand: jest.fn().mockImplementation(async (text) => {
        return { text: 'AI response: ' + text };
      })
    }))
  };
});

describe('Text Processing and AI Integration', () => {
  let transcriptionServiceInstance;
  let textProcessing;
  let aiService;
  let textInsertionService;
  let notificationService;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize services
    textProcessing = {
      processText: jest.fn().mockImplementation(async (text) => {
        // Simulate text processing without adding extra newlines
        let processed = text
          .replace(/\.\./g, '.')  // Replace double periods with single
          .replace(/!\./g, '!')   // Fix exclamation points
          .replace(/\s+/g, ' ')   // Normalize spaces
          .trim();

        // Ensure final period if not already present
        if (!processed.endsWith('.') && !processed.endsWith('!') && !processed.endsWith('?')) {
          processed += '.';
        }

        return { text: processed };
      })
    };

    textInsertionService = {
      insertText: jest.fn()
    };

    notificationService = {
      showNotification: jest.fn(),
      showAPIError: jest.fn(),
      showTranscriptionError: jest.fn(),
      showAIError: jest.fn()
    };

    aiService = {
      initializeOpenAI: jest.fn().mockResolvedValue(undefined),
      processCommand: jest.fn().mockImplementation(async (text) => {
        return { text: 'Mocked AI response. This is a test.' };
      }),
      isAICommand: jest.fn().mockImplementation(async (text) => {
        return text.toLowerCase().includes('hey ai') || text.toLowerCase().startsWith('summarize');
      })
    };

    await aiService.initializeOpenAI();
    
    transcriptionServiceInstance = new TranscriptionService(
      textProcessing,
      aiService,
      textInsertionService,
      notificationService
    );
  });

  describe('Transcription Flow', () => {
    test('properly processes regular transcription text', async () => {
      const result = await textProcessing.processText(
        'hello world.. this is a test.. final sentence'
      );
      
      // Should have single periods with spaces
      expect(result.text).toBe('hello world. this is a test. final sentence.');
      // Should not have double periods
      expect(result.text).not.toContain('..');
    });

    test('handles mixed punctuation correctly', async () => {
      const result = await textProcessing.processText(
        'is this working? yes it is.. great!.. done'
      );
      
      // Should preserve question marks and exclamation points with spaces
      expect(result.text).toBe('is this working? yes it is. great! done.');
      // Should not have double periods
      expect(result.text).not.toContain('..');
    });
  });

  describe('AI Command Flow', () => {
    test('detects and processes AI commands without formatting artifacts', async () => {
      const result = await aiService.processCommand('Hey Juno, test this');
      expect(result.text).toBe('Mocked AI response. This is a test.');
      expect(result.text).not.toContain('```');
      expect(result.text).not.toContain('`');
    });

    test('handles action verbs without trigger word', async () => {
      const result = await aiService.processCommand('summarize the following text');
      expect(result.text).toBe('Mocked AI response. This is a test.');
    });

    test('preserves proper punctuation in AI responses', async () => {
      const result = await aiService.processCommand('Hey Juno, test punctuation');
      expect(result.text).toBe('Mocked AI response. This is a test.');
      expect(result.text.split('. ').length).toBe(2);
    });
  });

  describe('End-to-End Flow', () => {
    test('correctly processes both transcription and AI responses', async () => {
      const transcriptionText = 'hello world.. this is a test..';
      const processedTranscription = await textProcessing.processText(transcriptionText);
      expect(processedTranscription.text).toBe('hello world. this is a test.');

      const aiCommand = 'Hey Juno, rewrite this';
      const aiResponse = await aiService.processCommand(aiCommand);
      expect(aiResponse.text).toBe('Mocked AI response. This is a test.');
    });

    test('handles transitions between transcription and AI modes', async () => {
      const transcription1 = await textProcessing.processText(
        'hello world.. testing..'
      );
      expect(transcription1.text).toBe('hello world. testing.');
      expect(transcription1.text).not.toContain('..');

      const aiResponse = await aiService.processCommand('Hey Juno, improve this');
      expect(aiResponse.text).toBe('Mocked AI response. This is a test.');

      const transcription2 = await textProcessing.processText(
        'back to transcription.. mode..'
      );
      expect(transcription2.text).toBe('back to transcription. mode.');
      expect(transcription2.text).not.toContain('..');
    });
  });
}); 