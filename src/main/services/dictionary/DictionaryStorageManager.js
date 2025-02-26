const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Constants
const STORE_NAME = 'dictionary';
const LOG_PREFIX = '[DictionaryStorage]';

// Schema definition for the dictionary store
const DICTIONARY_SCHEMA = {
  words: {
    type: 'array',
    items: {
      type: 'string'
    },
    default: []
  },
  stats: {
    type: 'object',
    properties: {
      promptsGenerated: { type: 'number', default: 0 },
      exactMatches: { type: 'number', default: 0 },
      fuzzyMatches: { type: 'number', default: 0 },
      unmatchedWords: { type: 'number', default: 0 },
      totalProcessed: { type: 'number', default: 0 }
    },
    default: {
      promptsGenerated: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedWords: 0,
      totalProcessed: 0
    }
  }
};

/**
 * Handles all storage operations for the dictionary service
 */
class DictionaryStorageManager {
  constructor(parentService) {
    this.parentService = parentService;
    this.dictionaryPath = path.join(app.getPath('userData'), 'userDictionary.json');
    this.store = null;
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
    if (this.parentService && this.parentService.emitError) {
      this.parentService.emitError(error);
    }
    return error;
  }

  /**
   * Initialize the store
   * @returns {Object} - The initialized store
   */
  async initializeStore() {
    try {
      // If store is already initialized, return it
      if (this.store) {
        this._log('Dictionary store already initialized');
        return this.store;
      }
      
      this._log('Initializing dictionary store...');
      
      // Import electron-store dynamically to avoid issues during initialization
      const Store = await this._importElectronStore();
      
      // Get encryption key from config service if available
      const encryptionKey = await this._getEncryptionKey();
      
      // Create store with schema
      try {
        this.store = new Store({
          name: STORE_NAME,
          encryptionKey,
          schema: DICTIONARY_SCHEMA
        });
        
        // Verify store is working by attempting to access it
        const testAccess = this.store.get('words', null);
        this._log(`Dictionary store initialized successfully, contains ${testAccess ? testAccess.length : 0} words`);
        
        return this.store;
      } catch (error) {
        this._logError('Error creating electron-store instance:', error);
        
        // If there's a JSON parse error, the config file might be corrupted
        if (error instanceof SyntaxError) {
          return await this._recoverCorruptedStore(encryptionKey);
        }
        
        throw error;
      }
    } catch (error) {
      return this._handleError('Error initializing dictionary store:', error);
    }
  }

  // Helper method to import electron-store
  async _importElectronStore() {
    try {
      return (await import('electron-store')).default;
    } catch (error) {
      this._logError('Error importing electron-store:', error);
      throw new Error('Failed to import electron-store module');
    }
  }

  // Helper method to get encryption key
  async _getEncryptionKey() {
    try {
      if (this.parentService) {
        const configService = this.parentService.getService('config');
        if (configService) {
          const key = await configService.getEncryptionKey();
          this._log('Retrieved encryption key for dictionary store');
          return key;
        }
      }
    } catch (error) {
      this._logError('Error getting encryption key, proceeding without encryption:', error);
    }
    return null;
  }

  // Helper method to recover corrupted store
  async _recoverCorruptedStore(encryptionKey) {
    this._log('Dictionary store file might be corrupted, attempting recovery...');
    
    try {
      // Get the config file path
      const userDataPath = app.getPath('userData');
      const dictPath = path.join(userDataPath, `${STORE_NAME}.json`);
      
      // Delete the corrupted file if it exists
      if (fs.existsSync(dictPath)) {
        fs.unlinkSync(dictPath);
        this._log('Deleted corrupted dictionary store file');
      }
      
      // Try creating the store again
      const Store = await this._importElectronStore();
      this.store = new Store({
        name: STORE_NAME,
        encryptionKey,
        schema: DICTIONARY_SCHEMA
      });
      
      this._log('Dictionary store recovered successfully');
      return this.store;
    } catch (recoveryError) {
      this._logError('Failed to recover dictionary store:', recoveryError);
      throw new Error('Failed to initialize dictionary storage');
    }
  }

  /**
   * Ensure store is initialized
   * @returns {Object} - The initialized store
   */
  async ensureStoreInitialized() {
    if (!this.store) {
      this._log('Store not initialized, initializing now...');
      await this.initializeStore();
    }
    return this.store;
  }

  /**
   * Load words from store
   * @returns {Set} - Set of words
   */
  async loadWords() {
    this._log('Loading words from store...');
    try {
      // Ensure store is initialized
      await this.ensureStoreInitialized();
      
      // Load words from store
      const words = this.store.get('words', []);
      this._log(`Raw words from store: ${words.length} items`);
      
      if (!Array.isArray(words)) {
        this._logError('Words from store is not an array:', typeof words);
        return new Set();
      }
      
      const wordSet = new Set(words);
      this._log(`Words loaded into Set: ${wordSet.size} items`);
      
      return wordSet;
    } catch (error) {
      this._handleError('Error loading words from store:', error);
      return new Set();
    }
  }

  /**
   * Load stats from store
   * @returns {Object} - Stats object
   */
  async loadStats() {
    try {
      await this.ensureStoreInitialized();
      return this.store.get('stats', {
        promptsGenerated: 0,
        exactMatches: 0,
        fuzzyMatches: 0,
        unmatchedWords: 0,
        totalProcessed: 0
      });
    } catch (error) {
      this._handleError('Error loading stats from store:', error);
      return {
        promptsGenerated: 0,
        exactMatches: 0,
        fuzzyMatches: 0,
        unmatchedWords: 0,
        totalProcessed: 0
      };
    }
  }

  /**
   * Save words to store
   * @param {Set} words - Set of words to save
   * @returns {boolean} - Success status
   */
  async saveWords(words) {
    this._log('Saving words to store...');
    try {
      await this.ensureStoreInitialized();
      
      // Convert Set to Array for storage
      const wordsArray = Array.from(words);
      this.store.set('words', wordsArray);
      
      this._log(`Saved ${wordsArray.length} words to store`);
      return true;
    } catch (error) {
      this._handleError('Error saving words to store:', error);
      return false;
    }
  }

  /**
   * Save stats to store
   * @param {Object} stats - Stats object to save
   * @returns {boolean} - Success status
   */
  async saveStats(stats) {
    try {
      await this.ensureStoreInitialized();
      this.store.set('stats', stats);
      return true;
    } catch (error) {
      this._handleError('Error saving stats to store:', error);
      return false;
    }
  }
}

module.exports = DictionaryStorageManager; 