const BaseService = require('./BaseService');
const configService = require('./configService');
const notificationService = require('./notificationService');
const contextService = require('./contextService');

class AIService extends BaseService {
  constructor() {
    super('AI');
    this.currentRequest = null;
    this.openai = null;
    
    // Track context usage for feedback
    this.lastContextUsage = {
      hasHighlightedText: false,
      hasClipboardContent: false,
      applicationName: '',
      contextSize: 0,
      timestamp: 0,
      memoryTiersUsed: [],
      relevanceScores: []
    };
    
    // Track AI usage statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastResponseTime: 0,
      lastRequestTimestamp: 0
    };
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
    console.log('[AIService] Checking first three words:', firstThreeWords, 'against trigger word:', triggerWord.toLowerCase());

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
      // Start timing the request
      const startTime = Date.now();
      this.stats.lastRequestTimestamp = startTime;
      this.stats.totalRequests++;
      
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
      this.updateContextUsage(context, highlightedText);
      
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
      const systemPrompt = this.buildSystemPrompt(aiRules, context);
      console.log('[AIService] System prompt:', systemPrompt);

      // Build the prompt for GPT based on command and context
      const prompt = this.buildPrompt(command, context);
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
      const cleanedText = this.cleanResponse(response.choices[0].message.content.trim());
      console.log('[AIService] Cleaned response text:', cleanedText);
      
      // Update stats for successful request
      const endTime = Date.now();
      this.stats.lastResponseTime = endTime - startTime;
      this.stats.successfulRequests++;
      this.stats.averageResponseTime = 
        (this.stats.averageResponseTime * (this.stats.successfulRequests - 1) + this.stats.lastResponseTime) / 
        this.stats.successfulRequests;
      
      // Provide feedback on context usefulness if we have memory manager
      this.updateContextUsefulness(context, true);

