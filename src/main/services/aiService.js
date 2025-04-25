const BaseService = require('./BaseService');
const configService = require('./configService');
const notificationService = require('./notificationService');
const contextService = require('./contextService');

// Import the modular components
const AICommandDetector = require('./ai/AICommandDetector');
const AIPromptBuilder = require('./ai/AIPromptBuilder');
const AIContextManager = require('./ai/AIContextManager');
const AIStatsTracker = require('./ai/AIStatsTracker');
const AIResponseFormatter = require('./ai/AIResponseFormatter');

class AIService extends BaseService {
  constructor() {
    super('AI');
    this.currentRequest = null;
    this.openai = null;
    
    // Initialize modular components
    this.commandDetector = new AICommandDetector();
    this.promptBuilder = new AIPromptBuilder();
    this.contextManager = new AIContextManager();
    this.statsTracker = new AIStatsTracker();
    this.responseFormatter = new AIResponseFormatter();
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
    
    // Get configuration values needed for command detection
    const triggerWord = await this.getService('config').getAITriggerWord() || 'juno';
    const actionVerbs = await this.getService('config').getActionVerbs() || [];
    
    // Log for debugging
    console.log('[AIService] Using trigger word:', triggerWord);
    console.log('[AIService] Using action verbs:', actionVerbs);
    
    // Delegate to the command detector component
    return this.commandDetector.isCommand(text, triggerWord, actionVerbs);
  }

  /**
   * Process an AI command with GPT
   * @param {string} command - The user's command
   * @param {string} highlightedText - Currently highlighted text
   * @returns {Promise<Object>} Response object with text and metadata
   */
  async processCommand(command, highlightedText = '') {
    try {
      // Start timing the request
      this.statsTracker.startRequest();
      
      // Cancel any existing request
      this.cancelCurrentRequest();

      // Initialize OpenAI if not already initialized
      if (!this.openai) {
        await this.initializeOpenAI();
      }
      
      // Create AbortController for this request
      const controller = new AbortController();
      
      // Ensure we have the highlighted text if it wasn't passed
      if (!highlightedText) {
        try {
          const selectionService = this.getService('selection');
          highlightedText = await selectionService.getSelectedText();
          console.log('[AIService] Retrieved highlighted text:', 
            highlightedText ? `${highlightedText.substring(0, 50)}... (${highlightedText.length} chars)` : 'none');
        } catch (error) {
          console.error('[AIService] Error getting highlighted text:', error);
          // Continue without highlighted text
        }
      }
      
      // Get context using the context service with the command for intelligent context selection
      const context = await this.getService('context').getContextAsync(highlightedText, command);
      
      // Track context usage for feedback
      this.contextManager.updateContextUsage(context, highlightedText);
      
      // Show user feedback about context being used
      this.showContextFeedback();
      
      // Add diagnostic logging
      console.log('[AIService] Input being processed:', {
        command,
        highlightedTextLength: highlightedText ? highlightedText.length : 0,
        highlightedTextPreview: highlightedText ? highlightedText.substring(0, 100) + '...' : 'none',
        hasContext: Boolean(context)
      });

      // Get AI rules
      const aiRules = await this.getService('config').getAIRules();
      console.log('[AIService] Retrieved AI rules:', aiRules);
      
      // Build a more structured system prompt with rules
      const systemPrompt = this.promptBuilder.buildSystemPrompt(aiRules, context);
      
      // Build the user prompt based on command and highlighted text
      let userPrompt;
      if (highlightedText) {
        // Create a prompt that clearly includes both the command and the highlighted text
        userPrompt = `${command}\n\nHIGHLIGHTED TEXT:\n"""${highlightedText}"""`;
      } else {
        // Just use the command as the prompt
        userPrompt = command;
      }
      
      console.log('[AIService] Sending prompt to GPT:', {
        hasHighlightedText: Boolean(highlightedText),
        highlightedTextLength: highlightedText ? highlightedText.length : 0,
        command,
        promptPreview: userPrompt.substring(0, 100) + (userPrompt.length > 100 ? '...' : '')
      });

      // Get model and temperature settings from config
      const model = await this.getService('config').getAIModel() || 'gpt-4';
      const temperature = await this.getService('config').getAITemperature() || 0.7;
      
      console.log('[AIService] Using model:', model, 'with temperature:', temperature);

      this.currentRequest = {
        controller,
        promise: this.openai.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: temperature,
        }, { signal: controller.signal })
      };

      // Wait for response
      const response = await this.currentRequest.promise;
      console.log('[AIService] Raw GPT response:', response.choices[0].message.content);
      
      this.currentRequest = null;

      // Clean the response text
      const cleanedText = this.responseFormatter.cleanResponse(response.choices[0].message.content.trim());
      console.log('[AIService] Cleaned response text:', cleanedText);
      
      // Check if the response is too similar to the highlighted text
      // This indicates the model might be confused and just echoing back the context
      if (highlightedText && cleanedText.length > 0) {
        const isTooSimilar = this._isResponseTooSimilarToHighlight(cleanedText, highlightedText);
        if (isTooSimilar) {
          console.log('[AIService] Response too similar to highlighted text, retrying with clearer prompt');
          
          // Retry with a clearer prompt that explicitly tells the model not to echo back the highlighted text
          const retryPrompt = `${command}\n\nHIGHLIGHTED TEXT:\n"""${highlightedText}"""\n\nIMPORTANT: Do NOT repeat back the highlighted text. Instead, respond directly to the command above.`;
          
          const retryResponse = await this.openai.chat.completions.create({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: retryPrompt }
            ],
            temperature: temperature,
          });
          
