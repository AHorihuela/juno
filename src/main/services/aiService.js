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
    const actionVerbs = await this.getService('config').getActionVerbs();
    
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
      
      // Get context using the context service with the command for intelligent context selection
      const context = await this.getService('context').getContextAsync(highlightedText, command);
      
      // Track context usage for feedback
      this.contextManager.updateContextUsage(context, highlightedText);
      
      // Show user feedback about context being used
      this.showContextFeedback();
      
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
      const systemPrompt = this.promptBuilder.buildSystemPrompt(aiRules, context);
      console.log('[AIService] System prompt:', systemPrompt);

      // Build the prompt for GPT based on command and context
      const prompt = this.promptBuilder.buildPrompt(command, context);
      console.log('[AIService] Full prompt being sent to GPT:', prompt);

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
            { role: 'user', content: prompt }
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
      
      // Update stats for successful request
      this.statsTracker.recordSuccessfulRequest();
      
      // Provide feedback on context usefulness if we have memory manager
      this.contextManager.updateContextUsefulness(context, true);

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
}

// Export a factory function instead of a singleton
module.exports = () => new AIService();