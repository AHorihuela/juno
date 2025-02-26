/**
 * Handles text processing and fuzzy matching for the dictionary service
 */
class TextProcessor {
  constructor(parentService) {
    this.parentService = parentService;
    this.LOG_PREFIX = '[DictionaryTextProcessor]';
  }

  // Helper methods for logging
  _log(message) {
    console.log(`${this.LOG_PREFIX} ${message}`);
  }

  _logError(message, error) {
    console.error(`${this.LOG_PREFIX} ${message}`, error);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - The Levenshtein distance
   */
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

  /**
   * Find the closest matching word in the dictionary
   * @param {string} word - The word to find a match for
   * @param {Set} dictionary - The dictionary to search in
   * @returns {string|null} - The closest matching word or null if no match found
   */
  findClosestMatch(word, dictionary) {
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const dictWord of dictionary) {
      const distance = this.fuzzyMatch(word, dictWord);
      if (distance < bestDistance && distance <= Math.min(word.length / 3, 3)) {
        bestDistance = distance;
        bestMatch = dictWord;
      }
    }
    
    return bestMatch;
  }

  /**
   * Process a single word using the dictionary
   * @param {string} word - The word to process
   * @param {Set} dictionary - The dictionary to use
   * @param {Object} runStats - Statistics object to update
   * @param {Object} globalStats - Global statistics object to update
   * @param {Object} options - Processing options
   * @returns {string} - The processed word
   */
  processWord(word, dictionary, runStats, globalStats, options) {
    // If it's not a word (punctuation/space), preserve it
    if (!/^\w+\b/.test(word)) {
      return word;
    }

    runStats.totalWords++;
    globalStats.totalProcessed++;
    
    // Check for exact match first
    if (dictionary.has(word)) {
      this._log(`✓ Exact match found for "${word}"`);
      runStats.exactMatches++;
      globalStats.exactMatches++;
      return word;
    }

    // Try fuzzy matching for potential corrections if enabled
    if (options.enableFuzzyMatching) {
      const closestMatch = this.findClosestMatch(word, dictionary);
      if (closestMatch) {
        this._log(`~ Fuzzy match: "${word}" -> "${closestMatch}"`);
        runStats.fuzzyMatches++;
        globalStats.fuzzyMatches++;
        runStats.replacements.push({ original: word, replacement: closestMatch });
        return closestMatch;
      }
    }

    this._log(`× No match for "${word}"`);
    runStats.unmatchedWords++;
    globalStats.unmatchedWords++;
    return word;
  }

  /**
   * Process transcribed text using the dictionary with detailed logging and statistics
   * 
   * @param {string} text - The text to process
   * @param {Set} dictionary - The dictionary to use
   * @param {Object} globalStats - Global statistics object to update
   * @param {Object} options - Processing options
   * @returns {Object} - The processed text and run statistics
   */
  processText(text, dictionary, globalStats, options = {}) {
    this._log('\nStarting text processing...');
    this._log(`Input text: ${text}`);
    if (!text) return { result: '', runStats: null };

    const settings = {
      enableFuzzyMatching: true,
      enableDetailedLogging: true,
      ...options
    };

    // Reset word-level stats for this processing run
    const runStats = {
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedWords: 0,
      totalWords: 0,
      replacements: []
    };

    // If detailed logging is disabled, temporarily store the console.log function
    let originalConsoleLog = null;
    if (!settings.enableDetailedLogging) {
      originalConsoleLog = console.log;
      console.log = () => {}; // No-op function
    }

    try {
      // Split text into words while preserving punctuation and spacing
      const words = text.split(/(\b\w+\b)/);
      
      // Process each word
      const processed = words.map(part => 
        this.processWord(part, dictionary, runStats, globalStats, settings)
      );

      const result = processed.join('');
      
      // Log detailed statistics if enabled
      if (settings.enableDetailedLogging) {
        this._logProcessingStats(runStats, globalStats, result);
      }
      
      return { result, runStats };
    } finally {
      // Restore console.log if it was replaced
      if (originalConsoleLog) {
        console.log = originalConsoleLog;
      }
    }
  }

  /**
   * Log processing statistics
   * @param {Object} runStats - Statistics for the current processing run
   * @param {Object} globalStats - Global statistics
   * @param {string} result - The processed text
   */
  _logProcessingStats(runStats, globalStats, result) {
    // Log detailed statistics for this processing run
    this._log('\nProcessing complete:');
    this._log(`  - Total words processed: ${runStats.totalWords}`);
    this._log(`  - Exact matches: ${runStats.exactMatches}`);
    this._log(`  - Fuzzy matches: ${runStats.fuzzyMatches}`);
    this._log(`  - Unmatched words: ${runStats.unmatchedWords}`);
    
    if (runStats.replacements.length > 0) {
      this._log('\nReplacements made:');
      runStats.replacements.forEach(({ original, replacement }) => {
        this._log(`  "${original}" → "${replacement}"`);
      });
    }

    // Log cumulative statistics
    this._log('\nCumulative statistics:');
    this._log(`  - Total prompts generated: ${globalStats.promptsGenerated}`);
    this._log(`  - Total exact matches: ${globalStats.exactMatches}`);
    this._log(`  - Total fuzzy matches: ${globalStats.fuzzyMatches}`);
    this._log(`  - Total unmatched words: ${globalStats.unmatchedWords}`);
    
    this._log(`\nOutput text: ${result}`);
  }
}

module.exports = TextProcessor; 