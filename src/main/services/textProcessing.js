/**
 * Text processing utilities for cleaning up transcribed text
 */

const FILLER_WORDS = new Set([
  'uh', 'um', 'like', 'you know', 'er', 'ah', 'uhh', 'umm',
  'hmm', 'huh', 'eh', 'erm', 'well,', 'so,', 'right,',
]);

const SELF_CORRECTION_PATTERNS = [
  // Only match when there's a clear correction marker
  { pattern: /(\w+),?\s+(?:i mean|i meant|actually|rather)\s+(\w+.*)/i, replace: '$2' },
  { pattern: /(\w+),?\s+(?:make that|should be)\s+(\w+.*)/i, replace: '$2' },
  { pattern: /(?:wait|sorry|no|correction),?\s+(?:not|i meant)\s+(\w+.*)/i, replace: '$1' },
  // Only replace the exact corrected phrase
  { pattern: /(\w+)\s+or\s+(?:make that\s+)?(\w+)(?:\s|$)/i, replace: '$2' }
];

const TRANSITIONS = [
  'moving on',
  'furthermore',
  'however',
  'in addition',
  'on the other hand',
  'in conclusion'
];

function debugLog(functionName, input, output) {
  console.log(`[${functionName}] Input: "${input}"`);
  console.log(`[${functionName}] Output: "${output}"`);
}

/**
 * Add basic punctuation to text based on pauses and sentence structure
 * @param {string} text - Raw transcribed text
 * @returns {string} - Punctuated text
 */
function autoPunctuate(text) {
  if (!text) return '';
  
  let processed = text;
  
  // Add periods for clear sentence breaks
  processed = processed.replace(/([a-z])\s+([A-Z])/g, '$1. $2');
  
  // Add commas for natural pauses (indicated by multiple spaces in Whisper output)
  processed = processed.replace(/\s{2,}/g, ', ');
  
  // Add commas after transition words if not already present
  const transitionPattern = new RegExp(`\\b(${TRANSITIONS.join('|')})\\b(?![,.](?:\\s|$))`, 'gi');
  processed = processed.replace(transitionPattern, '$1,');
  
  // Ensure proper spacing after punctuation
  processed = processed.replace(/([.,!?])\s*/g, '$1 ');
  
  // Capitalize first letter of sentences
  processed = processed.replace(/(^|[.!?]\s+)([a-z])/g, (_, sep, letter) => sep + letter.toUpperCase());
  
  // Add final period if missing
  if (!/[.!?]$/.test(processed)) {
    processed += '.';
  }
  
  // Clean up any double commas or spaces
  processed = processed.replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
  
  debugLog('autoPunctuate', text, processed);
  return processed;
}

/**
 * Remove common filler words from the text
 * @param {string} text - Input text
 * @returns {string} - Text without filler words
 */
function filterFillerWords(text) {
  if (!text) return '';
  
  let processed = text;
  
  // Remove filler words with word boundaries
  FILLER_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b\\s*,?\\s*`, 'gi');
    processed = processed.replace(regex, '');
  });
  
  // Clean up any resulting double spaces and trailing/leading commas
  processed = processed.replace(/\s+/g, ' ')
    .replace(/^,\s*|\s*,\s*$/g, '')
    .replace(/\s*,\s*,\s*/g, ', ')
    .trim();
  
  debugLog('filterFillerWords', text, processed);
  return processed;
}

/**
 * Handle self-corrections in speech (e.g., "three, I mean four")
 * @param {string} text - Input text
 * @returns {string} - Corrected text
 */
function handleSelfCorrections(text) {
  if (!text) return '';
  
  let processed = text;
  let wasChanged = false;
  
  // Apply each correction pattern
  SELF_CORRECTION_PATTERNS.forEach(({ pattern, replace }) => {
    const newText = processed.replace(pattern, replace);
    if (newText !== processed) {
      wasChanged = true;
      processed = newText;
    }
  });
  
  // If no corrections were made, return the original text
  if (!wasChanged) {
    processed = text;
  }
  
  debugLog('handleSelfCorrections', text, processed);
  return processed.trim();
}

/**
 * Insert paragraph breaks based on transitions and sentence structure
 * @param {string} text - Input text
 * @returns {string} - Text with paragraph breaks
 */
function insertParagraphBreaks(text) {
  if (!text) return '';
  
  // First normalize any excessive newlines to double newlines
  let processed = text.replace(/\n{3,}/g, '\n\n');
  
  // Split into sentences while preserving existing paragraph breaks
  const sentences = [];
  let currentSentence = '';
  
  // Process each character to preserve newlines
  for (let i = 0; i < processed.length; i++) {
    const char = processed[i];
    if (char === '\n') {
      if (currentSentence) {
        sentences.push(currentSentence.trim());
        currentSentence = '';
      }
      sentences.push('\n');
    } else {
      currentSentence += char;
    }
  }
  if (currentSentence) {
    sentences.push(currentSentence.trim());
  }
  
  // Split remaining sentences by punctuation
  const finalSentences = [];
  sentences.forEach(sentence => {
    if (sentence === '\n') {
      finalSentences.push(sentence);
    } else {
      const parts = sentence.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s);
      finalSentences.push(...parts);
    }
  });
  
  const paragraphs = [];
  let currentParagraph = [];
  
  finalSentences.forEach((sentence, index) => {
    if (sentence === '\n') {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
      }
    } else {
      // Check if sentence contains a transition phrase
      const hasTransition = TRANSITIONS.some(phrase => 
        sentence.toLowerCase().includes(phrase.toLowerCase())
      );
      
      // Add comma after transition if needed
      if (hasTransition) {
        TRANSITIONS.forEach(phrase => {
          const regex = new RegExp(`(${phrase})(?![,.](?:\\s|$))`, 'i');
          sentence = sentence.replace(regex, '$1,');
        });
        
        // If we have sentences in the current paragraph, end it
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join(' '));
          currentParagraph = [];
        }
        // Add the transition sentence as its own paragraph
        paragraphs.push(sentence);
      } else if (currentParagraph.length >= 2 && index < finalSentences.length - 1) {
        // If we have 2+ sentences and not at the end, start a new paragraph
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [sentence];
      } else {
        // Otherwise, add to current paragraph
        currentParagraph.push(sentence);
      }
    }
  });
  
  // Add any remaining sentences
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }
  
  // Join paragraphs with double newlines
  const result = paragraphs.join('\n\n');
  debugLog('insertParagraphBreaks', text, result);
  return result;
}

/**
 * Apply all text processing functions in sequence
 * @param {string} text - Raw transcribed text
 * @returns {string} - Fully processed text
 */
function processText(text) {
  if (!text) return '';
  
  debugLog('processText - start', text, text);
  
  let processed = text;
  processed = filterFillerWords(processed);
  processed = handleSelfCorrections(processed);
  
  // Split into sentences and process each one
  const sentences = processed.split(/(?<=[.!?])\s+/);
  processed = sentences
    .map(sentence => {
      // Add commas after transitions if not already present
      const transitionPattern = new RegExp(`\\b(${TRANSITIONS.join('|')})\\b(?![,.](?:\\s|$))`, 'gi');
      return sentence.replace(transitionPattern, '$1,');
    })
    .join(' ');
  
  processed = autoPunctuate(processed);
  processed = insertParagraphBreaks(processed);
  
  debugLog('processText - final', text, processed);
  return processed;
}

module.exports = {
  autoPunctuate,
  filterFillerWords,
  handleSelfCorrections,
  insertParagraphBreaks,
  processText,
}; 