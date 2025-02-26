const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const BaseService = require('./BaseService');

class DictionaryService extends BaseService {
  constructor() {
    super('Dictionary');
    this.words = new Set();
    this.dictionaryPath = path.join(app.getPath('userData'), 'userDictionary.json');
    this.stats = {
      promptsGenerated: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedWords: 0,
      totalProcessed: 0
    };
  }

  async _initialize() {
    await this.initializeDictionary();
  }

  async _shutdown() {
    // Save dictionary on shutdown
    await this.saveDictionary();
  }

  async initializeDictionary() {
    console.log('Initializing dictionary at:', this.dictionaryPath);
    try {
      if (!fs.existsSync(this.dictionaryPath)) {
        console.log('Dictionary file does not exist, creating...');
        await fs.promises.writeFile(this.dictionaryPath, JSON.stringify([], null, 2), 'utf8');
      }
      await this.loadDictionary();
    } catch (error) {
      console.error('Error initializing dictionary:', error);
      // Create an empty dictionary if there's an error
      this.words = new Set();
      this.emitError(error);
    }
  }

  async loadDictionary() {
    console.log('Loading dictionary from:', this.dictionaryPath);
    try {
      const data = await fs.promises.readFile(this.dictionaryPath, 'utf8');
      const words = JSON.parse(data);
      this.words = new Set(words);
      console.log('Dictionary loaded successfully with', this.words.size, 'words');
    } catch (error) {
      console.error('Error loading dictionary:', error);
      this.words = new Set();
      this.emitError(error);
    }
  }

  async saveDictionary() {
    console.log('Saving dictionary...');
    try {
      const words = Array.from(this.words);
      await fs.promises.writeFile(this.dictionaryPath, JSON.stringify(words, null, 2), 'utf8');
      console.log('Dictionary saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving dictionary:', error);
      this.emitError(error);
      return false;
    }
  }

  async getAllWords() {
    return Array.from(this.words).sort();
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
    return this.saveDictionary();
  }

  async removeWord(word) {
    if (!word || typeof word !== 'string') {
      throw new Error('Invalid word');
    }

    console.log('Removing word from dictionary:', word);
    const result = this.words.delete(word);
    if (result) {
      return this.saveDictionary();
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
    
    // Modified prompt format to avoid confusion with transcription
    // Using a more directive format that won't be mistaken as content
    const prompt = `Transcribe the audio accurately. If any of these special terms appear: ${words.join(', ')}, transcribe them exactly as written.`;
    
    console.log('[Dictionary] Generated prompt with', words.length, 'words');
    console.log('[Dictionary] Prompt:', prompt);
    console.log('[Dictionary] Total prompts generated:', this.stats.promptsGenerated);
    
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
    
    console.log('\n[Dictionary] Output text:', result);
    return result;
  }

  getStats() {
    return {
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
  }
}

// Export a factory function instead of a singleton
module.exports = () => new DictionaryService(); 