const BaseService = require('../BaseService');
const DictionaryStorageManager = require('./DictionaryStorageManager');
const TextProcessor = require('./TextProcessor');
const StatisticsCollector = require('./StatisticsCollector');
const { SERVICE_NAME, LOG_PREFIX, COMMON_PHRASES } = require('./constants');

/**
 * Dictionary Service for managing user dictionary and text processing
 * This service has been modularized for better maintainability and testability
 * 
 * Note: The dictionary is populated exclusively with user-added words.
 * Automatic word learning from transcriptions has been disabled to ensure
 * the dictionary contains only intentionally added terms.
 */
class DictionaryService extends BaseService {
  constructor() {
    super(SERVICE_NAME);
    
    // Initialize modules
    this.storageManager = new DictionaryStorageManager(this);
    this.textProcessor = new TextProcessor(this);
    this.statsCollector = new StatisticsCollector();
    
    // Initialize state
    this.words = new Set();
    this.initialized = false;
  }

  // Helper methods for logging
  _log(message) {
    console.log(`${LOG_PREFIX} ${message}`);
  }

  _logError(message, error) {
    console.error(`${LOG_PREFIX} ${message}`, error);
  }

  _logWarning(message) {
    console.warn(`${LOG_PREFIX} ${message}`);
  }

  // Helper method to handle errors
  _handleError(message, error) {
    this._logError(message, error);
    this.emitError(error);
    return error;
  }

  /**
   * Initialize the service
   * @private
   */
  async _initialize() {
    try {
      this._log('Initializing dictionary service...');
      
      // Initialize storage
      await this.storageManager.initializeStore();
      
      // Load dictionary words
      this.words = await this.storageManager.loadWords();
      this._log(`Loaded ${this.words.size} words from storage`);
      
      // Load statistics
      const storedStats = await this.storageManager.loadStats();
      this.statsCollector.initializeStats(storedStats);
      
      this.initialized = true;
      this._log('Dictionary service initialized successfully');
    } catch (error) {
      this._handleError('Error initializing dictionary service:', error);
    }
  }

  /**
   * Shutdown the service
   * @private
   */
  async _shutdown() {
    this._log('Shutting down dictionary service...');
    
    // Save any pending changes
    try {
      await this.saveDictionary();
      this._log('Dictionary saved during shutdown');
    } catch (error) {
      this._logError('Error saving dictionary during shutdown:', error);
    }
    
    this._log('Dictionary service shutdown complete');
  }

  /**
   * Ensure the service is initialized
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this._initialize();
    }
    return this.initialized;
  }

  /**
   * Save the dictionary to storage
   * @returns {Promise<boolean>} - Whether the save was successful
   */
  async saveDictionary() {
    this._log('Saving dictionary...');
    try {
      // Save words
      const wordsSaved = await this.storageManager.saveWords(this.words);
      
      // Save stats
      const statsSaved = await this.storageManager.saveStats(this.statsCollector.getStats());
      
      this._log('Dictionary saved successfully');
      return wordsSaved && statsSaved;
    } catch (error) {
      return this._handleError('Error saving dictionary:', error);
    }
  }

  /**
   * Get all words in the dictionary
   * @returns {Promise<string[]>} - Array of words
   */
  async getAllWords() {
    this._log('Getting all dictionary words...');
    await this.ensureInitialized();
    
    // Get words from the in-memory Set
    let words = Array.from(this.words);
    this._log(`Words from in-memory Set: ${words.length} items`);
    
    // If the in-memory Set is empty but we should have words, try to reload from store
    if (words.length === 0) {
      this._log('In-memory Set is empty, reloading from storage...');
      this.words = await this.storageManager.loadWords();
      words = Array.from(this.words);
    }
    
    this._log(`Returning ${words.length} words from dictionary`);
    return words.sort();
  }

  /**
   * Add a word to the dictionary
   * @param {string} word - The word to add
   * @returns {Promise<boolean>} - Whether the word was added successfully
   */
  async addWord(word) {
    if (!word || typeof word !== 'string') {
      throw new Error('Invalid word');
    }

    const trimmedWord = word.trim();
    if (!trimmedWord) {
      throw new Error('Word cannot be empty');
    }

    await this.ensureInitialized();
    
    this._log(`Adding word to dictionary: "${trimmedWord}"`);
    this.words.add(trimmedWord);
    
    // Save the updated dictionary
    const saved = await this.saveDictionary();
    
    if (saved) {
      this._log(`Word "${trimmedWord}" added successfully`);
      return true;
    } else {
      this._logError(`Failed to save word "${trimmedWord}" to dictionary`);
      return false;
    }
  }

