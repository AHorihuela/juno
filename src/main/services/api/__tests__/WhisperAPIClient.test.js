/**
 * Tests for WhisperAPIClient
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const WhisperAPIClient = require('../../api/WhisperAPIClient');
const { APIError } = require('../../../utils/ErrorManager');

describe('WhisperAPIClient', () => {
  let client;
  let mockResourceManager;
  let mockConfigService;
  let mockDictionaryService;
  let mockOpenAI;
  let mockFileStats;
  let originalFsPromisesStat;
  let originalFsCreateReadStream;
  
  beforeEach(() => {
    // Save original functions
    originalFsPromisesStat = fs.promises.stat;
    originalFsCreateReadStream = fs.createReadStream;
    
    // Create mock services
    mockOpenAI = {
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue({ text: 'Test transcription' })
        }
      }
    };
    
    mockResourceManager = {
      getOpenAIClient: jest.fn().mockResolvedValue(mockOpenAI)
    };
    
    mockConfigService = {
      getOpenAIApiKey: jest.fn().mockResolvedValue('test-api-key')
    };
    
    mockDictionaryService = {
      generateWhisperPrompt: jest.fn().mockResolvedValue('test prompt')
    };
    
    mockFileStats = {
      size: 44 + (16000 * 2 * 5), // 5 seconds of audio
      mtime: new Date()
    };
    
    // Create client instance
    client = new WhisperAPIClient(
      mockResourceManager,
      mockConfigService,
      mockDictionaryService
    );
    
    // Mock fs methods
    fs.promises.stat = jest.fn().mockResolvedValue(mockFileStats);
    fs.createReadStream = jest.fn().mockReturnValue('mock-stream');
  });
  
  afterEach(() => {
    // Restore original functions
    fs.promises.stat = originalFsPromisesStat;
    fs.createReadStream = originalFsCreateReadStream;
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  describe('validateAndGetApiKey', () => {
    it('should return API key when configured', async () => {
      const apiKey = await client.validateAndGetApiKey();
      assert.strictEqual(apiKey, 'test-api-key');
      assert.strictEqual(mockConfigService.getOpenAIApiKey.mock.calls.length, 1);
    });
    
    it('should throw APIError when API key is not configured', async () => {
      mockConfigService.getOpenAIApiKey.mockResolvedValue(null);
      
      try {
        await client.validateAndGetApiKey();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error instanceof APIError);
        assert.strictEqual(error.code, 'ERR_API_KEY_MISSING');
      }
    });
  });
  
  describe('calculateAudioDuration', () => {
    it('should calculate correct duration from file stats', () => {
      const duration = client.calculateAudioDuration(mockFileStats);
      assert.strictEqual(duration, 5); // 5 seconds
    });
  });
  
  describe('generateCacheKey', () => {
    it('should generate a cache key with file path, size and mtime', async () => {
      const cacheKey = await client.generateCacheKey('/path/to/audio.wav');
      assert(cacheKey.includes('whisper:/path/to/audio.wav'));
      assert(cacheKey.includes(mockFileStats.size.toString()));
      assert(cacheKey.includes(mockFileStats.mtime.getTime().toString()));
    });
  });
  
  describe('transcribeAudio', () => {
    it('should call Whisper API and return transcription', async () => {
      const result = await client.transcribeAudio('/path/to/audio.wav');
      
      assert.deepStrictEqual(result, { text: 'Test transcription' });
      assert.strictEqual(mockResourceManager.getOpenAIClient.mock.calls.length, 1);
      assert.strictEqual(mockDictionaryService.generateWhisperPrompt.mock.calls.length, 1);
      assert.strictEqual(mockOpenAI.audio.transcriptions.create.mock.calls.length, 1);
      
      // Verify API parameters
      const apiParams = mockOpenAI.audio.transcriptions.create.mock.calls[0][0];
      assert.strictEqual(apiParams.file, 'mock-stream');
      assert.strictEqual(apiParams.model, 'whisper-1');
      assert.strictEqual(apiParams.language, 'en');
      assert.strictEqual(apiParams.prompt, 'test prompt');
      assert.strictEqual(apiParams.temperature, 0.0);
      assert.strictEqual(apiParams.response_format, 'json');
    });
    
    it('should use cache when available', async () => {
      // Setup cache with a mock result
      const cacheKey = await client.generateCacheKey('/path/to/audio.wav');
      const cachedResult = { text: 'Cached transcription' };
      client.cache.set('transcribe', { cacheKey }, cachedResult);
      
      // Call transcribeAudio
      const result = await client.transcribeAudio('/path/to/audio.wav');
      
      // Verify result and that API was not called
      assert.deepStrictEqual(result, cachedResult);
      assert.strictEqual(mockOpenAI.audio.transcriptions.create.mock.calls.length, 0);
    });
    
    it('should skip cache when useCache is false', async () => {
      // Setup cache with a mock result
      const cacheKey = await client.generateCacheKey('/path/to/audio.wav');
      const cachedResult = { text: 'Cached transcription' };
      client.cache.set('transcribe', { cacheKey }, cachedResult);
      
      // Call transcribeAudio with useCache: false
      const result = await client.transcribeAudio('/path/to/audio.wav', { useCache: false });
      
      // Verify result and that API was called
      assert.deepStrictEqual(result, { text: 'Test transcription' });
      assert.strictEqual(mockOpenAI.audio.transcriptions.create.mock.calls.length, 1);
    });
    
    it('should throw APIError when API call fails', async () => {
      // Make API call fail
      const apiError = new Error('API failure');
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(apiError);
      
      try {
        await client.transcribeAudio('/path/to/audio.wav');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error instanceof APIError);
        assert.strictEqual(error.code, 'ERR_WHISPER_API');
        assert.strictEqual(error.metadata.originalError, apiError);
      }
    });
  });
  
  describe('cache management', () => {
    it('should return cache statistics', () => {
      const stats = client.getCacheStats();
      assert(stats.hasOwnProperty('size'));
      assert(stats.hasOwnProperty('maxSize'));
      assert(stats.hasOwnProperty('hitRate'));
    });
    
    it('should clear the cache', () => {
      // Add something to cache
      client.cache.set('transcribe', { test: 'key' }, { text: 'test' });
      assert(client.cache.get('transcribe', { test: 'key' }) !== undefined);
      
      // Clear cache
      client.clearCache();
      
      // Verify cache is empty
      assert.strictEqual(client.cache.get('transcribe', { test: 'key' }), undefined);
    });
  });
}); 