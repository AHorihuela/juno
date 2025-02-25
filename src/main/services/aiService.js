const BaseService = require('./BaseService');
const configService = require('./configService');
const notificationService = require('./notificationService');
const contextService = require('./contextService');

class AIService extends BaseService {
  constructor() {
    super('AI');
    this.currentRequest = null;
    this.openai = null;
  }

  async _initialize() {
    // Nothing to initialize yet
  }

  async _shutdown() {
    this.cancelCurrentRequest();
  }

  /**
   * Initialize the OpenAI client with the API key from config
   * @returns {Promise<Object>} The initialized OpenAI client
   * @throws {Error} If API key is not configured
   */
  async initializeOpenAI() {
    const OpenAI = require('openai');
    const apiKey = await this.getService('config').getOpenAIApiKey();
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    this.openai = new OpenAI({ apiKey });
    return this.openai;
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
    const triggerWord = await this.getService('config').getAITriggerWord() || 'juno';
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

    // Get action verbs from config
    const actionVerbs = await this.getService('config').getActionVerbs();
    const ACTION_VERBS = new Set(actionVerbs);

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
   * Process an AI command with GPT
   * @param {string} command - The user's command
   * @param {string} highlightedText - Currently highlighted text
   * @returns {Promise<Object>} Response object with text and metadata
   */
  async processCommand(command, highlightedText = '') {
    try {
      // Cancel any existing request
      this.cancelCurrentRequest();

      // Initialize OpenAI if not already initialized
      if (!this.openai) {
        await this.initializeOpenAI();
      }
      
      // Create AbortController for this request
      const controller = new AbortController();
      
      // Get context using the context service
      const context = this.getService('context').getContext(highlightedText);
      
      // Add diagnostic logging
      console.log('[AIService] Input text being summarized:', {
        command,
        highlightedText,
        contextObject: JSON.stringify(context, null, 2)
      });

      // Get AI rules
      const aiRules = await this.getService('config').getAIRules();
      console.log('[AIService] Retrieved AI rules:', aiRules);
      
      // Build a more structured system prompt with rules
      const systemPrompt = this.buildSystemPrompt(aiRules, context);
      console.log('[AIService] System prompt:', systemPrompt);

      // Create completion request
      const prompt = this.buildPrompt(command, context);
      console.log('[AIService] Full prompt being sent to GPT:', prompt);

      this.currentRequest = {
        controller,
        promise: this.openai.chat.completions.create({
          model: await this.getService('config').getAIModel() || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: await this.getService('config').getAITemperature() || 0.7,
        }, { signal: controller.signal })
      };

      // Wait for response
      const response = await this.currentRequest.promise;
      console.log('[AIService] Raw GPT response:', response.choices[0].message.content);
      
      this.currentRequest = null;

      // Clean the response text
      const cleanedText = this.cleanResponse(response.choices[0].message.content.trim());
      console.log('[AIService] Cleaned response text:', cleanedText);

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
            this.getService('notification').showAPIError(error);
            throw this.emitError(new Error('Invalid OpenAI API key'));
          case 429:
            this.getService('notification').showAPIError(error);
            throw this.emitError(new Error('OpenAI API rate limit exceeded'));
          default:
            this.getService('notification').showAIError(error);
            throw this.emitError(new Error(`AI processing failed: ${error.message}`));
        }
      }
      
      this.getService('notification').showAIError(error);
      throw this.emitError(new Error(`AI processing failed: ${error.message}`));
    }
  }

  /**
   * Build a structured system prompt with rules
   * @param {string[]} rules - Array of AI rules
   * @param {Object} context - Context object
   * @returns {string} The system prompt
   */
  buildSystemPrompt(rules, context) {
    const parts = [
      'You are a text processing tool that helps users with their writing and content.',
      'Output ONLY the processed text without any explanations, greetings, or commentary.',
      'Never say things like "here\'s the text" or "I can help". Just output the transformed text directly.'
    ];
    
    // Add application-specific guidance if available
    if (context.applicationContext && context.applicationContext.name) {
      const appName = context.applicationContext.name;
      
      // Add application-specific instructions
      if (appName === 'Cursor' || appName === 'Visual Studio Code' || appName === 'VSCodium') {
        parts.push('The user is currently in a code editor. Format your response appropriately for code if the context appears to be code.');
      } else if (appName === 'Microsoft Word' || appName === 'Pages' || appName === 'Google Docs') {
        parts.push('The user is currently in a document editor. Format your response with proper paragraphs and document structure.');
      } else if (appName === 'Mail' || appName === 'Outlook' || appName === 'Gmail') {
        parts.push('The user is currently in an email application. Format your response appropriately for email communication.');
      } else if (appName === 'Slack' || appName === 'Discord' || appName === 'Messages') {
        parts.push('The user is currently in a messaging application. Keep your response concise and conversational.');
      }
    }
    
    // Add user rules with structure
    if (rules && rules.length > 0) {
      parts.push('\nUser preferences:');
      rules.forEach(rule => {
        parts.push(`- ${rule}`);
      });
    }
    
    return parts.join('\n');
  }

  /**
   * Build the prompt for GPT based on command and context
   * @param {string} command - The user's command
   * @param {Object} context - Context object with primary and secondary contexts
   * @returns {string} The full prompt for GPT
   */
  buildPrompt(command, context) {
    const parts = [];
    
    // Add the command
    parts.push(command);

    // Add context with clear hierarchy
    if (context.primaryContext) {
      const label = context.primaryContext.type === 'highlight' ? 'Selected text' : 'Recent clipboard content';
      parts.push(`\n${label}:\n"""\n${context.primaryContext.content}\n"""`);
    }
    
    if (context.secondaryContext) {
      parts.push(`\nAdditional context:\n"""\n${context.secondaryContext.content}\n"""`);
    }
    
    // Add application context if available
    if (context.applicationContext && context.applicationContext.name) {
      parts.push(`\nCurrent application: ${context.applicationContext.name}`);
    }
    
    // Add history context if available
    if (context.historyContext && context.historyContext.length > 0) {
      // Skip items that are already included in primary or secondary context
      const primaryContent = context.primaryContext?.content || '';
      const secondaryContent = context.secondaryContext?.content || '';
      
      const relevantHistory = context.historyContext.filter(item => 
        item.content !== primaryContent && 
        item.content !== secondaryContent
      );
      
      if (relevantHistory.length > 0) {
        parts.push('\nRecent context:');
        
        relevantHistory.forEach((item, index) => {
          const historyLabel = item.type === 'highlight' ? 
            `Previously selected text (${this.formatTimestamp(item.timestamp)})` : 
            `Previous clipboard content (${this.formatTimestamp(item.timestamp)})`;
          
          // Use a more compact format for history items
          parts.push(`\n${historyLabel}:\n"""\n${item.content}\n"""`);
        });
      }
    }

    return parts.join('\n');
  }
  
  /**
   * Format a timestamp in a human-readable way
   * @param {number} timestamp - The timestamp to format
   * @returns {string} A human-readable representation of the timestamp
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return 'unknown time';
    
    const now = Date.now();
    const diffSeconds = Math.floor((now - timestamp) / 1000);
    
    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`;
    } else if (diffSeconds < 3600) {
      return `${Math.floor(diffSeconds / 60)} minutes ago`;
    } else if (diffSeconds < 86400) {
      return `${Math.floor(diffSeconds / 3600)} hours ago`;
    } else {
      return `${Math.floor(diffSeconds / 86400)} days ago`;
    }
  }

  /**
   * Build prompt text from context
   * @param {Object} context - Context object with primary and secondary context
   * @returns {string} Full prompt text
   */
  buildPromptText(context) {
    const parts = [];

    if (context.primaryContext) {
      parts.push(`Primary context:\n"""\n${context.primaryContext.content}\n"""`);
      if (context.secondaryContext) {
        parts.push(`\nAdditional context:\n"""\n${context.secondaryContext.content}\n"""`);
      }
    }
    
    // Add application context if available
    if (context.applicationContext && context.applicationContext.name) {
      parts.push(`\nCurrent application: ${context.applicationContext.name}`);
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
   * Cancel the current request if one exists
   */
  cancelCurrentRequest() {
    if (this.currentRequest) {
      console.log('[AIService] Cancelling current request');
      this.currentRequest.controller.abort();
      this.currentRequest = null;
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new AIService();