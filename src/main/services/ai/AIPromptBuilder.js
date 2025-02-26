/**
 * AIPromptBuilder - Builds prompts for AI models
 * 
 * This class handles the construction of system and user prompts
 * for AI models, incorporating context and user preferences.
 */

class AIPromptBuilder {
  constructor() {
    // Default base instructions that apply to all prompts
    this.baseInstructions = [
      'You are a text processing tool that helps users with their writing and content.',
      'Output ONLY the processed text without any explanations, greetings, or commentary.',
      'Never say things like "here\'s the text" or "I can help". Just output the transformed text directly.'
    ];
  }

  /**
   * Build a structured system prompt with rules
   * @param {string[]} rules - Array of AI rules
   * @param {Object} context - Context object
   * @returns {string} The system prompt
   */
  buildSystemPrompt(rules, context) {
    const parts = [...this.baseInstructions];
    
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
      const label = this.getContextTypeLabel(context.primaryContext.type, 'primary');
      
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
          const historyLabel = this.getContextTypeLabel(item.type, 'history');
          
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
   * Get a human-readable label for a context type
   * @param {string} type - The context type
   * @param {string} defaultType - Default type if not specified
   * @returns {string} Human-readable label
   * @private
   */
  getContextTypeLabel(type, defaultType) {
    switch(type) {
      case 'highlight':
        return 'Selected text';
      case 'clipboard':
        return 'Recent clipboard content';
      default:
        return defaultType === 'primary' ? 'Primary context' : 
               defaultType === 'history' ? 'Context item' : 
               'Additional context';
    }
  }
}

module.exports = AIPromptBuilder; 