          // Use the retry response instead
          const retryCleanedText = this.responseFormatter.cleanResponse(retryResponse.choices[0].message.content.trim());
          console.log('[AIService] Retry response text:', retryCleanedText);
          
          // Update stats for successful request
          this.statsTracker.recordSuccessfulRequest();
          
          return {
            text: retryCleanedText,
            hasHighlight: Boolean(highlightedText),
            originalCommand: command,
            contextUsed: this.contextManager.getContextUsageSummary(),
            responseTime: this.statsTracker.getLastResponseTime()
          };
        }
      }
      
      // Update stats for successful request
      this.statsTracker.recordSuccessfulRequest();
      
      // Provide feedback on context usefulness if we have memory manager
      this.contextManager.updateContextUsefulness(context, true);

      // Return the processed response
      return {
        text: cleanedText,
        hasHighlight: Boolean(highlightedText),
        originalCommand: command,
        contextUsed: this.contextManager.getContextUsageSummary(),
        responseTime: this.statsTracker.getLastResponseTime()
      };
    } catch (error) {
      // Update stats for failed request
      this.statsTracker.recordFailedRequest();
      
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
   * Show feedback to the user about context being used
   * @private
   */
  showContextFeedback() {
    const contextUsage = this.contextManager.getLastContextUsage();
    
    // Only show feedback if we have context
    if (contextUsage.contextSize > 0) {
      const contextTypes = [];
      
      if (contextUsage.hasHighlightedText) {
        contextTypes.push('highlighted text');
      }
      
      if (contextUsage.hasClipboardContent) {
        contextTypes.push('clipboard content');
      }
      
      if (contextUsage.historyItemCount > 0) {
        contextTypes.push('context history');
      }
      
      // Add memory tiers if available
      if (contextUsage.memoryTiersUsed && contextUsage.memoryTiersUsed.length > 0) {
        const tiersText = contextUsage.memoryTiersUsed
          .map(tier => {
            switch(tier) {
              case 'working': return 'recent memory';
              case 'short-term': return 'session memory';
              case 'long-term': return 'long-term memory';
              default: return tier;
            }
          })
          .join(', ');
        
        contextTypes.push(tiersText);
      }
      
      const contextTypeText = contextTypes.length > 0 
        ? contextTypes.join(', ') 
        : 'available context';
      
      const appText = contextUsage.applicationName 
        ? ` in ${contextUsage.applicationName}` 
        : '';
      
      // Add relevance information if available
      let relevanceText = '';
      if (contextUsage.relevanceScores && contextUsage.relevanceScores.length > 0) {
        const avgScore = contextUsage.relevanceScores.reduce(
          (sum, item) => sum + item.score, 0
        ) / contextUsage.relevanceScores.length;
        
        if (avgScore > 80) {
          relevanceText = ' (high relevance)';
        } else if (avgScore > 50) {
          relevanceText = ' (medium relevance)';
        } else {
          relevanceText = ' (low relevance)';
        }
      }
      
      this.getService('notification').showNotification({
        title: 'Processing AI Command',
        body: `Using ${contextTypeText}${appText} (${this.contextManager.formatContextSize(contextUsage.contextSize)})${relevanceText}`,
        type: 'info',
        timeout: 3000
      });
    }
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
  
  /**
   * Get detailed statistics about AI usage
   * @returns {Object} AI usage statistics
   */
  getAIUsageStats() {
    return {
      lastContextUsage: this.contextManager.getLastContextUsage(),
      formattedContextSize: this.contextManager.formatContextSize(this.contextManager.getLastContextUsage().contextSize),
      timestamp: Date.now(),
      stats: this.statsTracker.getStats(),
      formattedResponseTime: this.statsTracker.formatResponseTime(this.statsTracker.getLastResponseTime()),
      formattedAverageResponseTime: this.statsTracker.formatResponseTime(this.statsTracker.getAverageResponseTime())
    };
  }

  /**
   * Check if the response is too similar to the highlighted text
   * @param {string} response - The AI response
   * @param {string} highlightedText - The highlighted text
   * @returns {boolean} True if the response is too similar to the highlighted text
   * @private
   */
  _isResponseTooSimilarToHighlight(response, highlightedText) {
    // Simple check: if the response contains a significant portion of the highlighted text
    if (highlightedText.length > 100) {
      // For longer highlighted text, check if a significant portion appears in the response
      const normalizedResponse = response.toLowerCase().replace(/\s+/g, ' ');
      const normalizedHighlight = highlightedText.toLowerCase().replace(/\s+/g, ' ');
      
      // Check if the response contains at least 70% of the highlighted text
      const words = normalizedHighlight.split(' ');
      let matchCount = 0;
      
      for (const word of words) {
        if (word.length > 3 && normalizedResponse.includes(word)) {
          matchCount++;
        }
      }
      
      return matchCount / words.length > 0.7;
    }
    
    return false;
  }
}

// Export a factory function instead of a singleton
module.exports = () => new AIService();