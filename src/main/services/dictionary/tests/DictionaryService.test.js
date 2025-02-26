/**
 * Comprehensive tests for the DictionaryService
 */
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Mock dependencies
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  }
}));

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn()
  }));
});

// Import the modules to test
const DictionaryService = require('../index')();
const DictionaryStorageManager = require('../DictionaryStorageManager');
const TextProcessor = require('../TextProcessor');
const StatisticsCollector = require('../StatisticsCollector');
const { COMMON_PHRASES } = require('../constants');

describe('DictionaryService', () => {
  let service;
  
  beforeEach(() => {
    // Create a fresh instance for each test
    service = new DictionaryService();
    
    // Mock console methods to avoid cluttering test output
    global.console.log = jest.fn();
    global.console.error = jest.fn();
    global.console.warn = jest.fn();
  });
  
  afterEach(() => {
    // Clean up
    jest.clearAllMocks();
  });
  
  describe('Initialization', () => {
    test('should initialize with correct modules', () => {
      expect(service.storageManager).toBeInstanceOf(DictionaryStorageManager);
      expect(service.textProcessor).toBeInstanceOf(TextProcessor);
      expect(service.statsCollector).toBeInstanceOf(StatisticsCollector);
      expect(service.words).toBeInstanceOf(Set);
      expect(service.initialized).toBe(false);
    });
    
    test('should initialize service when ensureInitialized is called', async () => {
      // Mock the initialize method
      service._initialize = jest.fn().mockResolvedValue(true);
      
      await service.ensureInitialized();
      
      expect(service._initialize).toHaveBeenCalled();
    });
  });
  
  describe('Word Management', () => {
    beforeEach(() => {
      // Mock initialization
      service.initialized = true;
      service.words = new Set(['apple', 'banana', 'orange']);
      service.saveDictionary = jest.fn().mockResolvedValue(true);
    });
    
    test('should add a word to the dictionary', async () => {
      const result = await service.addWord('grape');
      
      expect(result).toBe(true);
      expect(service.words.has('grape')).toBe(true);
      expect(service.saveDictionary).toHaveBeenCalled();
    });
    
    test('should trim words before adding', async () => {
      const result = await service.addWord('  pear  ');
      
      expect(result).toBe(true);
      expect(service.words.has('pear')).toBe(true);
    });
    
    test('should reject invalid words', async () => {
      await expect(service.addWord('')).rejects.toThrow('Word cannot be empty');
      await expect(service.addWord(null)).rejects.toThrow('Invalid word');
      await expect(service.addWord(123)).rejects.toThrow('Invalid word');
    });
    
    test('should remove a word from the dictionary', async () => {
      const result = await service.removeWord('banana');
      
      expect(result).toBe(true);
      expect(service.words.has('banana')).toBe(false);
      expect(service.saveDictionary).toHaveBeenCalled();
    });
    
    test('should return false when removing a non-existent word', async () => {
      const result = await service.removeWord('grape');
      
      expect(result).toBe(false);
      expect(service.saveDictionary).not.toHaveBeenCalled();
    });
    
    test('should get all words sorted alphabetically', async () => {
      const words = await service.getAllWords();
      
      expect(words).toEqual(['apple', 'banana', 'orange']);
    });
  });
  
  describe('Text Processing', () => {
    beforeEach(() => {
      // Mock initialization
      service.initialized = true;
      service.words = new Set(['apple', 'banana', 'orange']);
      
      // Mock the text processor
      service.textProcessor.processText = jest.fn().mockReturnValue({
        result: 'processed text',
        runStats: {
          exactMatches: 1,
          fuzzyMatches: 1,
          unmatchedWords: 1,
          totalWords: 3,
          replacements: [{ original: 'aple', replacement: 'apple' }]
        }
      });
      
      // Mock the storage manager
      service.storageManager.saveStats = jest.fn().mockResolvedValue(true);
    });
    
    test('should process text with default options', () => {
      const result = service.processText('test text');
      
      expect(result).toBe('processed text');
      expect(service.textProcessor.processText).toHaveBeenCalledWith(
        'test text',
        service.words,
        expect.any(Object),
        expect.objectContaining({
          enableFuzzyMatching: false,
          enableDetailedLogging: false
        })
      );
    });
    
    test('should process transcribed text with custom options', () => {
      const result = service.processTranscribedText('test text', {
        enableFuzzyMatching: true,
        enableDetailedLogging: true
      });
      
      expect(result).toBe('processed text');
      expect(service.textProcessor.processText).toHaveBeenCalledWith(
        'test text',
        service.words,
        expect.any(Object),
        expect.objectContaining({
          enableFuzzyMatching: true,
          enableDetailedLogging: true
        })
      );
    });
    
    test('should return original text if service is not initialized', () => {
      service.initialized = false;
      
      const result = service.processTranscribedText('test text');
      
      expect(result).toBe('test text');
      expect(service.textProcessor.processText).not.toHaveBeenCalled();
    });
  });
  
  describe('Statistics', () => {
    beforeEach(() => {
      // Mock initialization
      service.initialized = true;
      service.words = new Set(['apple', 'banana', 'orange']);
      
      // Mock the stats collector
      service.statsCollector.getFormattedStats = jest.fn().mockReturnValue({
        promptsGenerated: 5,
        exactMatches: 10,
        fuzzyMatches: 5,
        unmatchedWords: 5,
        totalProcessed: 20,
        dictionarySize: 3,
        effectiveness: {
          exactMatchRate: '50.00%',
          fuzzyMatchRate: '25.00%',
          unmatchedRate: '25.00%'
        }
      });
    });
    
    test('should get formatted statistics', () => {
      const stats = service.getStats();
      
      expect(stats).toEqual({
        promptsGenerated: 5,
        exactMatches: 10,
        fuzzyMatches: 5,
        unmatchedWords: 5,
        totalProcessed: 20,
        dictionarySize: 3,
        effectiveness: {
          exactMatchRate: '50.00%',
          fuzzyMatchRate: '25.00%',
          unmatchedRate: '25.00%'
        }
      });
      expect(service.statsCollector.getFormattedStats).toHaveBeenCalledWith(3);
    });
  });
  
  describe('Whisper Prompt Generation', () => {
    beforeEach(() => {
      // Mock initialization
      service.initialized = true;
      service.words = new Set(['apple', 'banana', 'orange']);
      
      // Mock the stats collector
      service.statsCollector.incrementPromptGenerated = jest.fn();
      service.statsCollector.getStats = jest.fn().mockReturnValue({});
      
      // Mock the storage manager
      service.storageManager.saveStats = jest.fn().mockResolvedValue(true);
      
      // Mock the context service
      service.getService = jest.fn().mockReturnValue({
        getRecentItems: jest.fn().mockResolvedValue([
          { text: 'This is a recent phrase.' },
          { text: 'Another recent phrase!' }
        ])
      });
    });
    
    test('should generate a whisper prompt with dictionary words, recent phrases, and common phrases', async () => {
      const prompt = await service.generateWhisperPrompt();
      
      expect(prompt).toContain('<dictionary>');
      expect(prompt).toContain('</dictionary>');
      expect(prompt).toContain('apple');
      expect(prompt).toContain('banana');
      expect(prompt).toContain('orange');
      expect(prompt).toContain('This is a recent phrase');
      expect(prompt).toContain('Another recent phrase');
      
      // Check that common phrases are included
      COMMON_PHRASES.forEach(phrase => {
        expect(prompt).toContain(phrase);
      });
      
      expect(service.statsCollector.incrementPromptGenerated).toHaveBeenCalled();
      expect(service.storageManager.saveStats).toHaveBeenCalled();
    });
    
    test('should return empty string if dictionary is empty', async () => {
      service.words = new Set();
      
      const prompt = await service.generateWhisperPrompt();
      
      expect(prompt).toBe('');
      expect(service.statsCollector.incrementPromptGenerated).not.toHaveBeenCalled();
    });
    
    test('should handle errors when getting context phrases', async () => {
      service.getService = jest.fn().mockImplementation(() => {
        throw new Error('Context service error');
      });
      
      const prompt = await service.generateWhisperPrompt();
      
      // Should still generate a prompt with dictionary words and common phrases
      expect(prompt).toContain('<dictionary>');
      expect(prompt).toContain('apple');
      expect(prompt).not.toContain('This is a recent phrase');
    });
  });
});

