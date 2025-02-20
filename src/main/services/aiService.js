const OpenAI = require('openai');
const configService = require('./configService');
const notificationService = require('./notificationService');
const { clipboard } = require('electron');

// Action verbs that trigger AI processing
const ACTION_VERBS = new Set([
  'summarize',
  'explain',
  'analyze',
  'rewrite',
  'translate',
  'improve',
  'simplify',
  'elaborate',
  'fix',
  'check',
  'shorten',
  'expand',
  'clarify',
  'lengthen',
  'shorten',
]);

class AIService {
  constructor() {
    this.openai = null;
    this.currentRequest = null;
  }

  async initializeOpenAI() {
    try {
      const apiKey = await configService.getOpenAIApiKey();
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      this.openai = new OpenAI({ apiKey });
    } catch (error) {
      notificationService.showAPIError(error);
      throw error;
    }
  }

  /**
   * Check if the transcribed text is an AI command
   * @param {string} text - Transcribed text to check
   * @returns {Promise<boolean>} True if this is an AI command
   */
  async isAICommand(text) {
    if (!text) return false;

    console.log('[AIService] Checking if text is AI command:', text);

    // First normalize the text to check conditions
    const normalizedText = text.toLowerCase().trim();

    // Skip AI if explicitly requesting transcription
    if (normalizedText.startsWith('transcribe the following')) {
      console.log('[AIService] Skipping AI - explicit transcription request');
      return false;
    }

    // Split into words, preserving original structure but normalized for comparison
    const words = normalizedText.split(/\s+/);
    if (words.length === 0) return false;

    // Get trigger word from config
    const triggerWord = await configService.getAITriggerWord() || 'juno';
    console.log('[AIService] Trigger word:', triggerWord);

    // Check first 3 words for trigger word
    const firstThreeWords = words.slice(0, 3).map(w => w.replace(/[.,!?]$/, ''));
    console.log('[AIService] Checking first three words:', firstThreeWords);

    // Common greeting words that can precede the trigger word
    const GREETINGS = new Set(['hey', 'hi', 'hello', 'yo', 'ok', 'okay', 'um', 'uh']);

    // Check if trigger word appears in first 3 words with valid prefix
    for (let i = 0; i < firstThreeWords.length; i++) {
      if (firstThreeWords[i] === triggerWord.toLowerCase()) {
        // If not first word, check if previous words are greetings
        if (i === 0 || firstThreeWords.slice(0, i).every(w => GREETINGS.has(w))) {
          console.log('[AIService] Trigger word matched with valid prefix');
          return true;
        }
      }
    }

    // Check for action verbs in first two words (per spec)
    if (words.length >= 2) {
      const firstTwoWords = [
        words[0].replace(/[.,!?]$/, ''),
        words[1].replace(/[.,!?]$/, '')
      ];
      const hasActionVerb = ACTION_VERBS.has(firstTwoWords[0]) || ACTION_VERBS.has(firstTwoWords[1]);
      console.log('[AIService] Action verb check:', {
        firstWord: firstTwoWords[0],
        secondWord: firstTwoWords[1],
        hasActionVerb
      });
      return hasActionVerb;
    }

    console.log('[AIService] No AI command detected');
    return false;
  }

  /**
   * Get the current system context (clipboard + highlighted text)
   * @returns {Object} Context object with clipboard and highlight
   */
  async getContext() {
    return {
      clipboardText: clipboard.readText() || '',
      // Note: Highlighted text will be passed in from the main process
      highlightedText: '',
    };
  }

  /**
   * Process an AI command with GPT
   * @param {string} command - The user's command
   * @param {string} highlightedText - Currently highlighted text
   * @returns {Promise<Object>} Response object with text and metadata
   */
  async processCommand(command, highlightedText = '') {
    try {
      // Cancel any existing request
      this.cancelCurrentRequest();

      await this.initializeOpenAI();

      // Create AbortController for this request
      const controller = new AbortController();
      
      // Get context
      const context = await this.getContext();
      context.highlightedText = highlightedText;

      // Build the prompt
      const prompt = this.buildPrompt(command, context);

      // Create completion request
      this.currentRequest = {
        controller,
        promise: this.openai.chat.completions.create({
          model: await configService.getAIModel() || 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant integrated into a dictation tool. ' +
                       'Respond directly and concisely. Do not use any markdown formatting, ' +
                       'code blocks, or quotation marks around your responses. Provide your ' +
                       'response as plain text that can be directly inserted into the user\'s document.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: await configService.getAITemperature() || 0.7,
        }, { signal: controller.signal })
      };

      // Wait for response
      const response = await this.currentRequest.promise;
      this.currentRequest = null;

      // Clean the response text
      const cleanedText = this.cleanResponse(response.choices[0].message.content.trim());

      return {
        text: cleanedText,
        hasHighlight: Boolean(highlightedText),
        originalCommand: command,
      };

    } catch (error) {
      // Don't show notification for cancelled requests
      if (error.name === 'AbortError') {
        console.log('AI request cancelled');
        return null;
      }

      if (error.response) {
        const status = error.response.status;
        switch (status) {
          case 401:
            notificationService.showAPIError(error);
            throw new Error('Invalid OpenAI API key');
          case 429:
            notificationService.showAPIError(error);
            throw new Error('OpenAI API rate limit exceeded');
          default:
            notificationService.showAIError(error);
            throw new Error(`AI processing failed: ${error.message}`);
        }
      }
      
      notificationService.showAIError(error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Build the prompt for GPT based on command and context
   * @param {string} command - The user's command
   * @param {Object} context - Context object with clipboard/highlight
   * @returns {string} The full prompt for GPT
   */
  buildPrompt(command, context) {
    const parts = [];
    
    // Add the command
    parts.push(command);

    // Add highlighted text if present
    if (context.highlightedText) {
      parts.push('\nSelected text:\n"""\n' + context.highlightedText + '\n"""');
    }

    // Add clipboard content if present and different from highlight
    if (context.clipboardText && context.clipboardText !== context.highlightedText) {
      parts.push('\nClipboard content:\n"""\n' + context.clipboardText + '\n"""');
    }

    return parts.join('\n');
  }

  /**
   * Clean response text by removing markdown and unwanted formatting
   * @param {string} text - Raw response text
   * @returns {string} Cleaned text
   */
  cleanResponse(text) {
    return text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove quotes
      .replace(/^["']|["']$/g, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Cancel any ongoing AI request
   */
  cancelCurrentRequest() {
    if (this.currentRequest && this.currentRequest.controller) {
      console.log('Cancelling current AI request');
      this.currentRequest.controller.abort();
      this.currentRequest = null;
    }
  }
}

module.exports = new AIService(); 