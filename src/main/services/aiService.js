const OpenAI = require('openai');
const configService = require('./configService');
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
]);

class AIService {
  constructor() {
    this.openai = null;
    this.currentRequest = null;
  }

  async initializeOpenAI() {
    if (this.openai) return;
    
    const apiKey = await configService.getOpenAIApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Check if the transcribed text is an AI command
   * @param {string} text - Transcribed text to check
   * @returns {Promise<boolean>} True if this is an AI command
   */
  async isAICommand(text) {
    if (!text) return false;

    // Skip AI if explicitly requesting transcription
    if (text.toLowerCase().startsWith('transcribe the following')) {
      return false;
    }

    const words = text.toLowerCase().trim().split(/\s+/);
    if (words.length === 0) return false;

    // Check for trigger word
    const triggerWord = await configService.getAITriggerWord() || 'juno';
    if (words[0] === triggerWord.toLowerCase()) {
      return true;
    }

    // Check for action verbs in first two words
    if (words.length >= 2) {
      return ACTION_VERBS.has(words[0]) || ACTION_VERBS.has(words[1]);
    }

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
      await this.initializeOpenAI();

      // Get context
      const context = await this.getContext();
      context.highlightedText = highlightedText;

      // Build the prompt
      const prompt = this.buildPrompt(command, context);

      // Create completion request
      this.currentRequest = this.openai.chat.completions.create({
        model: await configService.getAIModel() || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant integrated into a dictation tool. ' +
                     'Respond directly and concisely. Format output in markdown when appropriate.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: await configService.getAITemperature() || 0.7,
      });

      // Wait for response
      const response = await this.currentRequest;
      this.currentRequest = null;

      return {
        text: response.choices[0].message.content.trim(),
        hasHighlight: Boolean(highlightedText),
        originalCommand: command,
      };

    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        switch (status) {
          case 401:
            throw new Error('Invalid OpenAI API key');
          case 429:
            throw new Error('OpenAI API rate limit exceeded');
          default:
            throw new Error(`AI processing failed: ${error.message}`);
        }
      }
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
   * Cancel any ongoing AI request
   */
  cancelCurrentRequest() {
    if (this.currentRequest && typeof this.currentRequest.abort === 'function') {
      this.currentRequest.abort();
    }
    this.currentRequest = null;
  }
}

module.exports = new AIService(); 