// Tests for DictionaryStorageManager
describe('DictionaryStorageManager', () => {
  let storageManager;
  let mockParentService;
  
  beforeEach(() => {
    // Create mock parent service
    mockParentService = {
      getService: jest.fn(),
      emitError: jest.fn()
    };
    
    // Create a fresh instance for each test
    storageManager = new DictionaryStorageManager(mockParentService);
    
    // Mock console methods to avoid cluttering test output
    global.console.log = jest.fn();
    global.console.error = jest.fn();
    global.console.warn = jest.fn();
  });
  
  afterEach(() => {
    // Clean up
    jest.clearAllMocks();
  });
  
  test('should initialize with correct properties', () => {
    expect(storageManager.parentService).toBe(mockParentService);
    expect(storageManager.dictionaryPath).toBe('/mock/path/userDictionary.json');
    expect(storageManager.store).toBeNull();
  });
  
  // Add more tests for storage manager methods
});

// Tests for TextProcessor
describe('TextProcessor', () => {
  let textProcessor;
  let mockParentService;
  
  beforeEach(() => {
    // Create mock parent service
    mockParentService = {
      getService: jest.fn(),
      emitError: jest.fn()
    };
    
    // Create a fresh instance for each test
    textProcessor = new TextProcessor(mockParentService);
    
    // Mock console methods to avoid cluttering test output
    global.console.log = jest.fn();
    global.console.error = jest.fn();
  });
  
  afterEach(() => {
    // Clean up
    jest.clearAllMocks();
  });
  
  test('should initialize with correct properties', () => {
    expect(textProcessor.parentService).toBe(mockParentService);
    expect(textProcessor.LOG_PREFIX).toBe('[DictionaryTextProcessor]');
  });
  
  test('should calculate Levenshtein distance correctly', () => {
    expect(textProcessor.fuzzyMatch('kitten', 'sitting')).toBe(3);
    expect(textProcessor.fuzzyMatch('apple', 'apple')).toBe(0);
    expect(textProcessor.fuzzyMatch('', 'abc')).toBe(3);
  });
  
  test('should find closest match in dictionary', () => {
    const dictionary = new Set(['apple', 'banana', 'orange']);
    
    expect(textProcessor.findClosestMatch('aple', dictionary)).toBe('apple');
    expect(textProcessor.findClosestMatch('banan', dictionary)).toBe('banana');
    expect(textProcessor.findClosestMatch('completely different', dictionary)).toBeNull();
  });
  
  test('should process text correctly', () => {
    const dictionary = new Set(['apple', 'banana', 'orange']);
    const globalStats = {
      promptsGenerated: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedWords: 0,
      totalProcessed: 0
    };
    
    const { result, runStats } = textProcessor.processText(
      'I like apple and banan and grape',
      dictionary,
      globalStats,
      { enableFuzzyMatching: true }
    );
    
    expect(result).toBe('I like apple and banana and grape');
    expect(runStats.exactMatches).toBe(1);
    expect(runStats.fuzzyMatches).toBe(1);
    expect(runStats.unmatchedWords).toBe(1);
    expect(globalStats.exactMatches).toBe(1);
    expect(globalStats.fuzzyMatches).toBe(1);
    expect(globalStats.unmatchedWords).toBe(1);
  });
});

