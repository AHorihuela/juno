/**
 * Constants used by the Dictionary Service modules
 */

// Service identification
const SERVICE_NAME = 'Dictionary';
const STORE_NAME = 'dictionary';
const LOG_PREFIX = '[Dictionary]';

// Common phrases used in whisper prompts
const COMMON_PHRASES = [
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

// Default statistics object
const DEFAULT_STATS = {
  promptsGenerated: 0,
  exactMatches: 0,
  fuzzyMatches: 0,
  unmatchedWords: 0,
  totalProcessed: 0
};

module.exports = {
  SERVICE_NAME,
  STORE_NAME,
  LOG_PREFIX,
  COMMON_PHRASES,
  DEFAULT_STATS
}; 