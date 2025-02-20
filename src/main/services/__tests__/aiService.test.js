const OpenAI = require('openai');
const { clipboard } = require('electron');
const configService = require('../configService');
const aiService = require('../aiService');

// Mock OpenAI
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
  MockOpenAI.mockCreate = mockCreate;
  return MockOpenAI;
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

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiService.openai = null;
    aiService.currentRequest = null;
    
    // Default mock values
    configService.getOpenAIApiKey.mockReturnValue('test-api-key');
    configService.getAITriggerWord.mockReturnValue('juno');
    configService.getAIModel.mockReturnValue('gpt-4');
    configService.getAITemperature.mockReturnValue(0.7);
    clipboard.readText.mockReturnValue('');
  });

  describe('AI Command Detection', () => {
    it('detects trigger word at start', () => {
      expect(aiService.isAICommand('juno help me with this')).toBe(true);
    });

    it('detects action verbs in first two words', () => {
      expect(aiService.isAICommand('summarize this text')).toBe(true);
      expect(aiService.isAICommand('please summarize this')).toBe(true);
    });

    it('ignores case for trigger word and verbs', () => {
      expect(aiService.isAICommand('JUNO help me')).toBe(true);
      expect(aiService.isAICommand('SUMMARIZE this')).toBe(true);
    });

    it('respects custom trigger word', () => {
      configService.getAITriggerWord.mockReturnValue('assistant');
      expect(aiService.isAICommand('assistant help me')).toBe(true);
      expect(aiService.isAICommand('juno help me')).toBe(false);
    });

    it('skips AI for explicit transcription requests', () => {
      expect(aiService.isAICommand('transcribe the following text')).toBe(false);
    });

    it('handles empty or invalid input', () => {
      expect(aiService.isAICommand('')).toBe(false);
      expect(aiService.isAICommand(null)).toBe(false);
      expect(aiService.isAICommand('   ')).toBe(false);
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
    it('processes commands successfully', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI response' } }],
      };
      OpenAI.mockCreate.mockResolvedValue(mockResponse);

      const result = await aiService.processCommand('juno help me', 'selected text');
      
      expect(result.text).toBe('AI response');
      expect(result.hasHighlight).toBe(true);
      expect(result.originalCommand).toBe('juno help me');
    });

    it('includes context in prompt', async () => {
      clipboard.readText.mockReturnValue('clipboard text');
      OpenAI.mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
      });

      await aiService.processCommand('juno help', 'selected text');

      expect(OpenAI.mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('selected text'),
          }),
        ]),
      }));
    });

    it('handles API errors', async () => {
      const error = new Error('API Error');
      error.response = { status: 401 };
      OpenAI.mockCreate.mockRejectedValue(error);

      await expect(aiService.processCommand('juno help'))
        .rejects
        .toThrow('Invalid OpenAI API key');
    });

    it('handles rate limiting', async () => {
      const error = new Error('Rate Limit');
      error.response = { status: 429 };
      OpenAI.mockCreate.mockRejectedValue(error);

      await expect(aiService.processCommand('juno help'))
        .rejects
        .toThrow('OpenAI API rate limit exceeded');
    });

    it('cancels ongoing requests', async () => {
      const mockAbort = jest.fn();
      aiService.currentRequest = { abort: mockAbort };

      aiService.cancelCurrentRequest();
      
      expect(mockAbort).toHaveBeenCalled();
      expect(aiService.currentRequest).toBeNull();
    });
  });

  describe('OpenAI Integration', () => {
    it('initializes OpenAI client with API key', () => {
      aiService.initializeOpenAI();
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('throws error if API key is not configured', () => {
      configService.getOpenAIApiKey.mockReturnValue(null);
      expect(() => aiService.initializeOpenAI())
        .toThrow('OpenAI API key not configured');
    });

    it('uses configured model and temperature', async () => {
      configService.getAIModel.mockReturnValue('gpt-4-turbo');
      configService.getAITemperature.mockReturnValue(0.9);

      OpenAI.mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
      });

      await aiService.processCommand('juno help');

      expect(OpenAI.mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gpt-4-turbo',
        temperature: 0.9,
      }));
    });
  });
}); 