      return {
        text: cleanedText,
        hasHighlight: Boolean(highlightedText),
        originalCommand: command,
        contextUsed: this.getContextUsageSummary(),
        responseTime: this.stats.lastResponseTime
      };

    } catch (error) {
      // Update stats for failed request
      this.stats.failedRequests++;
      
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
   * Update context usage tracking
   * @param {Object} context - Context object
   * @param {string} highlightedText - Currently highlighted text
   * @private
   */
  updateContextUsage(context, highlightedText) {
    // Extract memory tiers used and relevance scores
    const memoryTiersUsed = new Set();
    const relevanceScores = [];
    
    // Check primary context
    if (context.primaryContext) {
      if (context.primaryContext.tier) {
        memoryTiersUsed.add(context.primaryContext.tier);
      }
      if (context.primaryContext.relevanceScore) {
        relevanceScores.push({
          type: 'primary',
          score: context.primaryContext.relevanceScore
        });
      }
    }
    
    // Check secondary context
    if (context.secondaryContext) {
      if (context.secondaryContext.tier) {
        memoryTiersUsed.add(context.secondaryContext.tier);
      }
      if (context.secondaryContext.relevanceScore) {
        relevanceScores.push({
          type: 'secondary',
          score: context.secondaryContext.relevanceScore
        });
      }
    }
    
    // Check history context
    if (context.historyContext && Array.isArray(context.historyContext)) {
      for (const item of context.historyContext) {
        if (item.tier) {
          memoryTiersUsed.add(item.tier);
        }
        if (item.relevanceScore) {
          relevanceScores.push({
            type: 'history',
            score: item.relevanceScore
          });
        }
      }
    }
    
    this.lastContextUsage = {
      hasHighlightedText: Boolean(highlightedText),
      hasClipboardContent: Boolean(context.primaryContext?.type === 'clipboard'),
      applicationName: context.applicationContext?.name || '',
      contextSize: this.calculateContextSize(context),
      timestamp: Date.now(),
      historyItemCount: context.historyContext?.length || 0,
      memoryTiersUsed: Array.from(memoryTiersUsed),
      relevanceScores,
      memoryStats: context.memoryStats || null
    };
    
    console.log('[AIService] Updated context usage tracking:', this.lastContextUsage);
  }
  
  /**
   * Update usefulness scores for context items
   * @param {Object} context - Context object
   * @param {boolean} wasSuccessful - Whether the AI request was successful
   * @private
   */
  updateContextUsefulness(context, wasSuccessful) {
    try {
      const memoryManager = this.getService('memoryManager');
      if (!memoryManager) return;
      
      // Base usefulness score - higher if request was successful
      const baseScore = wasSuccessful ? 8 : 3;
      
      // Record usefulness for primary context
      if (context.primaryContext?.id) {
        memoryManager.recordItemUsage(context.primaryContext.id, baseScore);
      }
      
      // Record usefulness for secondary context (slightly lower score)
      if (context.secondaryContext?.id) {
        memoryManager.recordItemUsage(context.secondaryContext.id, Math.max(1, baseScore - 2));
      }
      
      // Record usefulness for history context items (even lower score)
      if (context.historyContext && Array.isArray(context.historyContext)) {
        for (const item of context.historyContext) {
          if (item.id) {
            memoryManager.recordItemUsage(item.id, Math.max(1, baseScore - 4));
          }
        }
      }
      
      console.log('[AIService] Updated context usefulness scores');
    } catch (error) {
      console.error('[AIService] Error updating context usefulness:', error);
    }
  }
  
  /**
   * Calculate the total size of context in characters
   * @param {Object} context - Context object
   * @returns {number} Total context size in characters
   * @private
   */
  calculateContextSize(context) {
    let size = 0;
    
    if (context.primaryContext?.content) {
      size += context.primaryContext.content.length;
    }
    
    if (context.secondaryContext?.content) {
      size += context.secondaryContext.content.length;
    }
    
    if (context.historyContext) {
      for (const item of context.historyContext) {
        if (item.content) {
          size += item.content.length;
        }
      }
    }
    
    return size;
  }
  
  /**
   * Get a summary of context usage for user feedback
   * @returns {Object} Context usage summary
   */
  getContextUsageSummary() {
    return {
      ...this.lastContextUsage,
      contextSizeFormatted: this.formatContextSize(this.lastContextUsage.contextSize)
    };
  }
  
  /**
   * Format context size in a human-readable way
   * @param {number} size - Size in characters
   * @returns {string} Formatted size
   * @private
   */
  formatContextSize(size) {
    if (size < 1000) {
      return `${size} characters`;
    } else {
      return `${(size / 1000).toFixed(1)}K characters`;
    }
  }
  
  /**
   * Show feedback to the user about context being used
   * @private
   */
  showContextFeedback() {
    // Only show feedback if we have context
    if (this.lastContextUsage.contextSize > 0) {
      const contextTypes = [];
      
      if (this.lastContextUsage.hasHighlightedText) {
        contextTypes.push('highlighted text');
      }
      
      if (this.lastContextUsage.hasClipboardContent) {
        contextTypes.push('clipboard content');
      }
      
      if (this.lastContextUsage.historyItemCount > 0) {
        contextTypes.push('context history');
      }
      
      // Add memory tiers if available
      if (this.lastContextUsage.memoryTiersUsed && this.lastContextUsage.memoryTiersUsed.length > 0) {
        const tiersText = this.lastContextUsage.memoryTiersUsed
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
      
      const appText = this.lastContextUsage.applicationName 
        ? ` in ${this.lastContextUsage.applicationName}` 
        : '';
      
      // Add relevance information if available
      let relevanceText = '';
      if (this.lastContextUsage.relevanceScores && this.lastContextUsage.relevanceScores.length > 0) {
        const avgScore = this.lastContextUsage.relevanceScores.reduce(
          (sum, item) => sum + item.score, 0
        ) / this.lastContextUsage.relevanceScores.length;
        
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
        body: `Using ${contextTypeText}${appText} (${this.formatContextSize(this.lastContextUsage.contextSize)})${relevanceText}`,
        type: 'info',
        timeout: 3000
      });
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
    
    // Add memory context information if available
    if (context.memoryStats) {
      parts.push(`The context provided has been intelligently selected from ${context.memoryStats.totalItemsScored} available memory items based on relevance to the current command.`);
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
      const label = context.primaryContext.type === 'highlight' ? 'Selected text' : 
                   context.primaryContext.type === 'clipboard' ? 'Recent clipboard content' :
                   'Primary context';
      
      // Add relevance score if available
      const relevanceInfo = context.primaryContext.relevanceScore ? 
        ` (relevance: ${context.primaryContext.relevanceScore}/100)` : '';
      
      parts.push(`\n${label}${relevanceInfo}:\n"""\n${context.primaryContext.content}\n"""`);
    }
    
    if (context.secondaryContext) {
      // Add relevance score if available
      const relevanceInfo = context.secondaryContext.relevanceScore ? 
        ` (relevance: ${context.secondaryContext.relevanceScore}/100)` : '';
      
      parts.push(`\nAdditional context${relevanceInfo}:\n"""\n${context.secondaryContext.content}\n"""`);
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
        parts.push('\nAdditional context:');
        
        relevantHistory.forEach((item, index) => {
          const historyLabel = item.type === 'highlight' ? 
            `Previously selected text` : 
            item.type === 'clipboard' ?
            `Previous clipboard content` :
            `Context item`;
          
          // Add relevance score if available
          const relevanceInfo = item.relevanceScore ? 
            ` (relevance: ${item.relevanceScore}/100)` : '';
          
          // Use a more compact format for history items
          parts.push(`\n${historyLabel}${relevanceInfo}:\n"""\n${item.content}\n"""`);
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
  
  /**
   * Get detailed statistics about AI usage
   * @returns {Object} AI usage statistics
   */
  getAIUsageStats() {
    return {
      lastContextUsage: this.lastContextUsage,
      formattedContextSize: this.formatContextSize(this.lastContextUsage.contextSize),
      timestamp: Date.now(),
      stats: this.stats,
      formattedResponseTime: this.formatResponseTime(this.stats.lastResponseTime),
      formattedAverageResponseTime: this.formatResponseTime(this.stats.averageResponseTime)
    };
  }
  
  /**
   * Format response time in a human-readable way
   * @param {number} time - Time in milliseconds
   * @returns {string} Formatted time
   * @private
   */
  formatResponseTime(time) {
    if (!time) return 'N/A';
    
    if (time < 1000) {
      return `${time}ms`;
    } else {
      return `${(time / 1000).toFixed(1)}s`;
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new AIService();