  /**
   * Remove a word from the dictionary
   * @param {string} word - The word to remove
   * @returns {Promise<boolean>} - Whether the word was removed successfully
   */
  async removeWord(word) {
    if (!word || typeof word !== 'string') {
      throw new Error('Invalid word');
    }

    await this.ensureInitialized();
    
    this._log(`Removing word from dictionary: "${word}"`);
    const result = this.words.delete(word);
    
    if (result) {
      // Save the updated dictionary
      const saved = await this.saveDictionary();
      
      if (saved) {
        this._log(`Word "${word}" removed successfully`);
        return true;
      } else {
        this._logError(`Failed to save dictionary after removing word "${word}"`);
        return false;
      }
    }
    
    this._log(`Word "${word}" not found in dictionary`);
    return false;
  }

  /**
   * Process text using the dictionary
   * This is a simplified wrapper around processTranscribedText that allows
   * controlling logging verbosity and fuzzy matching
   * 
   * @param {string} text - The text to process
   * @param {Object} options - Processing options
   * @param {boolean} options.enableFuzzyMatching - Whether to enable fuzzy matching (default: false)
   * @param {boolean} options.enableDetailedLogging - Whether to enable detailed logging (default: false)
   * @returns {string} - The processed text
   */
  processText(text, options = {}) {
    const defaults = {
      enableFuzzyMatching: false,
      enableDetailedLogging: false
    };
    
    const settings = { ...defaults, ...options };
    
    return this.processTranscribedText(text, settings);
  }

  /**
   * Process transcribed text using the dictionary with detailed logging and statistics
   * 
   * @param {string} text - The text to process
   * @param {Object} options - Processing options
   * @param {boolean} options.enableFuzzyMatching - Whether to enable fuzzy matching (default: true)
   * @param {boolean} options.enableDetailedLogging - Whether to enable detailed logging (default: true)
   * @returns {string} - The processed text
   */
  processTranscribedText(text, options = {}) {
    if (!this.initialized) {
      this._logWarning('Dictionary service not initialized, processing text without dictionary');
      return text;
    }
    
    const { result } = this.textProcessor.processText(
      text, 
      this.words, 
      this.statsCollector.getStats(), 
      options
    );
    
    // Save updated stats
    this.storageManager.saveStats(this.statsCollector.getStats()).catch(error => {
      this._logWarning('Failed to save stats to store');
    });
    
    return result;
  }

  /**
   * Get dictionary statistics
   * @returns {Object} - Dictionary statistics
   */
  getStats() {
    return this.statsCollector.getFormattedStats(this.words.size);
  }

  /**
   * Generate a prompt for Whisper speech recognition
   * @returns {Promise<string>} - The generated prompt
   */
  async generateWhisperPrompt() {
    await this.ensureInitialized();
    
    this._log('Generating Whisper prompt...');
    const words = Array.from(this.words);
    
    if (words.length === 0) {
      this._log('No words in dictionary, skipping prompt');
      return '';
    }

    // Increment prompt generation count
    this.statsCollector.incrementPromptGenerated();
    
    // Get recent phrases from context
    const recentPhrases = await this._getRecentPhrasesFromContext();
    
    // Combine dictionary words, recent phrases, and common phrases
    const allPromptItems = [
      ...words,
      ...recentPhrases,
      ...COMMON_PHRASES
    ];
    
    // Using a very technical format that won't be mistaken as content
    // Based on Whisper documentation - using XML-like tags that are unlikely to be in natural speech
    const prompt = `<dictionary>${allPromptItems.join('|')}</dictionary>`;
    
    this._log(`Generated prompt with ${allPromptItems.length} items`);
    
    // Save updated stats to the store
    await this.storageManager.saveStats(this.statsCollector.getStats());
    
    return prompt;
  }

  /**
   * Get recent phrases from context service
   * @returns {Promise<string[]>} - Array of recent phrases
   */
  async _getRecentPhrasesFromContext() {
    let recentPhrases = [];
    try {
      const contextService = this.getService('context');
      if (contextService) {
        const recentItems = await contextService.getRecentItems(5);
        if (recentItems && recentItems.length > 0) {
          // Extract phrases from recent context
          recentPhrases = recentItems
            .filter(item => item.text && typeof item.text === 'string')
            .map(item => item.text.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 0))
            .flat()
            .slice(0, 3); // Take up to 3 recent phrases
          
          this._log(`Added recent phrases to prompt: ${recentPhrases.join(', ')}`);
        }
      }
    } catch (error) {
      this._logError('Error getting context for prompt:', error);
      // Continue without context if there's an error
    }
    return recentPhrases;
  }
}

// Export a factory function instead of a singleton
module.exports = () => new DictionaryService(); 