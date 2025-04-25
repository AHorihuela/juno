/**
 * TextProcessingService - Text processing for transcription
 * 
 * This service handles all text-related functionality:
 * - Text sanitization and normalization
 * - Punctuation and formatting
 * - Special character handling
 * - Text chunking
 */
const BaseService = require('../BaseService');
const LogManager = require('../../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('TextProcessingService');

class TextProcessingService extends BaseService {
  constructor() {
    super('TextProcessing');
    
    // Common word replacements (expanded in initialization)
    this.wordReplacements = new Map();
    
    // Common patterns to clean up
    this.cleanupPatterns = [];
    
    // Punctuation formatting rules
    this.punctuationRules = [];
    
    // Text normalization options
    this.normalizationOptions = {
      fixCapitalization: true,
      fixPunctuation: true,
      fixSpacing: true,
      expandAbbreviations: true
    };
  }
  
  /**
   * Initialize the service
   * @private
   */
  async _initialize() {
    logger.info('Initializing TextProcessingService');
    
    // Get required services
    this.configManager = await this.getService('config');
    this.dictionaryService = await this.getService('dictionary');
    
    // Initialize replacements and patterns
    await this._initializeReplacements();
    await this._initializePatterns();
    
    // Load custom user replacements if available
    const userReplacements = this.configManager.get('transcription.textProcessing.replacements');
    if (userReplacements && typeof userReplacements === 'object') {
      for (const [key, value] of Object.entries(userReplacements)) {
        this.wordReplacements.set(key.toLowerCase(), value);
      }
    }
    
    // Load normalization options from config
    const normOptions = this.configManager.get('transcription.textProcessing.normalization');
    if (normOptions && typeof normOptions === 'object') {
      this.normalizationOptions = {
        ...this.normalizationOptions,
        ...normOptions
      };
    }
    
    logger.info('TextProcessingService initialized');
  }
  
  /**
   * Shutdown the service
   * @private
   */
  async _shutdown() {
    logger.info('Shutting down TextProcessingService');
    
    // Clear references
    this.configManager = null;
    this.dictionaryService = null;
    this.wordReplacements.clear();
    this.cleanupPatterns = [];
    this.punctuationRules = [];
  }
  
  /**
   * Initialize word replacements map
   * @private
   */
  async _initializeReplacements() {
    // Common technical terms
    this.wordReplacements.set('javascript', 'JavaScript');
    this.wordReplacements.set('typescript', 'TypeScript');
    this.wordReplacements.set('html', 'HTML');
    this.wordReplacements.set('css', 'CSS');
    this.wordReplacements.set('json', 'JSON');
    this.wordReplacements.set('api', 'API');
    this.wordReplacements.set('apis', 'APIs');
    this.wordReplacements.set('url', 'URL');
    this.wordReplacements.set('urls', 'URLs');
    this.wordReplacements.set('ui', 'UI');
    this.wordReplacements.set('ux', 'UX');
    this.wordReplacements.set('id', 'ID');
    this.wordReplacements.set('ids', 'IDs');
    this.wordReplacements.set('http', 'HTTP');
    this.wordReplacements.set('https', 'HTTPS');
    
    // Common abbreviations
    this.wordReplacements.set('i.e.', 'i.e.,');
    this.wordReplacements.set('e.g.', 'e.g.,');
    this.wordReplacements.set('etc.', 'etc.');
    
    // Common misheard words
    this.wordReplacements.set('eye', 'I');
    this.wordReplacements.set('im', "I'm");
    this.wordReplacements.set('i m', "I'm");
    this.wordReplacements.set('youre', "you're");
    this.wordReplacements.set('you re', "you're");
    this.wordReplacements.set('wont', "won't");
    this.wordReplacements.set('cant', "can't");
    this.wordReplacements.set('dont', "don't");
    this.wordReplacements.set('isnt', "isn't");
    this.wordReplacements.set('arent', "aren't");
    this.wordReplacements.set('wasnt', "wasn't");
    this.wordReplacements.set('werent', "weren't");
    this.wordReplacements.set('hasnt', "hasn't");
    this.wordReplacements.set('havent', "haven't");
    this.wordReplacements.set('hadnt', "hadn't");
    this.wordReplacements.set('couldnt', "couldn't");
    this.wordReplacements.set('shouldnt', "shouldn't");
    this.wordReplacements.set('wouldnt', "wouldn't");
    
    // Numbers and units
    this.wordReplacements.set('0', 'zero');
    this.wordReplacements.set('1', 'one');
    this.wordReplacements.set('2', 'two');
    this.wordReplacements.set('3', 'three');
    this.wordReplacements.set('4', 'four');
    this.wordReplacements.set('5', 'five');
    this.wordReplacements.set('6', 'six');
    this.wordReplacements.set('7', 'seven');
    this.wordReplacements.set('8', 'eight');
    this.wordReplacements.set('9', 'nine');
    this.wordReplacements.set('10', 'ten');
    
    logger.debug('Word replacements initialized');
  }
  
  /**
   * Initialize pattern replacements
   * @private
   */
  async _initializePatterns() {
    // Cleanup patterns - [regex, replacement]
    this.cleanupPatterns = [
      // Remove extra spaces
      [/\s+/g, ' '],
      
      // Fix spacing with punctuation
      [/\s+([.,;:!?])/g, '$1'],
      [/([.,;:!?])\s+/g, '$1 '],
      
      // Fix spacing with parentheses/brackets
      [/\(\s+/g, '('],
      [/\s+\)/g, ')'],
      [/\[\s+/g, '['],
      [/\s+\]/g, ']'],
      
      // Fix spacing with quotes
      [/"\s+/g, '"'],
      [/\s+"/g, '"'],
      [/'\s+/g, "'"],
      [/\s+'/g, "'"],
      
      // Fix common dashes
      [/--/g, '—'],
      [/ - /g, ' — '],
      
      // Fix spaces at beginning/end
      [/^\s+/, ''],
      [/\s+$/, '']
    ];
    
    // Punctuation rules - looking for patterns to add proper punctuation
    this.punctuationRules = [
      // Add period at end if missing any terminal punctuation
      [/([^.!?…]|[.!?…][^.!?…])$/, '$1.'],
      
      // Fix spacing after sentences
      [/([.!?])\s*([A-Z])/g, '$1 $2'],
      
      // Convert multiple periods to ellipsis
      [/\.{3,}/g, '…'],
      
      // Fix quote punctuation
      [/"([^"]*?[.!?])\s+/g, '"$1 '],
      [/"([^"]*?[.!?])"/g, '"$1"']
    ];
    
    logger.debug('Cleanup patterns initialized');
  }
  
  /**
   * Process and clean up transcription text
   * @param {string} text - Raw transcription text
   * @param {Object} options - Processing options
   * @param {boolean} [options.fixCapitalization=true] - Fix capitalization
   * @param {boolean} [options.fixPunctuation=true] - Fix punctuation
   * @param {boolean} [options.fixSpacing=true] - Fix spacing
   * @param {boolean} [options.expandAbbreviations=true] - Expand abbreviations
   * @returns {string} Processed text
   */
  processText(text, options = {}) {
    if (!text) return '';
    
    // Merge options with defaults
    const opts = {
      ...this.normalizationOptions,
      ...options
    };
    
    let processedText = text.trim();
    
    try {
      // Apply word replacements if needed
      if (opts.expandAbbreviations) {
        processedText = this._applyWordReplacements(processedText);
      }
      
      // Fix spacing if needed
      if (opts.fixSpacing) {
        processedText = this._fixSpacing(processedText);
      }
      
      // Fix punctuation if needed
      if (opts.fixPunctuation) {
        processedText = this._fixPunctuation(processedText);
      }
      
      // Fix capitalization if needed
      if (opts.fixCapitalization) {
        processedText = this._fixCapitalization(processedText);
      }
      
      return processedText;
    } catch (error) {
      logger.error('Error processing text:', error);
      return text; // Return original text on error
    }
  }
  
  /**
   * Apply word replacements to text
   * @param {string} text - Input text
   * @returns {string} Text with replacements applied
   * @private
   */
  _applyWordReplacements(text) {
    if (!text) return '';
    
    try {
      // Split text into words
      const words = text.split(/\b/);
      
      // Process each word
      for (let i = 0; i < words.length; i++) {
        const word = words[i].toLowerCase();
        
        // Check if word has a replacement
        if (this.wordReplacements.has(word)) {
          words[i] = this.wordReplacements.get(word);
        }
      }
      
      return words.join('');
    } catch (error) {
      logger.error('Error applying word replacements:', error);
      return text;
    }
  }
  
  /**
   * Fix spacing issues in text
   * @param {string} text - Input text
   * @returns {string} Text with fixed spacing
   * @private
   */
  _fixSpacing(text) {
    if (!text) return '';
    
    try {
      let processedText = text;
      
      // Apply spacing cleanup patterns
      for (const [pattern, replacement] of this.cleanupPatterns) {
        processedText = processedText.replace(pattern, replacement);
      }
      
      return processedText;
    } catch (error) {
      logger.error('Error fixing spacing:', error);
      return text;
    }
  }
  
  /**
   * Fix punctuation issues in text
   * @param {string} text - Input text
   * @returns {string} Text with fixed punctuation
   * @private
   */
  _fixPunctuation(text) {
    if (!text) return '';
    
    try {
      let processedText = text;
      
      // Apply punctuation rules
      for (const [pattern, replacement] of this.punctuationRules) {
        processedText = processedText.replace(pattern, replacement);
      }
      
      return processedText;
    } catch (error) {
      logger.error('Error fixing punctuation:', error);
      return text;
    }
  }
  
  /**
   * Fix capitalization issues in text
   * @param {string} text - Input text
   * @returns {string} Text with fixed capitalization
   * @private
   */
  _fixCapitalization(text) {
    if (!text) return '';
    
    try {
      let processedText = text;
      
      // Capitalize first letter of the text
      if (processedText.length > 0) {
        processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1);
      }
      
      // Capitalize after periods, question marks, and exclamation marks
      processedText = processedText.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => {
        return p1 + p2.toUpperCase();
      });
      
      // Capitalize "I" when it's a word
      processedText = processedText.replace(/(\s|^)i(\s|$|[,.;:!?])/g, (match, p1, p2) => {
        return p1 + 'I' + p2;
      });
      
      return processedText;
    } catch (error) {
      logger.error('Error fixing capitalization:', error);
      return text;
    }
  }
  
  /**
   * Split text into chunks
   * @param {string} text - Text to split
   * @param {Object} options - Chunk options
   * @param {number} [options.maxChunkLength=200] - Maximum chunk length
   * @param {boolean} [options.preserveSentences=true] - Preserve sentences
   * @returns {Array<string>} Array of text chunks
   */
  splitIntoChunks(text, options = {}) {
    if (!text) return [];
    
    const maxLength = options.maxChunkLength || 200;
    const preserveSentences = options.preserveSentences !== false;
    
    try {
      // If text is short enough, return as single chunk
      if (text.length <= maxLength) {
        return [text];
      }
      
      let chunks = [];
      
      if (preserveSentences) {
        // Split by sentence boundaries
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        
        let currentChunk = '';
        
        for (const sentence of sentences) {
          // If adding this sentence would exceed max length, push current chunk
          if (currentChunk.length + sentence.length > maxLength && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
          
          // If sentence is too long on its own, split it
          if (sentence.length > maxLength) {
            // Push current chunk if it's not empty
            if (currentChunk.length > 0) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }
            
            // Split long sentence by words
            const words = sentence.split(/\s+/);
            let subChunk = '';
            
            for (const word of words) {
              if (subChunk.length + word.length + 1 > maxLength && subChunk.length > 0) {
                chunks.push(subChunk.trim());
                subChunk = '';
              }
              
              subChunk += (subChunk.length > 0 ? ' ' : '') + word;
            }
            
            // Add the last sub-chunk if not empty
            if (subChunk.length > 0) {
              currentChunk = subChunk.trim();
            }
          } else {
            currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
          }
        }
        
        // Push the last chunk if not empty
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
        }
      } else {
        // Simple splitting by max length
        for (let i = 0; i < text.length; i += maxLength) {
          chunks.push(text.substr(i, maxLength).trim());
        }
      }
      
      return chunks;
    } catch (error) {
      logger.error('Error splitting text into chunks:', error);
      // Fallback to simple split by max length
      const chunks = [];
      for (let i = 0; i < text.length; i += maxLength) {
        chunks.push(text.substr(i, maxLength).trim());
      }
      return chunks;
    }
  }
  
  /**
   * Detect potential commands in text
   * @param {string} text - Text to process
   * @returns {Object} Command info {isCommand, command, args}
   */
  detectCommand(text) {
    if (!text) {
      return { isCommand: false };
    }
    
    try {
      // Trim and normalize
      const normalizedText = text.trim().toLowerCase();
      
      // Command markers/prefixes
      const commandPrefixes = [
        'hey juno',
        'hey june',
        'hi juno', 
        'hi june',
        'juno',
        'june'
      ];
      
      // Check for command prefixes
      let isCommand = false;
      let commandText = normalizedText;
      
      for (const prefix of commandPrefixes) {
        if (normalizedText.startsWith(prefix)) {
          isCommand = true;
          // Extract actual command without prefix
          commandText = normalizedText.substring(prefix.length).trim();
          break;
        }
      }
      
      if (!isCommand) {
        return { isCommand: false };
      }
      
      // Extract command parts
      const parts = commandText.split(/\s+/);
      
      if (parts.length === 0) {
        return { isCommand: true, command: '', args: [] };
      }
      
      const command = parts[0];
      const args = parts.slice(1);
      
      return {
        isCommand: true,
        command,
        args,
        rawText: commandText
      };
    } catch (error) {
      logger.error('Error detecting command:', error);
      return { isCommand: false };
    }
  }
  
  /**
   * Format transcription timestamps
   * @param {number} timestamp - Timestamp in seconds
   * @param {Object} options - Formatting options
   * @param {boolean} [options.showMilliseconds=false] - Show milliseconds
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(timestamp, options = {}) {
    const showMs = options.showMilliseconds || false;
    
    try {
      if (isNaN(timestamp)) {
        return '';
      }
      
      const minutes = Math.floor(timestamp / 60);
      const seconds = Math.floor(timestamp % 60);
      
      if (showMs) {
        const ms = Math.floor((timestamp % 1) * 1000);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
      } else {
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    } catch (error) {
      logger.error('Error formatting timestamp:', error);
      return '';
    }
  }
  
  /**
   * Check spelling in text
   * @param {string} text - Text to check
   * @returns {Array<Object>} Array of spelling issues
   */
  async checkSpelling(text) {
    if (!text) return [];
    
    try {
      // Use dictionary service for spell checking
      if (!this.dictionaryService) {
        logger.warn('Dictionary service not available for spell checking');
        return [];
      }
      
      return await this.dictionaryService.checkSpelling(text);
    } catch (error) {
      logger.error('Error checking spelling:', error);
      return [];
    }
  }
  
  /**
   * Strip specified characters from text
   * @param {string} text - Text to process
   * @param {Object} options - Options for stripping
   * @param {boolean} [options.stripPunctuation=false] - Strip punctuation
   * @param {boolean} [options.stripNumbers=false] - Strip numbers
   * @param {boolean} [options.stripSpecialChars=false] - Strip special characters
   * @param {boolean} [options.lowerCase=false] - Convert to lowercase
   * @returns {string} Processed text
   */
  stripCharacters(text, options = {}) {
    if (!text) return '';
    
    try {
      let processedText = text;
      
      // Strip punctuation if requested
      if (options.stripPunctuation) {
        processedText = processedText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
      }
      
      // Strip numbers if requested
      if (options.stripNumbers) {
        processedText = processedText.replace(/[0-9]/g, '');
      }
      
      // Strip special characters if requested
      if (options.stripSpecialChars) {
        processedText = processedText.replace(/[^\w\s]/g, '');
      }
      
      // Convert to lowercase if requested
      if (options.lowerCase) {
        processedText = processedText.toLowerCase();
      }
      
      return processedText.trim();
    } catch (error) {
      logger.error('Error stripping characters:', error);
      return text;
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => {
  return new TextProcessingService();
}; 