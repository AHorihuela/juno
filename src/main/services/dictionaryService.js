const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class DictionaryService {
  constructor() {
    this.words = new Set();
    this.dictionaryPath = path.join(app.getPath('userData'), 'userDictionary.json');
    this.initializeDictionary();
  }

  initializeDictionary() {
    console.log('Initializing dictionary at:', this.dictionaryPath);
    try {
      if (!fs.existsSync(this.dictionaryPath)) {
        console.log('Dictionary file does not exist, creating...');
        fs.writeFileSync(this.dictionaryPath, JSON.stringify([], null, 2), 'utf8');
      }
      this.loadDictionary();
    } catch (error) {
      console.error('Error initializing dictionary:', error);
      // Create an empty dictionary if there's an error
      this.words = new Set();
    }
  }

  loadDictionary() {
    console.log('Loading dictionary from:', this.dictionaryPath);
    try {
      const data = fs.readFileSync(this.dictionaryPath, 'utf8');
      const words = JSON.parse(data);
      this.words = new Set(words);
      console.log('Dictionary loaded successfully with', this.words.size, 'words');
    } catch (error) {
      console.error('Error loading dictionary:', error);
      this.words = new Set();
    }
  }

  saveDictionary() {
    console.log('Saving dictionary...');
    try {
      const words = Array.from(this.words);
      fs.writeFileSync(this.dictionaryPath, JSON.stringify(words, null, 2), 'utf8');
      console.log('Dictionary saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving dictionary:', error);
      return false;
    }
  }

  async getAllWords() {
    return Array.from(this.words).sort();
  }

  async addWord(word) {
    if (!word || typeof word !== 'string') {
      throw new Error('Invalid word');
    }

    const trimmedWord = word.trim();
    if (!trimmedWord) {
      throw new Error('Word cannot be empty');
    }

    console.log('Adding word to dictionary:', trimmedWord);
    this.words.add(trimmedWord);
    return this.saveDictionary();
  }

  async removeWord(word) {
    if (!word || typeof word !== 'string') {
      throw new Error('Invalid word');
    }

    console.log('Removing word from dictionary:', word);
    const result = this.words.delete(word);
    if (result) {
      return this.saveDictionary();
    }
    return false;
  }

  processText(text) {
    if (!text) return '';
    
    let processed = text;
    // Split text into words while preserving punctuation and spacing
    const words = processed.split(/(\b\w+\b)/);
    
    // Process each word
    processed = words.map(part => {
      // If it's not a word (punctuation/space), preserve it
      if (!/^\w+$/.test(part)) {
        return part;
      }
      // Check if the word is in our dictionary
      return this.words.has(part) ? part : part;
    }).join('');
    
    return processed;
  }
}

// Create and export a singleton instance
const dictionaryService = new DictionaryService();
module.exports = dictionaryService; 