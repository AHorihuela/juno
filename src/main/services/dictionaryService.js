const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class DictionaryService {
  constructor() {
    this.dictionaryPath = path.join(app.getPath('userData'), 'userDictionary.json');
    this.dictionary = new Map();
    this.loadDictionary();
  }

  /**
   * Load dictionary from disk
   * @private
   */
  loadDictionary() {
    try {
      if (fs.existsSync(this.dictionaryPath)) {
        const data = fs.readFileSync(this.dictionaryPath, 'utf8');
        const entries = JSON.parse(data);
        this.dictionary.clear();
        Object.entries(entries).forEach(([incorrect, correct]) => {
          this.dictionary.set(incorrect, correct);
        });
      }
    } catch (error) {
      console.error('Error loading dictionary:', error);
      // If loading fails, we'll start with an empty dictionary
      this.dictionary.clear();
    }
  }

  /**
   * Save dictionary to disk
   * @private
   */
  saveDictionary() {
    try {
      const entries = Object.fromEntries(this.dictionary);
      fs.writeFileSync(this.dictionaryPath, JSON.stringify(entries, null, 2));
    } catch (error) {
      console.error('Error saving dictionary:', error);
      throw new Error('Failed to save dictionary');
    }
  }

  /**
   * Add a new dictionary entry
   * @param {string} incorrect - The incorrect word
   * @param {string} correct - The correct replacement
   * @returns {boolean} - Whether the entry was added successfully
   */
  addEntry(incorrect, correct) {
    if (!incorrect || !correct) {
      throw new Error('Both incorrect and correct words must be provided');
    }

    // Check for case-insensitive duplicates
    const hasDuplicate = Array.from(this.dictionary.keys()).some(
      key => key.toLowerCase() === incorrect.toLowerCase() && key !== incorrect
    );

    if (hasDuplicate) {
      throw new Error('A case-insensitive duplicate entry already exists');
    }

    this.dictionary.set(incorrect, correct);
    this.saveDictionary();
    return true;
  }

  /**
   * Remove a dictionary entry
   * @param {string} incorrect - The incorrect word to remove
   * @returns {boolean} - Whether the entry was removed
   */
  removeEntry(incorrect) {
    const removed = this.dictionary.delete(incorrect);
    if (removed) {
      this.saveDictionary();
    }
    return removed;
  }

  /**
   * Get all dictionary entries
   * @returns {Object} - Dictionary entries as key-value pairs
   */
  getAllEntries() {
    return Object.fromEntries(this.dictionary);
  }

  /**
   * Replace words in text according to dictionary
   * @param {string} text - Input text
   * @returns {string} - Text with replacements applied
   */
  processText(text) {
    if (!text || this.dictionary.size === 0) return text;

    // Split text into words while preserving punctuation and spacing
    const words = text.split(/(\s+|[.,!?;])/);
    
    return words.map(word => {
      // Skip empty strings, whitespace, and punctuation
      if (!word.trim() || /^[\s.,!?;]+$/.test(word)) return word;
      
      // Check for exact match (case-sensitive)
      const replacement = this.dictionary.get(word);
      return replacement || word;
    }).join('');
  }
}

// Export singleton instance
const dictionaryService = new DictionaryService();
module.exports = dictionaryService; 