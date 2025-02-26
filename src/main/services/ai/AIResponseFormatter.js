/**
 * AIResponseFormatter - Formats and cleans AI responses
 * 
 * This class handles cleaning and formatting responses from AI models,
 * removing unwanted formatting and ensuring consistent output.
 */

class AIResponseFormatter {
  constructor() {
    // Define patterns for cleaning responses
    this.cleaningPatterns = [
      // Remove code blocks
      { pattern: /```[\s\S]*?```/g, replacement: '' },
      // Remove inline code
      { pattern: /`([^`]+)`/g, replacement: '$1' },
      // Remove quotes
      { pattern: /^["']|["']$/g, replacement: '' },
      // Clean up extra whitespace
      { pattern: /\n{3,}/g, replacement: '\n\n' }
    ];
  }

  /**
   * Clean response text by removing markdown and unwanted formatting
   * @param {string} text - Raw response text
   * @returns {string} Cleaned text
   */
  cleanResponse(text) {
    if (!text) return '';
    
    let cleanedText = text;
    
    // Apply each cleaning pattern
    for (const { pattern, replacement } of this.cleaningPatterns) {
      cleanedText = cleanedText.replace(pattern, replacement);
    }
    
    return cleanedText.trim();
  }
  
  /**
   * Format response for specific application contexts
   * @param {string} text - Text to format
   * @param {string} appName - Application name
   * @returns {string} Formatted text
   */
  formatForApplication(text, appName) {
    if (!text) return '';
    
    // Apply application-specific formatting
    switch (appName) {
      case 'Cursor':
      case 'Visual Studio Code':
      case 'VSCodium':
        // For code editors, preserve indentation and line breaks
        return text;
        
      case 'Microsoft Word':
      case 'Pages':
      case 'Google Docs':
        // For document editors, ensure proper paragraph spacing
        return text.replace(/\n{2,}/g, '\n\n');
        
      case 'Mail':
      case 'Outlook':
      case 'Gmail':
        // For email, ensure proper line breaks
        return text.replace(/\n{2,}/g, '\n\n');
        
      case 'Slack':
      case 'Discord':
      case 'Messages':
        // For messaging apps, make more concise
        return text.replace(/\n{2,}/g, '\n');
        
      default:
        return text;
    }
  }
  
  /**
   * Truncate text to a maximum length with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncate(text, maxLength = 1000) {
    if (!text || text.length <= maxLength) return text;
    
    return text.substring(0, maxLength - 3) + '...';
  }
}

module.exports = AIResponseFormatter; 