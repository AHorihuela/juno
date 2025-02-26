/**
 * Handles statistics collection and reporting for the dictionary service
 */
class StatisticsCollector {
  constructor() {
    this.LOG_PREFIX = '[DictionaryStats]';
    this.stats = {
      promptsGenerated: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedWords: 0,
      totalProcessed: 0
    };
  }

  // Helper methods for logging
  _log(message) {
    console.log(`${this.LOG_PREFIX} ${message}`);
  }

  _logError(message, error) {
    console.error(`${this.LOG_PREFIX} ${message}`, error);
  }

  /**
   * Initialize statistics from stored data
   * @param {Object} storedStats - Statistics loaded from storage
   */
  initializeStats(storedStats) {
    if (storedStats && typeof storedStats === 'object') {
      this.stats = {
        ...this.stats,
        ...storedStats
      };
      this._log('Statistics initialized from storage');
    } else {
      this._log('No stored statistics found, using defaults');
    }
  }

  /**
   * Get current statistics
   * @returns {Object} - Current statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get formatted statistics with effectiveness metrics
   * @param {number} dictionarySize - Size of the dictionary
   * @returns {Object} - Formatted statistics
   */
  getFormattedStats(dictionarySize) {
    const stats = {
      ...this.stats,
      dictionarySize,
      effectiveness: {
        exactMatchRate: this._calculatePercentage(this.stats.exactMatches, this.stats.totalProcessed),
        fuzzyMatchRate: this._calculatePercentage(this.stats.fuzzyMatches, this.stats.totalProcessed),
        unmatchedRate: this._calculatePercentage(this.stats.unmatchedWords, this.stats.totalProcessed)
      }
    };
    
    return stats;
  }

  /**
   * Calculate percentage with formatting
   * @param {number} value - The numerator
   * @param {number} total - The denominator
   * @returns {string} - Formatted percentage
   */
  _calculatePercentage(value, total) {
    if (total <= 0) return '0%';
    return (value / total * 100).toFixed(2) + '%';
  }

  /**
   * Increment prompt generation count
   */
  incrementPromptGenerated() {
    this.stats.promptsGenerated++;
    this._log(`Total prompts generated: ${this.stats.promptsGenerated}`);
  }

  /**
   * Log statistics summary
   */
  logStatsSummary() {
    this._log('\nDictionary Statistics Summary:');
    this._log(`  - Total prompts generated: ${this.stats.promptsGenerated}`);
    this._log(`  - Total words processed: ${this.stats.totalProcessed}`);
    this._log(`  - Exact matches: ${this.stats.exactMatches} (${this._calculatePercentage(this.stats.exactMatches, this.stats.totalProcessed)})`);
    this._log(`  - Fuzzy matches: ${this.stats.fuzzyMatches} (${this._calculatePercentage(this.stats.fuzzyMatches, this.stats.totalProcessed)})`);
    this._log(`  - Unmatched words: ${this.stats.unmatchedWords} (${this._calculatePercentage(this.stats.unmatchedWords, this.stats.totalProcessed)})`);
  }
}

module.exports = StatisticsCollector; 