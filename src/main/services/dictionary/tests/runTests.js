/**
 * Simple test runner for the DictionaryService
 * This script can be run directly with Node.js
 */
const TextProcessor = require('../TextProcessor');
const StatisticsCollector = require('../StatisticsCollector');

// Create test instances
const textProcessor = new TextProcessor();
const statsCollector = new StatisticsCollector();

// Test dictionary
const dictionary = new Set(['apple', 'banana', 'orange']);

// Test statistics
const stats = {
  promptsGenerated: 0,
  exactMatches: 0,
  fuzzyMatches: 0,
  unmatchedWords: 0,
  totalProcessed: 0
};

// Test text processing
console.log('\n=== Testing Text Processing ===');
const testText = 'I like apple and banan and grape';
console.log(`Input text: "${testText}"`);

const { result, runStats } = textProcessor.processText(
  testText,
  dictionary,
  stats,
  { enableFuzzyMatching: true, enableDetailedLogging: true }
);

console.log(`\nOutput text: "${result}"`);
console.log('\nRun Statistics:');
console.log(`- Exact matches: ${runStats.exactMatches}`);
console.log(`- Fuzzy matches: ${runStats.fuzzyMatches}`);
console.log(`- Unmatched words: ${runStats.unmatchedWords}`);
console.log(`- Total words: ${runStats.totalWords}`);

// Test statistics collector
console.log('\n=== Testing Statistics Collector ===');
statsCollector.initializeStats(stats);
statsCollector.incrementPromptGenerated();

console.log('\nFormatted Statistics:');
const formattedStats = statsCollector.getFormattedStats(dictionary.size);
console.log(JSON.stringify(formattedStats, null, 2));

console.log('\nAll tests completed successfully!');

// Export test functions for use in other tests
module.exports = {
  runTextProcessingTest: (text, dictionary, options = {}) => {
    const stats = {
      promptsGenerated: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      unmatchedWords: 0,
      totalProcessed: 0
    };
    
    const processor = new TextProcessor();
    return processor.processText(text, dictionary, stats, options);
  },
  
  runStatisticsTest: (initialStats, dictionarySize) => {
    const collector = new StatisticsCollector();
    collector.initializeStats(initialStats || {});
    return collector.getFormattedStats(dictionarySize || 0);
  }
}; 