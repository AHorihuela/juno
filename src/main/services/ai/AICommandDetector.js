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

    // Skip AI if explicitly requesting transcription
    if (normalizedText.startsWith('transcribe the following')) {
      console.log('[AICommandDetector] Skipping AI - explicit transcription request');
      return false;
    }

    // Split into words, preserving original structure but normalized for comparison
    const words = normalizedText.split(/\s+/);
    if (words.length === 0) return false;

    console.log('[AICommandDetector] Trigger word:', triggerWord);

    // Check first 3 words for trigger word
    const firstThreeWords = words.slice(0, 3).map(w => w.replace(/[.,!?]$/, ''));
    console.log('[AICommandDetector] Checking first three words:', firstThreeWords, 'against trigger word:', triggerWord.toLowerCase());

    // Check if trigger word appears in first 3 words with valid prefix
    for (let i = 0; i < firstThreeWords.length; i++) {
      if (firstThreeWords[i] === triggerWord.toLowerCase()) {
        // If not first word, check if previous words are greetings
        if (i === 0 || firstThreeWords.slice(0, i).every(w => this.GREETINGS.has(w))) {
          console.log('[AICommandDetector] Trigger word matched with valid prefix');
          return true;
        }
      }
    }

    // Convert action verbs to a Set for faster lookups
    const ACTION_VERBS = new Set(actionVerbs);

    // Check for action verbs in first two words (per spec)
    if (words.length >= 2) {
      const firstTwoWords = [
        words[0].replace(/[.,!?]$/, ''),
        words[1].replace(/[.,!?]$/, '')
      ];
      const hasActionVerb = ACTION_VERBS.has(firstTwoWords[0]) || ACTION_VERBS.has(firstTwoWords[1]);
      console.log('[AICommandDetector] Action verb check:', {
        firstWord: firstTwoWords[0],
        secondWord: firstTwoWords[1],
        hasActionVerb
      });
      return hasActionVerb;
    }

    console.log('[AICommandDetector] No AI command detected');
    return false;
  }
}

module.exports = AICommandDetector; 