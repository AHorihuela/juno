/**
 * Tests for WhisperAPIClient
 */
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const sinon = require('sinon');
const WhisperAPIClient = require('../../../main/services/api/WhisperAPIClient');
const { APIError } = require('../../../main/utils/ErrorManager');

describe('WhisperAPIClient', () => {
  let client;
  let mockResourceManager;
  let mockConfigService;
  let mockDictionaryService;
  let mockOpenAI;
  let mockFileStats;
  
  beforeEach(() => {
    // Create mock services
    mockOpenAI = {
      audio: {
        transcriptions: {
          create: sinon.stub().resolves({ text: 'Test transcription' })
        }
      }
    };
    
    mockResourceManager = {
      getOpenAIClient: sinon.stub().resolves(mockOpenAI)
    };
    
    mockConfigService = {
      getOpenAIApiKey: sinon.stub().resolves('test-api-key')
    };
    
    mockDictionaryService = {
      generateWhisperPrompt: sinon.stub().resolves('test prompt')
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
    sinon.stub(fs.promises, 'stat').resolves(mockFileStats);
    sinon.stub(fs, 'createReadStream').returns('mock-stream');
  });
  
  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });
  
  describe('validateAndGetApiKey', () => {
    it('should return API key when configured', async () => {
      const apiKey = await client.validateAndGetApiKey();
      expect(apiKey).to.equal('test-api-key');
      expect(mockConfigService.getOpenAIApiKey.calledOnce).to.be.true;
    });
    
    it('should throw APIError when API key is not configured', async () => {
      mockConfigService.getOpenAIApiKey.resolves(null);
      
      try {
        await client.validateAndGetApiKey();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(APIError);
        expect(error.code).to.equal('ERR_API_KEY_MISSING');
      }
    });
  });
  
  describe('calculateAudioDuration', () => {
    it('should calculate correct duration from file stats', () => {
      const duration = client.calculateAudioDuration(mockFileStats);
      expect(duration).to.equal(5); // 5 seconds
    });
  });
  
  describe('generateCacheKey', () => {
    it('should generate a cache key with file path, size and mtime', async () => {
      const cacheKey = await client.generateCacheKey('/path/to/audio.wav');
      expect(cacheKey).to.include('whisper:/path/to/audio.wav');
      expect(cacheKey).to.include(mockFileStats.size.toString());
      expect(cacheKey).to.include(mockFileStats.mtime.getTime().toString());
    });
  });
  
  describe('transcribeAudio', () => {
    it('should call Whisper API and return transcription', async () => {
      const result = await client.transcribeAudio('/path/to/audio.wav');
      
      expect(result).to.deep.equal({ text: 'Test transcription' });
      expect(mockResourceManager.getOpenAIClient.calledOnce).to.be.true;
      expect(mockDictionaryService.generateWhisperPrompt.calledOnce).to.be.true;
      expect(mockOpenAI.audio.transcriptions.create.calledOnce).to.be.true;
      
      // Verify API parameters
      const apiParams = mockOpenAI.audio.transcriptions.create.firstCall.args[0];
      expect(apiParams.file).to.equal('mock-stream');
      expect(apiParams.model).to.equal('whisper-1');
      expect(apiParams.language).to.equal('en');
      expect(apiParams.prompt).to.equal('test prompt');
      expect(apiParams.temperature).to.equal(0.0);
      expect(apiParams.response_format).to.equal('json');
    });
    
    it('should use cache when available', async () => {
      // Setup cache with a mock result
      const cacheKey = await client.generateCacheKey('/path/to/audio.wav');
      const cachedResult = { text: 'Cached transcription' };
      client.cache.set('transcribe', { cacheKey }, cachedResult);
      
      // Call transcribeAudio
      const result = await client.transcribeAudio('/path/to/audio.wav');
      
      // Verify result and that API was not called
      expect(result).to.deep.equal(cachedResult);
      expect(mockOpenAI.audio.transcriptions.create.called).to.be.false;
    });
    
    it('should skip cache when useCache is false', async () => {
      // Setup cache with a mock result
      const cacheKey = await client.generateCacheKey('/path/to/audio.wav');
      const cachedResult = { text: 'Cached transcription' };
      client.cache.set('transcribe', { cacheKey }, cachedResult);
      
      // Call transcribeAudio with useCache: false
      const result = await client.transcribeAudio('/path/to/audio.wav', { useCache: false });
      
      // Verify result and that API was called
      expect(result).to.deep.equal({ text: 'Test transcription' });
      expect(mockOpenAI.audio.transcriptions.create.calledOnce).to.be.true;
    });
    
    it('should throw APIError when API call fails', async () => {
      // Make API call fail
      const apiError = new Error('API failure');
      mockOpenAI.audio.transcriptions.create.rejects(apiError);
      
      try {
        await client.transcribeAudio('/path/to/audio.wav');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(APIError);
        expect(error.code).to.equal('ERR_WHISPER_API');
        expect(error.metadata.originalError).to.equal(apiError);
      }
    });
  });
  
  describe('cache management', () => {
    it('should return cache statistics', () => {
      const stats = client.getCacheStats();
      expect(stats).to.have.property('size');
      expect(stats).to.have.property('maxSize');
      expect(stats).to.have.property('hitRate');
    });
    
    it('should clear the cache', () => {
      // Add something to cache
      client.cache.set('transcribe', { test: 'key' }, { text: 'test' });
      expect(client.cache.get('transcribe', { test: 'key' })).to.not.be.undefined;
      
      // Clear cache
      client.clearCache();
      
      // Verify cache is empty
      expect(client.cache.get('transcribe', { test: 'key' })).to.be.undefined;
    });
  });
}); 