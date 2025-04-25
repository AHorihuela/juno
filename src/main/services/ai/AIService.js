/**
 * AI Service
 * 
 * This service:
 * - Manages connections to AI providers (OpenAI, Anthropic, etc.)
 * - Handles text completion and chat requests
 * - Manages AI prompts and conversation history
 */

const { EventEmitter } = require('events');
const logger = require('../../logger');

// AI provider implementations will be separate files
const OpenAIProvider = require('./providers/OpenAIProvider');
const AnthropicProvider = require('./providers/AnthropicProvider');
const MockProvider = require('./providers/MockProvider');

// Default system prompts for different models
const DEFAULT_SYSTEM_PROMPTS = {
  default: "You are Juno, an AI voice assistant that helps with coding and general queries. Be concise and helpful.",
  coding: "You are Juno, an AI coding assistant. Help write, explain, and debug code. Be precise and technical.",
  creative: "You are Juno, a creative AI assistant. Help with brainstorming, writing, and creative projects.",
};

class AIService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.options = {
      defaultProvider: 'mock',
      defaultModel: 'default',
      temperature: 0.7,
      maxTokens: 1024,
      systemPrompt: DEFAULT_SYSTEM_PROMPTS.default,
      ...options
    };
    
    this.services = null;
    this.providers = {};
    this.conversations = {};
    this.activeConversationId = null;
  }
  
  /**
   * Initialize the service
   * @param {Object} services Service registry
   * @returns {Promise<void>}
   */
  async initialize(services) {
    if (this.initialized) {
      return;
    }
    
    logger.info('Initializing AI service');
    this.services = services;
    
    try {
      // Load configuration
      const configService = services.get('config');
      if (configService) {
        const aiConfig = await configService.getConfig('ai') || {};
        
        // Update options from config
        if (aiConfig.defaultProvider) {
          this.options.defaultProvider = aiConfig.defaultProvider;
        }
        
        if (aiConfig.defaultModel) {
          this.options.defaultModel = aiConfig.defaultModel;
        }
        
        if (aiConfig.temperature !== undefined) {
          this.options.temperature = aiConfig.temperature;
        }
        
        if (aiConfig.maxTokens !== undefined) {
          this.options.maxTokens = aiConfig.maxTokens;
        }
        
        if (aiConfig.systemPrompt) {
          this.options.systemPrompt = aiConfig.systemPrompt;
        }
      } else {
        logger.warn('Config service not available, using default AI settings');
      }
      
      // Initialize AI providers
      await this._initializeProviders();
      
      // Create a default conversation
      this._createNewConversation();
      
      this.initialized = true;
      logger.info('AI service initialized successfully');
    } catch (error) {
      logger.error('Error initializing AI service:', error);
      throw error;
    }
  }
  
  /**
   * Shutdown the service
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('Shutting down AI service');
    
    try {
      // Close all provider connections
      const shutdownPromises = Object.values(this.providers).map(provider => {
        if (provider && typeof provider.shutdown === 'function') {
          return provider.shutdown();
        }
        return Promise.resolve();
      });
      
      await Promise.all(shutdownPromises);
      
      this.initialized = false;
      logger.info('AI service shutdown complete');
    } catch (error) {
      logger.error('Error shutting down AI service:', error);
      throw error;
    }
  }
  
  /**
   * Send a message to the AI and get a response
   * @param {string} message User message
   * @param {Object} options Request options
   * @returns {Promise<Object>} Response object
   */
  async sendMessage(message, options = {}) {
    if (!this.initialized) {
      logger.error('Cannot send message, AI service not initialized');
      throw new Error('AI service not initialized');
    }
    
    if (!message || typeof message !== 'string') {
      logger.error('Empty or invalid message provided');
      throw new Error('Message must be a non-empty string');
    }
    
    try {
      logger.debug(`Sending message to AI: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
      
      // Get conversation
      const conversationId = options.conversationId || this.activeConversationId;
      if (!this.conversations[conversationId]) {
        logger.warn(`Conversation ${conversationId} not found, creating new conversation`);
        this._createNewConversation();
      }
      
      const conversation = this.conversations[conversationId];
      
      // Get provider
      const providerName = options.provider || this.options.defaultProvider;
      const provider = this.providers[providerName];
      
      if (!provider) {
        throw new Error(`AI provider '${providerName}' not available`);
      }
      
      // Get model
      const model = options.model || this.options.defaultModel;
      
      // Prepare request options
      const requestOptions = {
        model,
        temperature: options.temperature !== undefined ? options.temperature : this.options.temperature,
        maxTokens: options.maxTokens || this.options.maxTokens,
        systemPrompt: options.systemPrompt || conversation.systemPrompt || this.options.systemPrompt,
        conversation: conversation.messages
      };
      
      // Add message to conversation
      conversation.messages.push({
        role: 'user',
        content: message,
        timestamp: Date.now()
      });
      
      // Emit event for message sent
      this.emit('message-sent', {
        conversationId,
        message
      });
      
      // Send message to provider
      const response = await provider.sendMessage(message, requestOptions);
      
      // Add response to conversation
      conversation.messages.push({
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        model: response.model
      });
      
      // Emit event for response received
      this.emit('response-received', {
        conversationId,
        response: response.content,
        model: response.model
      });
      
      return {
        conversationId,
        content: response.content,
        model: response.model
      };
    } catch (error) {
      logger.error('Error sending message to AI:', error);
      
      // Emit error event
      this.emit('error', {
        error: error.message,
        type: 'message-error'
      });
      
      throw error;
    }
  }
  
  /**
   * Create a new conversation
   * @param {Object} options Conversation options
   * @returns {string} Conversation ID
   */
  createConversation(options = {}) {
    try {
      return this._createNewConversation(options);
    } catch (error) {
      logger.error('Error creating conversation:', error);
      throw error;
    }
  }
  
  /**
   * Get a conversation by ID
   * @param {string} conversationId Conversation ID
   * @returns {Object} Conversation object
   */
  getConversation(conversationId) {
    try {
      if (!conversationId || !this.conversations[conversationId]) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      return this.conversations[conversationId];
    } catch (error) {
      logger.error('Error getting conversation:', error);
      throw error;
    }
  }
  
  /**
   * Get all conversations
   * @returns {Object} Map of conversations
   */
  getConversations() {
    try {
      return { ...this.conversations };
    } catch (error) {
      logger.error('Error getting conversations:', error);
      throw error;
    }
  }
  
  /**
   * Set active conversation
   * @param {string} conversationId Conversation ID
   * @returns {boolean} Success status
   */
  setActiveConversation(conversationId) {
    try {
      if (!conversationId || !this.conversations[conversationId]) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      this.activeConversationId = conversationId;
      return true;
    } catch (error) {
      logger.error('Error setting active conversation:', error);
      return false;
    }
  }
  
  /**
   * Delete a conversation
   * @param {string} conversationId Conversation ID
   * @returns {boolean} Success status
   */
  deleteConversation(conversationId) {
    try {
      if (!conversationId || !this.conversations[conversationId]) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      delete this.conversations[conversationId];
      
      // If deleted the active conversation, create a new one
      if (conversationId === this.activeConversationId) {
        this._createNewConversation();
      }
      
      return true;
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      return false;
    }
  }
  
  /**
   * Clear a conversation's messages
   * @param {string} conversationId Conversation ID
   * @returns {boolean} Success status
   */
  clearConversation(conversationId) {
    try {
      if (!conversationId || !this.conversations[conversationId]) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      this.conversations[conversationId].messages = [];
      return true;
    } catch (error) {
      logger.error('Error clearing conversation:', error);
      return false;
    }
  }
  
  /**
   * Set system prompt for a conversation
   * @param {string} conversationId Conversation ID
   * @param {string} systemPrompt System prompt
   * @returns {boolean} Success status
   */
  setSystemPrompt(conversationId, systemPrompt) {
    try {
      if (!conversationId || !this.conversations[conversationId]) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      if (!systemPrompt || typeof systemPrompt !== 'string') {
        throw new Error('System prompt must be a non-empty string');
      }
      
      this.conversations[conversationId].systemPrompt = systemPrompt;
      return true;
    } catch (error) {
      logger.error('Error setting system prompt:', error);
      return false;
    }
  }
  
  /**
   * Get available AI providers
   * @returns {Array} Provider info
   */
  getAvailableProviders() {
    try {
      return Object.keys(this.providers).map(key => {
        const provider = this.providers[key];
        return {
          id: key,
          name: provider.name,
          models: provider.getAvailableModels(),
          isConfigured: provider.isConfigured()
        };
      });
    } catch (error) {
      logger.error('Error getting available providers:', error);
      return [];
    }
  }
  
  /**
   * Set default AI provider
   * @param {string} providerId Provider ID
   * @returns {boolean} Success status
   */
  setDefaultProvider(providerId) {
    try {
      if (!this.providers[providerId]) {
        throw new Error(`Provider ${providerId} not available`);
      }
      
      this.options.defaultProvider = providerId;
      
      // Save to config if available
      const configService = this.services?.get('config');
      if (configService) {
        configService.updateConfig('ai', { defaultProvider: providerId });
      }
      
      return true;
    } catch (error) {
      logger.error('Error setting default provider:', error);
      return false;
    }
  }
  
  /**
   * Set default model for provider
   * @param {string} providerId Provider ID
   * @param {string} modelId Model ID
   * @returns {boolean} Success status
   */
  setDefaultModel(providerId, modelId) {
    try {
      const provider = this.providers[providerId];
      if (!provider) {
        throw new Error(`Provider ${providerId} not available`);
      }
      
      const models = provider.getAvailableModels();
      if (!models.find(model => model.id === modelId)) {
        throw new Error(`Model ${modelId} not available for provider ${providerId}`);
      }
      
      this.options.defaultModel = modelId;
      
      // Save to config if available
      const configService = this.services?.get('config');
      if (configService) {
        configService.updateConfig('ai', { defaultModel: modelId });
      }
      
      return true;
    } catch (error) {
      logger.error('Error setting default model:', error);
      return false;
    }
  }
  
  /**
   * Set temperature
   * @param {number} temperature Temperature (0 to 1)
   * @returns {boolean} Success status
   */
  setTemperature(temperature) {
    try {
      if (typeof temperature !== 'number' || temperature < 0 || temperature > 1) {
        throw new Error('Temperature must be a number between 0 and 1');
      }
      
      this.options.temperature = temperature;
      
      // Save to config if available
      const configService = this.services?.get('config');
      if (configService) {
        configService.updateConfig('ai', { temperature });
      }
      
      return true;
    } catch (error) {
      logger.error('Error setting temperature:', error);
      return false;
    }
  }
  
  /**
   * Set max tokens
   * @param {number} maxTokens Max tokens
   * @returns {boolean} Success status
   */
  setMaxTokens(maxTokens) {
    try {
      if (typeof maxTokens !== 'number' || maxTokens < 1) {
        throw new Error('Max tokens must be a positive number');
      }
      
      this.options.maxTokens = maxTokens;
      
      // Save to config if available
      const configService = this.services?.get('config');
      if (configService) {
        configService.updateConfig('ai', { maxTokens });
      }
      
      return true;
    } catch (error) {
      logger.error('Error setting max tokens:', error);
      return false;
    }
  }
  
  /**
   * Initialize AI providers
   * @private
   */
  async _initializeProviders() {
    try {
      logger.debug('Initializing AI providers');
      
      // Get config service
      const configService = this.services.get('config');
      
      // Initialize OpenAI provider
      this.providers.openai = new OpenAIProvider();
      if (configService) {
        const openaiConfig = await configService.getConfig('ai.providers.openai') || {};
        await this.providers.openai.initialize(openaiConfig);
      } else {
        await this.providers.openai.initialize({});
      }
      
      // Initialize Anthropic provider
      this.providers.anthropic = new AnthropicProvider();
      if (configService) {
        const anthropicConfig = await configService.getConfig('ai.providers.anthropic') || {};
        await this.providers.anthropic.initialize(anthropicConfig);
      } else {
        await this.providers.anthropic.initialize({});
      }
      
      // Initialize Mock provider (always available)
      this.providers.mock = new MockProvider();
      await this.providers.mock.initialize({});
      
      // Update default provider if not available
      if (!this.providers[this.options.defaultProvider].isConfigured()) {
        // Find first configured provider
        const configuredProvider = Object.keys(this.providers).find(key => 
          this.providers[key].isConfigured()
        );
        
        if (configuredProvider) {
          logger.warn(`Default provider ${this.options.defaultProvider} not configured, using ${configuredProvider}`);
          this.options.defaultProvider = configuredProvider;
        } else {
          // Fallback to mock provider
          logger.warn('No configured providers available, using mock provider');
          this.options.defaultProvider = 'mock';
        }
      }
      
      logger.debug('AI providers initialized successfully');
    } catch (error) {
      logger.error('Error initializing AI providers:', error);
      throw error;
    }
  }
  
  /**
   * Create a new conversation
   * @param {Object} options Conversation options
   * @returns {string} Conversation ID
   * @private
   */
  _createNewConversation(options = {}) {
    const id = `conv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    this.conversations[id] = {
      id,
      title: options.title || 'New Conversation',
      systemPrompt: options.systemPrompt || this.options.systemPrompt,
      provider: options.provider || this.options.defaultProvider,
      model: options.model || this.options.defaultModel,
      created: Date.now(),
      messages: []
    };
    
    this.activeConversationId = id;
    
    logger.debug(`Created new conversation: ${id}`);
    
    // Emit event for new conversation
    this.emit('conversation-created', {
      conversationId: id
    });
    
    return id;
  }
}

/**
 * Factory function for creating AIService instances
 * @param {Object} options Service options
 * @returns {AIService} AI service instance
 */
module.exports = (options = {}) => {
  return new AIService(options);
};

module.exports.AIService = AIService; 