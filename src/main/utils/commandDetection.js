/**
 * Advanced command detection utility for identifying AI commands in transcribed text
 * with confidence scoring to minimize false positives.
 */
const LogManager = require('./LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('commandDetection');

/**
 * Determines if transcribed text contains an AI command with high confidence
 * @param {string} transcribedText - The raw transcribed text
 * @param {Array<string>} actionVerbs - List of configured action verbs
 * @param {boolean} actionVerbsEnabled - Whether action verb detection is enabled
 * @param {string} aiTriggerWord - The configured AI trigger word (e.g., "juno")
 * @param {Object} userContext - Context about user's recent actions
 * @returns {Object} Result with confidence score and detected command
 */
function detectAICommand(transcribedText, actionVerbs, actionVerbsEnabled, aiTriggerWord, userContext = {}) {
  // Default user context if not provided
  const context = {
    hasHighlightedText: userContext.hasHighlightedText || false,
    isLongDictation: userContext.isLongDictation || false,
    recentAICommands: userContext.recentAICommands || 0
  };

  // Normalize text for consistent processing
  const normalizedText = transcribedText.toLowerCase().trim();
  const words = normalizedText.split(/\s+/);
  
  // Initialize confidence score
  let confidenceScore = 0;
  let detectedVerb = null;
  let isAITriggerWordDetected = false;
  
  // Check for AI trigger word (e.g., "juno")
  const triggerWord = aiTriggerWord.toLowerCase();
  const greetings = ['hey', 'hi', 'hello', 'yo', 'ok', 'okay', 'um', 'uh'];
  
  // Check first word for trigger word
  if (words.length > 0 && words[0] === triggerWord) {
    isAITriggerWordDetected = true;
    confidenceScore = 100; // Guaranteed command with trigger word
  }
  // Check for greeting + trigger word pattern (e.g., "hey juno")
  else if (words.length > 1 && greetings.includes(words[0]) && words[1] === triggerWord) {
    isAITriggerWordDetected = true;
    confidenceScore = 100; // Guaranteed command with greeting + trigger word
  }
  // Check for greeting + greeting + trigger word pattern (e.g., "hey hey juno")
  else if (words.length > 2 && greetings.includes(words[0]) && greetings.includes(words[1]) && words[2] === triggerWord) {
    isAITriggerWordDetected = true;
    confidenceScore = 100; // Guaranteed command with double greeting + trigger word
  }
  
  // If trigger word detected or action verbs are disabled, we're done
  if (isAITriggerWordDetected || !actionVerbsEnabled) {
    return {
      isCommand: confidenceScore >= 60,
      needsConfirmation: confidenceScore >= 40 && confidenceScore < 60,
      confidenceScore,
      detectedVerb: null,
      isAITriggerWordDetected,
      commandText: isAITriggerWordDetected ? normalizedText : null
    };
  }
  
  // If we get here, we need to check for action verbs
  
  // Check for direct command patterns
  for (let i = 0; i < Math.min(3, words.length); i++) {
    if (actionVerbs.includes(words[i])) {
      detectedVerb = words[i];
      confidenceScore += 30; // Base score for finding an action verb
      
      // Check for deictic words following the verb
      if (i + 1 < words.length && ['this', 'that', 'these', 'the', 'my'].includes(words[i + 1])) {
        confidenceScore += 20; // Higher confidence with deictic words
      }
      
      break;
    }
  }
  
  // Check for question command patterns
  const questionStarters = ['can', 'could', 'will', 'would'];
  if (words.length >= 3 && questionStarters.includes(words[0]) && 
      (words[1] === 'you' || words[1] === 'i')) {
    for (let i = 2; i < Math.min(5, words.length); i++) {
      if (actionVerbs.includes(words[i])) {
        detectedVerb = words[i];
        confidenceScore += 40; // Higher score for question pattern
        
        // Check for deictic words
        if (i + 1 < words.length && ['this', 'that', 'these', 'the', 'my'].includes(words[i + 1])) {
          confidenceScore += 15;
        }
        
        break;
      }
    }
  }
  
  // Check for intent signifiers
  const intentPhrases = ['for me', 'i want', 'i need', 'help me'];
  for (const phrase of intentPhrases) {
    if (normalizedText.includes(phrase)) {
      confidenceScore += 15;
      break;
    }
  }
  
  // Consider user context
  if (context.hasHighlightedText) {
    confidenceScore += 20; // User has highlighted text, likely wants to do something with it
  }
  
  if (context.isLongDictation) {
    confidenceScore -= 25; // In the middle of long dictation, less likely to be a command
  }
  
  if (context.recentAICommands > 0) {
    confidenceScore += 10; // Recently used AI commands, more likely to use another
  }
  
  // Check for explicit markers
  if (normalizedText.startsWith('ai:') || normalizedText.startsWith('command:')) {
    confidenceScore = 100; // Guaranteed command
  }
  
  // Determine result based on confidence threshold
  const isCommand = confidenceScore >= 60; // Threshold for high confidence
  const needsConfirmation = confidenceScore >= 40 && confidenceScore < 60; // Threshold for confirmation
  
  return {
    isCommand,
    needsConfirmation,
    confidenceScore,
    detectedVerb,
    isAITriggerWordDetected,
    commandText: detectedVerb ? normalizedText : null
  };
}

/**
 * Logs detailed information about command detection for debugging
 * @param {Object} result - The result from detectAICommand
 * @param {string} transcribedText - The original transcribed text
 */
function logCommandDetection(result, transcribedText) {
  logger.debug('Command Detection Analysis', {
    metadata: {
      text: transcribedText,
      confidence: result.confidenceScore,
      isCommand: result.isCommand,
      needsConfirmation: result.needsConfirmation,
      triggerWordDetected: result.isAITriggerWordDetected,
      detectedVerb: result.detectedVerb || 'None'
    }
  });
}

module.exports = {
  detectAICommand,
  logCommandDetection
}; 