// Tests for StatisticsCollector
describe('StatisticsCollector', () => {
  let statsCollector;
  
  beforeEach(() => {
    // Create a fresh instance for each test
    statsCollector = new StatisticsCollector();
    
    // Mock console methods to avoid cluttering test output
    global.console.log = jest.fn();
    global.console.error = jest.fn();
  });
  
  afterEach(() => {
    // Clean up
    jest.clearAllMocks();
  });
  
  test('should initialize with default stats', () => {
    expect(statsCollector.stats).toEqual({
      promptsGenerated: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedWords: 0,
      totalProcessed: 0
    });
  });
  
  test('should initialize stats from stored data', () => {
    const storedStats = {
      promptsGenerated: 5,
      exactMatches: 10,
      fuzzyMatches: 5,
      unmatchedWords: 5,
      totalProcessed: 20
    };
    
    statsCollector.initializeStats(storedStats);
    
    expect(statsCollector.stats).toEqual(storedStats);
  });
  
  test('should calculate percentage correctly', () => {
    expect(statsCollector._calculatePercentage(25, 100)).toBe('25.00%');
    expect(statsCollector._calculatePercentage(0, 100)).toBe('0.00%');
    expect(statsCollector._calculatePercentage(10, 0)).toBe('0%');
  });
  
  test('should get formatted stats with effectiveness metrics', () => {
    statsCollector.stats = {
      promptsGenerated: 5,
      exactMatches: 10,
      fuzzyMatches: 5,
      unmatchedWords: 5,
      totalProcessed: 20
    };
    
    const formattedStats = statsCollector.getFormattedStats(3);
    
    expect(formattedStats).toEqual({
      promptsGenerated: 5,
      exactMatches: 10,
      fuzzyMatches: 5,
      unmatchedWords: 5,
      totalProcessed: 20,
      dictionarySize: 3,
      effectiveness: {
        exactMatchRate: '50.00%',
        fuzzyMatchRate: '25.00%',
        unmatchedRate: '25.00%'
      }
    });
  });
  
  test('should increment prompt generation count', () => {
    statsCollector.incrementPromptGenerated();
    
    expect(statsCollector.stats.promptsGenerated).toBe(1);
    
    statsCollector.incrementPromptGenerated();
    
    expect(statsCollector.stats.promptsGenerated).toBe(2);
  });
}); 