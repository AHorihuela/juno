/**
 * CommandProcessor - Processes transcribed text for commands
 * 
 * This module:
 * - Analyzes transcribed text
 * - Detects and processes AI commands
 * - Routes commands to appropriate handlers
 */

const { EventEmitter } = require('events');
const logger = require('../../../logger');

class CommandProcessor extends EventEmitter {
  constructor() {
    super();
    this.initialized = false;
    this.services = null;
    this.aiService = null;
    this.textProcessingService = null;
    this.historyService = null;
    
    // Command statistics
    this.stats = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      aiCommands: 0,
      normalTranscriptions: 0
    };
  }

  /**
   * Initialize the command processor
   * @param {ServiceRegistry} services Service registry
   * @returns {Promise<void>}
   */
  async initialize(services) {
    if (this.initialized) {
      return;
    }

    logger.debug('Initializing command processor');
    this.services = services;

    try {
      // Get required services
      this.aiService = services.get('ai');
      this.textProcessingService = services.get('textProcessing');
      
      // History service is optional
      try {
        this.historyService = services.get('history');
      } catch (error) {
        logger.warn('History service not available, history features will be disabled');
      }
      
      this.initialized = true;
      logger.debug('Command processor initialized successfully');
    } catch (error) {
      logger.error('Error initializing command processor:', error);
      throw error;
    }
  }

  /**
   * Shutdown the command processor
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.debug('Shutting down command processor');
    
    try {
      // Reset all state
      this.stats = {
        totalCommands: 0,
        successfulCommands: 0,
        failedCommands: 0,
        aiCommands: 0,
        normalTranscriptions: 0
      };
      
      this.initialized = false;
      logger.debug('Command processor shutdown complete');
    } catch (error) {
      logger.error('Error shutting down command processor:', error);
    }
  }

  /**
   * Process a transcribed command
   * @param {string} text Transcribed text to process
   * @returns {Promise<Object>} Processing result
   */
  async processCommand(text) {
    if (!this.initialized) {
      throw new Error('Command processor not initialized');
    }

    if (!text || text.trim() === '') {
      return { success: false, reason: 'empty-text' };
    }

    try {
      logger.debug(`Processing command: "${text}"`);
      this.stats.totalCommands++;
      
      // Pre-process the text if text processing service is available
      let processedText = text;
      if (this.textProcessingService) {
        try {
          processedText = await this.textProcessingService.processText(text);
          logger.debug(`Processed text: "${processedText}"`);
        } catch (error) {
          logger.warn('Error processing text, using original:', error);
        }
      }
      
      // Check if this is an AI command
      if (this.aiService) {
        const isAICommand = await this._checkIfAICommand(processedText);
        
        if (isAICommand) {
          // Process as AI command
          return await this._processAICommand(processedText);
        }
      }
      
      // Process as normal transcription
      return await this._processNormalTranscription(processedText);
    } catch (error) {
      logger.error('Error processing command:', error);
      this.stats.failedCommands++;
      return { success: false, reason: 'error', error };
    }
  }

  /**
   * Check if text is an AI command
   * @param {string} text Text to check
   * @returns {Promise<boolean>} Whether this is an AI command
   * @private
   */
  async _checkIfAICommand(text) {
    try {
      if (!this.aiService) {
        return false;
      }
      
      // If the service has a method to check commands, use it
      if (typeof this.aiService.isAICommand === 'function') {
        return await this.aiService.isAICommand(text);
      }
      
      // Fall back to simple prefix detection
      const aiPrefixes = ['hey juno', 'hey june', 'hey junior', 'hey tuna', 'ok juno'];
      const lowerText = text.toLowerCase();
      
      return aiPrefixes.some(prefix => lowerText.startsWith(prefix));
    } catch (error) {
      logger.warn('Error checking if AI command:', error);
      return false;
    }
  }

  /**
   * Process text as an AI command
   * @param {string} text Command text
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processAICommand(text) {
    try {
      logger.info('Processing AI command');
      this.stats.aiCommands++;
      
      // Check if we have AI service
      if (!this.aiService) {
        logger.warn('AI service not available, cannot process command');
        this.stats.failedCommands++;
        
        this.emit('command-processed', {
          success: false,
          reason: 'no-ai-service',
          command: text,
          isAI: true
        });
        
        return { success: false, reason: 'no-ai-service' };
      }
      
      // Get selected text as context
      const selectionService = this.services.get('selection');
      const selectedText = selectionService ? await selectionService.getSelectedText() : '';
      
      // Process the command with the AI service
      const aiProcessMethod = typeof this.aiService.processCommand === 'function' 
        ? 'processCommand' 
        : (typeof this.aiService.processRequest === 'function' ? 'processRequest' : null);
        
      if (!aiProcessMethod) {
        logger.error('AI service has no valid processing method');
        this.stats.failedCommands++;
        
        this.emit('command-processed', {
          success: false, 
          reason: 'invalid-ai-service',
          command: text,
          isAI: true
        });
        
        return { success: false, reason: 'invalid-ai-service' };
      }
      
      // Call AI service to process the command
      const aiResponse = await this.aiService[aiProcessMethod](text, selectedText);
      
      // Handle response
      if (!aiResponse) {
        logger.warn('AI service returned empty response');
        this.stats.failedCommands++;
        
        this.emit('command-processed', {
          success: false,
          reason: 'empty-ai-response',
          command: text,
          isAI: true
        });
        
        return { success: false, reason: 'empty-ai-response' };
      }
      
      // Extract response text
      let responseText = aiResponse;
      
      // Handle response object format
      if (typeof aiResponse === 'object' && aiResponse !== null) {
        responseText = aiResponse.text || aiResponse.response || '';
      }
      
      if (!responseText) {
        logger.warn('AI response contains no text');
        this.stats.failedCommands++;
        
        this.emit('command-processed', {
          success: false,
          reason: 'empty-ai-response-text',
          command: text,
          isAI: true
        });
        
        return { success: false, reason: 'empty-ai-response-text' };
      }
      
      // Add trailing space if needed
      const responseTextWithSpace = this._addTrailingSpaceIfNeeded(responseText);
      
      // Insert the response text
      const insertResult = await this._insertText(responseTextWithSpace);
      
      // Add to history if successful
      if (insertResult.success && this.historyService) {
        try {
          await this.historyService.addEntry({
            text: responseTextWithSpace,
            source: 'ai',
            timestamp: Date.now(),
            command: text
          });
        } catch (historyError) {
          logger.warn('Error adding to history:', historyError);
        }
      }
      
      // Update stats
      if (insertResult.success) {
        this.stats.successfulCommands++;
      } else {
        this.stats.failedCommands++;
      }
      
      // Emit event
      this.emit('command-processed', {
        ...insertResult,
        command: text,
        response: responseTextWithSpace,
        isAI: true
      });
      
      return { 
        success: insertResult.success,
        command: text,
        response: responseTextWithSpace,
        isAI: true
      };
    } catch (error) {
      logger.error('Error processing AI command:', error);
      this.stats.failedCommands++;
      
      this.emit('command-processed', {
        success: false,
        reason: 'error',
        error: error.message,
        command: text,
        isAI: true
      });
      
      return { success: false, reason: 'error', error };
    }
  }

  /**
   * Process text as a normal transcription
   * @param {string} text Transcribed text
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processNormalTranscription(text) {
    try {
      logger.info('Processing normal transcription');
      this.stats.normalTranscriptions++;
      
      // Add trailing space if needed
      const textToInsert = this._addTrailingSpaceIfNeeded(text);
      
      // Insert the text
      const insertResult = await this._insertText(textToInsert);
      
      // Add to history if successful
      if (insertResult.success && this.historyService) {
        try {
          await this.historyService.addEntry({
            text: textToInsert,
            source: 'transcription',
            timestamp: Date.now()
          });
        } catch (historyError) {
          logger.warn('Error adding to history:', historyError);
        }
      }
      
      // Update stats
      if (insertResult.success) {
        this.stats.successfulCommands++;
      } else {
        this.stats.failedCommands++;
      }
      
      // Emit event
      this.emit('command-processed', {
        ...insertResult,
        command: text,
        isAI: false
      });
      
      return { 
        success: insertResult.success,
        command: text,
        isAI: false
      };
    } catch (error) {
      logger.error('Error processing normal transcription:', error);
      this.stats.failedCommands++;
      
      this.emit('command-processed', {
        success: false,
        reason: 'error',
        error: error.message,
        command: text,
        isAI: false
      });
      
      return { success: false, reason: 'error', error };
    }
  }

  /**
   * Insert text using the text insertion service
   * @param {string} text Text to insert
   * @returns {Promise<Object>} Insertion result
   * @private
   */
  async _insertText(text) {
    try {
      const textInsertionService = this.services.get('textInsertion');
      
      if (!textInsertionService) {
        logger.warn('Text insertion service not available');
        return { success: false, reason: 'no-insertion-service' };
      }
      
      // The text is already processed with trailing space when needed
      const result = await textInsertionService.insertText(text);
      
      if (typeof result === 'boolean') {
        // Handle simple boolean return values
        return { success: result };
      }
      
      // Handle object return values
      return result && typeof result === 'object' 
        ? result 
        : { success: !!result };
    } catch (error) {
      logger.error('Error inserting text:', error);
      return { success: false, reason: 'insertion-error', error: error.message };
    }
  }
  
  /**
   * Add a trailing space to text if needed
   * @param {string} text The text to process
   * @returns {string} Text with trailing space if needed
   * @private
   */
  _addTrailingSpaceIfNeeded(text) {
    if (!text) return text;
    
    // Don't add space if text already ends with space or certain punctuation
    const lastChar = text.slice(-1);
    const endsWithSpaceOrPunctuation = /[\s\.\,\!\?\:\;\)\]\}]/.test(lastChar);
    
    if (endsWithSpaceOrPunctuation) {
      logger.debug('Text already ends with space or punctuation, not adding space');
      return text;
    }
    
    logger.debug('Adding trailing space to transcribed text for better typing flow');
    return text + ' ';
  }

  /**
   * Get command processing statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset command processing statistics
   */
  resetStats() {
    this.stats = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      aiCommands: 0,
      normalTranscriptions: 0
    };
  }
}

module.exports = CommandProcessor; 