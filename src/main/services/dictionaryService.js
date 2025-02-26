const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const BaseService = require('./BaseService');

class DictionaryService extends BaseService {
  constructor() {
    super('Dictionary');
    this.words = new Set();
    this.dictionaryPath = path.join(app.getPath('userData'), 'userDictionary.json');
    this.store = null;
    this.stats = {
      promptsGenerated: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedWords: 0,
      totalProcessed: 0
    };
  }

  async _initialize() {
    await this.initializeStore();
    await this.loadDictionary();
  }

  async _shutdown() {
    // No need to explicitly save with electron-store as it's done automatically
    // Just clear any intervals we might have
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }
  }

  async initializeStore() {
    try {
      // If store is already initialized, return it
      if (this.store) {
        console.log('Dictionary store already initialized');
        return this.store;
      }
      
      console.log('Initializing dictionary store...');
      
      // Import electron-store dynamically to avoid issues during initialization
      let Store;
      try {
        Store = (await import('electron-store')).default;
      } catch (error) {
        console.error('Error importing electron-store:', error);
        throw new Error('Failed to import electron-store module');
      }
      
      // Get encryption key from config service if available
      let encryptionKey = null;
      try {
        const configService = this.getService('config');
        if (configService) {
          encryptionKey = await configService.getEncryptionKey();
          console.log('Retrieved encryption key for dictionary store');
        }
      } catch (error) {
        console.error('Error getting encryption key, proceeding without encryption:', error);
      }
      
      // Create store with schema
      try {
        this.store = new Store({
          name: 'dictionary', // Use a separate file from the main config
          encryptionKey,
          schema: {
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
          }
        });
        
        // Verify store is working by attempting to access it
        const testAccess = this.store.get('words', null);
        console.log(`Dictionary store initialized successfully, contains ${testAccess ? testAccess.length : 0} words`);
        
        return this.store;
      } catch (error) {
        console.error('Error creating electron-store instance:', error);
        
        // If there's a JSON parse error, the config file might be corrupted
        if (error instanceof SyntaxError) {
          console.log('Dictionary store file might be corrupted, attempting recovery...');
          
          try {
            // Get the config file path
            const userDataPath = app.getPath('userData');
            const dictPath = path.join(userDataPath, 'dictionary.json');
            
            // Delete the corrupted file if it exists
            if (fs.existsSync(dictPath)) {
              fs.unlinkSync(dictPath);
              console.log('Deleted corrupted dictionary store file');
            }
            
            // Try creating the store again
            this.store = new Store({
              name: 'dictionary',
              encryptionKey,
              schema: {
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
              }
            });
            
            console.log('Dictionary store recovered successfully');
            return this.store;
          } catch (recoveryError) {
            console.error('Failed to recover dictionary store:', recoveryError);
            throw new Error('Failed to initialize dictionary storage');
          }
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error initializing dictionary store:', error);
      this.emitError(error);
      throw error;
    }
  }

  async loadDictionary() {
    console.log('Loading dictionary from store...');
    try {
      // Ensure store is initialized
      if (!this.store) {
        console.log('Store not initialized, initializing now...');
        await this.initializeStore();
      }
      
      // Load words from store
      const words = this.store.get('words', []);
      console.log('Raw words from store:', words);
      
      if (!Array.isArray(words)) {
        console.error('Words from store is not an array:', typeof words, words);
        this.words = new Set();
      } else {
        this.words = new Set(words);
        console.log('Words loaded into Set:', Array.from(this.words));
      }
      
      // Load stats from store
      const savedStats = this.store.get('stats', {});
      this.stats = { ...this.stats, ...savedStats };
      
      console.log('Dictionary loaded successfully with', this.words.size, 'words');
      return true;
    } catch (error) {
      console.error('Error loading dictionary:', error);
      this.words = new Set();
      this.emitError(error);
      return false;
    }
  }

  async saveDictionary() {
    console.log('Saving dictionary...');
    try {
      // Save words to store
      const words = Array.from(this.words);
      this.store.set('words', words);
      
      // Save stats to store
      this.store.set('stats', this.stats);
      
      console.log('Dictionary saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving dictionary:', error);
      this.emitError(error);
      return false;
    }
  }

  async getAllWords() {
    console.log('Getting all dictionary words...');
    
    // First try to get words from the in-memory Set
    let words = Array.from(this.words);
    console.log('Words from in-memory Set:', words);
    
    // If the in-memory Set is empty but we know we should have words, try to reload from store
    if (words.length === 0 && this.store) {
      console.log('In-memory Set is empty, checking store directly...');
      const storeWords = this.store.get('words', []);
      console.log('Words directly from store:', storeWords);
      
      if (Array.isArray(storeWords) && storeWords.length > 0) {
        console.log('Found words in store, updating in-memory Set');
        this.words = new Set(storeWords);
        words = storeWords;
      }
    }
    
    // If we still don't have words, try to reload the dictionary
    if (words.length === 0) {
      console.log('No words found, attempting to reload dictionary...');
      await this.loadDictionary();
      words = Array.from(this.words);
    }
    
    console.log('Returning', words.length, 'words from dictionary');
    return words.sort();
  }

  async addWord(word) {
    if (!word || typeof word !== 'string') {
      throw new Error('Invalid word');
    }

    const trimmedWord = word.trim();
    if (!trimmedWord) {
      throw new Error('Word cannot be empty');
    }

    console.log('Adding word to dictionary:', trimmedWord);
    this.words.add(trimmedWord);
    
    // Ensure store is initialized before using it
    if (!this.store) {
      console.log('Store not initialized, initializing now...');
      await this.initializeStore();
    }
    
    // Save the updated words to the store
    try {
      const words = Array.from(this.words);
      console.log('Saving words to store:', words);
      this.store.set('words', words);
      
      // Verify the save operation
      const savedWords = this.store.get('words', []);
      console.log('Words after save:', savedWords);
      
      if (!savedWords.includes(trimmedWord)) {
        console.error('Word was not saved correctly to the store');
        throw new Error('Failed to save word to store');
      }
      
      console.log(`Word "${trimmedWord}" added successfully`);
      return true;
    } catch (error) {
      console.error('Error saving word to store:', error);
      this.emitError(error);
      throw error;
    }
  }

  async removeWord(word) {
    if (!word || typeof word !== 'string') {
      throw new Error('Invalid word');
    }

    console.log('Removing word from dictionary:', word);
    const result = this.words.delete(word);
    
    if (result) {
      // Ensure store is initialized before using it
      if (!this.store) {
        console.log('Store not initialized, initializing now...');
        await this.initializeStore();
      }
      
      // Save the updated words to the store
      try {
        const words = Array.from(this.words);
        this.store.set('words', words);
        console.log(`Word "${word}" removed successfully`);
        return true;
      } catch (error) {
        console.error('Error saving dictionary after word removal:', error);
        this.emitError(error);
        throw error;
      }
    }
    
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
    
    if (!settings.enableDetailedLogging) {
      // If detailed logging is disabled, temporarily store the console.log function
      const originalConsoleLog = console.log;
      console.log = () => {}; // No-op function
      
      try {
        // Call the full processing method with minimal logging
        const result = this.processTranscribedText(text, { 
          enableFuzzyMatching: settings.enableFuzzyMatching 
        });
        return result;
      } finally {
        // Restore console.log
        console.log = originalConsoleLog;
      }
    } else {
      // Use the full processing method with all logging
      return this.processTranscribedText(text, { 
        enableFuzzyMatching: settings.enableFuzzyMatching 
      });
    }
  }

  async generateWhisperPrompt() {
    console.log('[Dictionary] Generating Whisper prompt...');
    const words = Array.from(this.words);
    
    if (words.length === 0) {
      console.log('[Dictionary] No words in dictionary, skipping prompt');
      return '';
    }

    this.stats.promptsGenerated++;
    
    // Get common phrases from context if available
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
          
          console.log('[Dictionary] Added recent phrases to prompt:', recentPhrases);
        }
      }
    } catch (error) {
      console.error('[Dictionary] Error getting context for prompt:', error);
      // Continue without context if there's an error
    }
    
    // Add common speech patterns to reduce hallucinations
    const commonPhrases = [
      "I'm saying",
      "I said",
      "I meant",
      "I want to",
      "please",
      "thank you",
      "excuse me",
      "sorry",
      "hello",
      "hi there",
      "good morning",
      "good afternoon",
      "good evening"
    ];
    
    // Combine dictionary words, recent phrases, and common phrases
    const allPromptItems = [
      ...words,
      ...recentPhrases,
      ...commonPhrases
    ];
    
    // Using a very technical format that won't be mistaken as content
    // Based on Whisper documentation - using XML-like tags that are unlikely to be in natural speech
    const prompt = `<dictionary>${allPromptItems.join('|')}</dictionary>`;
    
    console.log('[Dictionary] Generated prompt with', allPromptItems.length, 'items');
    console.log('[Dictionary] Prompt:', prompt);
    console.log('[Dictionary] Total prompts generated:', this.stats.promptsGenerated);
    
    // Ensure store is initialized before using it
    if (!this.store) {
      console.log('[Dictionary] Store not initialized, initializing now...');
      await this.initializeStore();
    }
    
    // Save updated stats to the store
    try {
      this.store.set('stats', this.stats);
    } catch (error) {
      console.error('[Dictionary] Error saving stats to store:', error);
      // Continue without saving stats
    }
    
    return prompt;
  }

  fuzzyMatch(str1, str2) {
    // Simple Levenshtein distance implementation
    const matrix = Array(str1.length + 1).fill().map(() => Array(str2.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= str2.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        const cost = str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase() ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    return matrix[str1.length][str2.length];
  }

  findClosestMatch(word) {
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const dictWord of this.words) {
      const distance = this.fuzzyMatch(word, dictWord);
      if (distance < bestDistance && distance <= Math.min(word.length / 3, 3)) {
        bestDistance = distance;
        bestMatch = dictWord;
      }
    }
    
    return bestMatch;
  }

  /**
   * Process transcribed text using the dictionary with detailed logging and statistics
   * 
   * @param {string} text - The text to process
   * @param {Object} options - Processing options
   * @param {boolean} options.enableFuzzyMatching - Whether to enable fuzzy matching (default: true)
   * @returns {string} - The processed text
   */
  processTranscribedText(text, options = {}) {
    console.log('\n[Dictionary] Starting text processing...');
    console.log('[Dictionary] Input text:', text);
    if (!text) return '';

    const defaults = {
      enableFuzzyMatching: true
    };
    
    const settings = { ...defaults, ...options };

    // Reset word-level stats for this processing run
    const runStats = {
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedWords: 0,
      totalWords: 0,
      replacements: []
    };

    // Split text into words while preserving punctuation and spacing
    const words = text.split(/(\b\w+\b)/);
    
    // Process each word
    const processed = words.map(part => {
      // If it's not a word (punctuation/space), preserve it
      if (!/^\w+\b/.test(part)) {
        return part;
      }

      runStats.totalWords++;
      this.stats.totalProcessed++;
      
      // Check for exact match first
      if (this.words.has(part)) {
        console.log(`[Dictionary] ✓ Exact match found for "${part}"`);
        runStats.exactMatches++;
        this.stats.exactMatches++;
        return part;
      }

      // Try fuzzy matching for potential corrections if enabled
      if (settings.enableFuzzyMatching) {
        const closestMatch = this.findClosestMatch(part);
        if (closestMatch) {
          console.log(`[Dictionary] ~ Fuzzy match: "${part}" -> "${closestMatch}"`);
          runStats.fuzzyMatches++;
          this.stats.fuzzyMatches++;
          runStats.replacements.push({ original: part, replacement: closestMatch });
          return closestMatch;
        }
      }

      console.log(`[Dictionary] × No match for "${part}"`);
      runStats.unmatchedWords++;
      this.stats.unmatchedWords++;
      return part;
    });

    const result = processed.join('');
    
    // Log detailed statistics for this processing run
    console.log('\n[Dictionary] Processing complete:');
    console.log('  - Total words processed:', runStats.totalWords);
    console.log('  - Exact matches:', runStats.exactMatches);
    console.log('  - Fuzzy matches:', runStats.fuzzyMatches);
    console.log('  - Unmatched words:', runStats.unmatchedWords);
    
    if (runStats.replacements.length > 0) {
      console.log('\n[Dictionary] Replacements made:');
      runStats.replacements.forEach(({ original, replacement }) => {
        console.log(`  "${original}" → "${replacement}"`);
      });
    }

    // Log cumulative statistics
    console.log('\n[Dictionary] Cumulative statistics:');
    console.log('  - Total prompts generated:', this.stats.promptsGenerated);
    console.log('  - Total exact matches:', this.stats.exactMatches);
    console.log('  - Total fuzzy matches:', this.stats.fuzzyMatches);
    console.log('  - Total unmatched words:', this.stats.unmatchedWords);
    
    // Ensure store is initialized before using it
    if (this.store) {
      // Save updated stats to the store
      try {
        this.store.set('stats', this.stats);
      } catch (error) {
        console.error('[Dictionary] Error saving stats to store:', error);
        // Continue without saving stats
      }
    } else {
      console.warn('[Dictionary] Store not initialized, stats not saved');
    }
    
    console.log('\n[Dictionary] Output text:', result);
    return result;
  }

  getStats() {
    const stats = {
      ...this.stats,
      dictionarySize: this.words.size,
      effectiveness: {
        exactMatchRate: this.stats.totalProcessed > 0 
          ? (this.stats.exactMatches / this.stats.totalProcessed * 100).toFixed(2) + '%'
          : '0%',
        fuzzyMatchRate: this.stats.totalProcessed > 0
          ? (this.stats.fuzzyMatches / this.stats.totalProcessed * 100).toFixed(2) + '%'
          : '0%',
        unmatchedRate: this.stats.totalProcessed > 0
          ? (this.stats.unmatchedWords / this.stats.totalProcessed * 100).toFixed(2) + '%'
          : '0%'
      }
    };
    
    // Ensure store is initialized before using it
    if (this.store) {
      // Update stats in the store
      try {
        this.store.set('stats', this.stats);
      } catch (error) {
        console.error('[Dictionary] Error saving stats to store:', error);
        // Continue without saving stats
      }
    } else {
      console.warn('[Dictionary] Store not initialized, stats not saved');
    }
    
    return stats;
  }

  // The autosave method is no longer needed with electron-store
  // as it automatically persists changes
}

// Export a factory function instead of a singleton
module.exports = () => new DictionaryService(); 