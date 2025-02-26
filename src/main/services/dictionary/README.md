# Dictionary Service

A modular service for managing a user dictionary and processing text using the dictionary.

## Overview

The Dictionary Service provides functionality for:

- Managing a user dictionary (adding/removing words)
- Processing text using the dictionary (exact and fuzzy matching)
- Generating prompts for Whisper speech recognition
- Collecting and reporting statistics

## Architecture

The service has been modularized for better maintainability and testability:

```
dictionary/
├── index.js                  # Main entry point
├── constants.js              # Shared constants
├── DictionaryStorageManager.js  # Storage operations
├── TextProcessor.js          # Text processing and fuzzy matching
├── StatisticsCollector.js    # Statistics collection and reporting
├── tests/                    # Test suite
│   ├── DictionaryService.test.js  # Comprehensive tests
│   ├── runTests.js           # Simple test runner
│   └── fixtures/             # Test fixtures
│       ├── testDictionary.json  # Sample dictionary
│       └── testTexts.json    # Sample texts
└── README.md                 # This file
```

## Modules

### DictionaryService (index.js)

The main service that coordinates the other modules and implements the public API.

### DictionaryStorageManager

Handles all storage operations, including:
- Initializing the store
- Loading and saving words
- Loading and saving statistics
- Error recovery

### TextProcessor

Handles text processing and fuzzy matching, including:
- Processing text using the dictionary
- Fuzzy matching using Levenshtein distance
- Collecting processing statistics

### StatisticsCollector

Handles statistics collection and reporting, including:
- Tracking dictionary usage statistics
- Calculating effectiveness metrics
- Formatting statistics for reporting

## Usage

```javascript
const dictionaryService = require('./services/dictionary')();

// Add a word to the dictionary
await dictionaryService.addWord('apple');

// Process text using the dictionary
const processedText = dictionaryService.processText('I like aple', {
  enableFuzzyMatching: true
});
// Result: "I like apple"

// Generate a prompt for Whisper speech recognition
const prompt = await dictionaryService.generateWhisperPrompt();

// Get dictionary statistics
const stats = dictionaryService.getStats();
```

## Testing

The service includes a comprehensive test suite:

```bash
# Run the simple test runner
node tests/runTests.js

# Run the comprehensive tests (requires Jest)
jest DictionaryService.test.js
``` 