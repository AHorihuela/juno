/**
 * AICommandDetector - Detects if text is an AI command
 * 
 * This class handles the logic for determining if a piece of text
 * should be treated as an AI command based on trigger words and action verbs.
 */

class AICommandDetector {
  constructor() {
    // Common greeting words that can precede the trigger word
    this.GREETINGS = new Set(['hey', 'hi', 'hello', 'yo', 'ok', 'okay', 'um', 'uh']);
    
    // Default action verbs if none provided
    this.DEFAULT_ACTION_VERBS = new Set(['summarize', 'rewrite', 'translate', 'explain', 'analyze']);
  }

  /**
   * Check if the text is an AI command
   * @param {string} text - Text to check
   * @param {string} triggerWord - The configured trigger word
   * @param {string[]} actionVerbs - List of action verbs that indicate commands
   * @returns {boolean} True if this is an AI command
   */
  isCommand(text, triggerWord, actionVerbs) {
    if (!text) return false;

    // First normalize the text to check conditions
    const normalizedText = text.toLowerCase().trim();
    console.log('[AICommandDetector] Checking text:', normalizedText);

    // Skip AI if explicitly requesting transcription
    if (normalizedText.startsWith('transcribe the following')) {
      console.log('[AICommandDetector] Skipping AI - explicit transcription request');
      return false;
    }

    // Split into words, preserving original structure but normalized for comparison
    const words = normalizedText.split(/\s+/);
    if (words.length === 0) return false;

    console.log('[AICommandDetector] Trigger word:', triggerWord);

    // Check for trigger word in the first THREE words (accounting for greetings)
    const firstThreeWords = words.slice(0, 3).map(w => w.replace(/[.,!?;:]$/, ''));
    console.log('[AICommandDetector] Checking first three words:', firstThreeWords, 'against trigger word:', triggerWord.toLowerCase());

    // Check if the trigger word appears in the first three words
    for (let i = 0; i < firstThreeWords.length; i++) {
      if (firstThreeWords[i] === triggerWord.toLowerCase()) {
        // If not first word, check if previous words are greetings or common pronouns
        if (i === 0 || firstThreeWords.slice(0, i).every(w => this.GREETINGS.has(w) || ['can', 'please', 'would', 'could', 'will', 'should'].includes(w))) {
          console.log('[AICommandDetector] Trigger word matched within first three words');
          return true;
        }
      }
    }

    // Convert action verbs to a Set for faster lookups
    // Use provided action verbs if available, otherwise fall back to defaults
    const ACTION_VERBS = new Set(
      actionVerbs && actionVerbs.length > 0 
        ? actionVerbs.map(verb => verb.toLowerCase()) 
        : this.DEFAULT_ACTION_VERBS
    );
    
    console.log('[AICommandDetector] Using action verbs:', 
      Array.from(ACTION_VERBS).join(', '), 
      'from provided list:', 
      actionVerbs ? actionVerbs.join(', ') : 'none'
    );

    // Check for action verbs in first TWO words
    const firstTwoWords = words.slice(0, 2).map(w => w.replace(/[.,!?;:]$/, '').toLowerCase());
    console.log('[AICommandDetector] Checking first two words for action verbs:', firstTwoWords);
    
    // Direct check of first two words against action verbs
    for (let i = 0; i < firstTwoWords.length; i++) {
      if (ACTION_VERBS.has(firstTwoWords[i])) {
        console.log('[AICommandDetector] Action verb found in position', i, ':', firstTwoWords[i]);
        return true;
      }
    }
    
    // Check for common phrase patterns with action verbs
    const commandPart = words.slice(0, Math.min(4, words.length)).join(' ').toLowerCase();
    console.log('[AICommandDetector] Command part:', commandPart);
    
    // Check for patterns like "please summarize", "can you analyze", etc.
    const commonPhrasePatterns = [
      'please', 'can you', 'would you', 'could you', 'i need', 'i want', 'help me'
    ];
    
    // Check if any action verb is in the command part with common phrases
    for (const verb of ACTION_VERBS) {
      for (const phrase of commonPhrasePatterns) {
        if (commandPart.includes(`${phrase} ${verb}`)) {
          console.log('[AICommandDetector] Action verb found with common phrase:', `${phrase} ${verb}`);
          return true;
        }
      }
    }

    console.log('[AICommandDetector] No AI command detected');
    return false;
  }
}

module.exports = AICommandDetector; 