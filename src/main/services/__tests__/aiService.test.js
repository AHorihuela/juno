const OpenAI = require('openai');
const { clipboard } = require('electron');
const configService = require('../configService');
const aiService = require('../aiService');
const notificationService = require('../notificationService');

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'test response' } }]
        })
      }
    }
  }));
});

// Mock electron clipboard
jest.mock('electron', () => ({
  clipboard: {
    readText: jest.fn(),
  },
}));

// Mock configService
jest.mock('../configService', () => ({
  getOpenAIApiKey: jest.fn(),
  getAITriggerWord: jest.fn(),
  getAIModel: jest.fn(),
  getAITemperature: jest.fn(),
}));

// Mock notificationService
jest.mock('../notificationService', () => ({
  showAPIError: jest.fn(),
  showAIError: jest.fn(),
}));

describe('AIService', () => {
  let mockOpenAIInstance;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a new mock instance for each test
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'test response' } }]
          })
        }
      }
    };
    
    // Make the OpenAI constructor return our mock instance
    OpenAI.mockImplementation(() => mockOpenAIInstance);
    
    // Reset AIService state
    aiService.openai = null;
    aiService.currentRequest = null;
    
    // Default mock values
    configService.getOpenAIApiKey.mockResolvedValue('test-api-key');
    configService.getAITriggerWord.mockResolvedValue('juno');
    configService.getAIModel.mockResolvedValue('gpt-4');
    configService.getAITemperature.mockResolvedValue(0.7);
    clipboard.readText.mockReturnValue('');
    
    // Setup AbortController mock
    global.AbortController = jest.fn(() => ({
      abort: jest.fn(),
      signal: {}
    }));
  });

  describe('AI Command Detection', () => {
    it('detects trigger word at start', async () => {
      const result = await aiService.isAICommand('juno help me with this');
      expect(result).toBe(true);
    });

    it('detects action verbs in first two words', async () => {
      const result1 = await aiService.isAICommand('summarize this text');
      const result2 = await aiService.isAICommand('please summarize this');
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('ignores case for trigger word and verbs', async () => {
      const result1 = await aiService.isAICommand('JUNO help me');
      const result2 = await aiService.isAICommand('SUMMARIZE this');
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('respects custom trigger word', async () => {
      configService.getAITriggerWord.mockResolvedValue('assistant');
      const result1 = await aiService.isAICommand('assistant help me');
      const result2 = await aiService.isAICommand('juno help me');
      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('skips AI for explicit transcription requests', async () => {
      const result = await aiService.isAICommand('transcribe the following text');
      expect(result).toBe(false);
    });

    it('handles empty or invalid input', async () => {
      const result1 = await aiService.isAICommand('');
      const result2 = await aiService.isAICommand(null);
      const result3 = await aiService.isAICommand('   ');
      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
  });

  describe('Context Gathering', () => {
    it('gets clipboard content', async () => {
      clipboard.readText.mockReturnValue('clipboard content');
      const context = await aiService.getContext();
      expect(context.clipboardText).toBe('clipboard content');
    });

    it('handles empty clipboard', async () => {
      clipboard.readText.mockReturnValue('');
      const context = await aiService.getContext();
      expect(context.clipboardText).toBe('');
    });
  });

  describe('Command Processing', () => {
    beforeEach(async () => {
      // Initialize OpenAI client before each test
      await aiService.initializeOpenAI();
    });

    it('processes commands successfully', async () => {
      mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: 'AI response' } }]
      });

      const result = await aiService.processCommand('juno help me', 'selected text');
      
      expect(result.text).toBe('AI response');
      expect(result.hasHighlight).toBe(true);
      expect(result.originalCommand).toBe('juno help me');
    });

    it('includes context in prompt', async () => {
      clipboard.readText.mockReturnValue('clipboard text');
      
      await aiService.processCommand('juno help', 'selected text');

      const createCall = mockOpenAIInstance.chat.completions.create.mock.calls[0][0];
      expect(createCall.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('selected text'),
        }),
      ]));
    });

    it('handles API errors', async () => {
      const error = new Error('API Error');
      error.response = { status: 401 };
      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(error);

      await expect(aiService.processCommand('juno help'))
        .rejects
        .toThrow('Invalid OpenAI API key');
      
      expect(notificationService.showAPIError).toHaveBeenCalledWith(error);
    });

    it('handles rate limiting', async () => {
      const error = new Error('Rate limit exceeded');
      error.response = { status: 429 };
      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(error);

      await expect(aiService.processCommand('juno help'))
        .rejects
        .toThrow('OpenAI API rate limit exceeded');
      
      expect(notificationService.showAPIError).toHaveBeenCalledWith(error);
    });

    it('cancels ongoing requests', async () => {
      const mockAbort = jest.fn();
      aiService.currentRequest = { abort: mockAbort };

      aiService.cancelCurrentRequest();
      
      expect(mockAbort).toHaveBeenCalled();
      expect(aiService.currentRequest).toBeNull();
    });

    it('cancels ongoing request when new one starts', async () => {
      const mockAbort = jest.fn();
      const mockController = { abort: mockAbort, signal: {} };
      global.AbortController = jest.fn(() => mockController);

      // Start first request
      const firstPromise = aiService.processCommand('first command');
      
      // Start second request before first completes
      const secondPromise = aiService.processCommand('second command');

      // Verify first request was cancelled
      expect(mockAbort).toHaveBeenCalled();
      
      // Verify no notification for cancelled request
      expect(notificationService.showAIError).not.toHaveBeenCalled();
    });

    it('handles AbortError without showing notification', async () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(abortError);

      const result = await aiService.processCommand('test command');
      
      expect(result).toBeNull();
      expect(notificationService.showAIError).not.toHaveBeenCalled();
    });

    it('cleans up currentRequest after completion', async () => {
      await aiService.processCommand('test command');
      expect(aiService.currentRequest).toBeNull();
    });
  });

  describe('OpenAI Integration', () => {
    it('initializes OpenAI client with API key', async () => {
      await aiService.initializeOpenAI();
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('throws error if API key is not configured', async () => {
      configService.getOpenAIApiKey.mockResolvedValue(null);
      await expect(aiService.initializeOpenAI())
        .rejects
        .toThrow('OpenAI API key not configured');
    });

    it('uses configured model and temperature', async () => {
      await aiService.initializeOpenAI();
      await aiService.processCommand('test command');

      const createCall = mockOpenAIInstance.chat.completions.create.mock.calls[0][0];
      expect(createCall.model).toBe('gpt-4');
      expect(createCall.temperature).toBe(0.7);
    });
  });
}); 