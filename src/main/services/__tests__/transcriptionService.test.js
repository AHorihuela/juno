// Add OpenAI shim for Node environment
require('openai/shims/node');

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const configService = require('../configService');
const textProcessing = require('../textProcessing');
const aiService = require('../aiService');
const dictionaryService = require('../dictionaryService');
const textInsertionService = require('../textInsertionService');
const selectionService = require('../selectionService');
const { TranscriptionService } = require('../transcriptionService');

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({
          text: 'Test transcription'
        })
      }
    }
  }));
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

jest.mock('../configService', () => ({
  getOpenAIApiKey: jest.fn(),
  hasOpenAIApiKey: jest.fn(),
}));

jest.mock('../textProcessing', () => ({
  processText: jest.fn(text => 'final processed text'),
}));

jest.mock('../aiService', () => ({
  isAICommand: jest.fn(),
  processCommand: jest.fn(),
}));

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

jest.mock('../textInsertionService', () => ({
  insertText: jest.fn().mockResolvedValue(true),
  showNotification: jest.fn(),
}));

jest.mock('../selectionService', () => ({
  getSelectedText: jest.fn().mockResolvedValue(''),
}));

describe('TranscriptionService', () => {
  let transcriptionService;
  let mockOpenAI;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create service instance
    transcriptionService = new TranscriptionService();
    
    // Setup successful API key
    configService.getOpenAIApiKey.mockResolvedValue('test-api-key');
  });

  describe('OpenAI Integration', () => {
    it('initializes OpenAI client with API key', async () => {
      await transcriptionService.initializeOpenAI();
      expect(OpenAI).toHaveBeenCalledWith({ 
        apiKey: 'test-api-key'
      });
    });

    it('throws error if API key is not configured', async () => {
      configService.getOpenAIApiKey.mockResolvedValue(null);
      await expect(transcriptionService.initializeOpenAI())
        .rejects
        .toThrow('OpenAI API key not configured');
    });
  });

  describe('Audio Transcription', () => {
    it('successfully transcribes audio', async () => {
      const audioData = Buffer.from('test audio');
      const result = await transcriptionService.transcribeAudio(audioData);
      expect(result).toBe('final processed text');
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('handles invalid API key error', async () => {
      configService.getOpenAIApiKey.mockResolvedValue('invalid-key');
      const audioData = Buffer.from('test audio');
      
      await expect(transcriptionService.transcribeAudio(audioData))
        .rejects
        .toThrow('OpenAI API key not configured');
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('cleans up temp file even if transcription fails', async () => {
      configService.getOpenAIApiKey.mockResolvedValue('invalid-key');
      const audioData = Buffer.from('test audio data');
      
      try {
        await transcriptionService.transcribeAudio(audioData);
      } catch (e) {
        // Expected to throw
      }

      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('Text Processing', () => {
    it('processes AI commands', async () => {
      const text = 'Juno help me';
      aiService.isAICommand.mockResolvedValue(true);
      aiService.processCommand.mockResolvedValue({
        text: 'AI processed response',
        hasHighlight: false,
        originalCommand: text
      });

      const result = await transcriptionService.processAndInsertText(text);
      
      expect(aiService.processCommand).toHaveBeenCalledWith(text, expect.any(String));
      expect(textInsertionService.insertText).toHaveBeenCalledWith('AI processed response', expect.any(String));
      expect(result).toBe('AI processed response');
    });

    it('processes regular transcription', async () => {
      const text = 'normal text';
      aiService.isAICommand.mockResolvedValue(false);
      
      const result = await transcriptionService.processAndInsertText(text);
      
      expect(dictionaryService.processTranscribedText).toHaveBeenCalledWith(text);
      expect(textProcessing.processText).toHaveBeenCalledWith('processed text');
      expect(textInsertionService.insertText).toHaveBeenCalledWith('final processed text', expect.any(String));
      expect(result).toBe('final processed text');
    });

    it('handles highlighted text with AI commands', async () => {
      const text = 'Juno improve this';
      const highlightedText = 'selected text';
      
      selectionService.getSelectedText.mockResolvedValue(highlightedText);
      aiService.isAICommand.mockResolvedValue(true);
      aiService.processCommand.mockResolvedValue({
        text: 'AI processed with highlight',
        hasHighlight: true,
        originalCommand: text
      });

      const result = await transcriptionService.processAndInsertText(text);
      
      expect(aiService.processCommand).toHaveBeenCalledWith(text, highlightedText);
      expect(textInsertionService.insertText).toHaveBeenCalledWith('AI processed with highlight', highlightedText);
      expect(result).toBe('AI processed with highlight');
    });
  });
}); 