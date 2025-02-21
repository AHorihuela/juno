import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';

const DictionaryManager = () => {
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    console.log('Loading dictionary words...');
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }
      const loadedWords = await ipcRenderer.invoke('get-dictionary-words');
      console.log('Loaded dictionary words:', loadedWords);
      setWords(loadedWords);
      setError(null);
    } catch (error) {
      console.error('Error loading dictionary words:', error);
      setError('Failed to load dictionary');
      setWords([]);
    }
  };

  const handleAddWord = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const word = newWord.trim();
    if (!word) {
      return;
    }

    console.log('Adding word to dictionary:', word);
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }
      await ipcRenderer.invoke('add-dictionary-word', word);
      console.log('Word added successfully:', word);
      
      // Reset form and reload words
      setNewWord('');
      await loadWords();
      setSuccess(true);
    } catch (error) {
      console.error('Error adding word:', error);
      setError(error.message || 'Failed to add word');
    }
  };

  const handleRemoveWord = async (word) => {
    console.log('Removing word from dictionary:', word);
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }
      await ipcRenderer.invoke('remove-dictionary-word', word);
      console.log('Word removed successfully:', word);
      await loadWords();
      setSuccess(true);
    } catch (error) {
      console.error('Error removing word:', error);
      setError(error.message || 'Failed to remove word');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-5">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Your dictionary</h2>
      <p className="text-gray-600 mb-6">Add words that you want Flow to remember</p>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          Word updated successfully!
        </div>
      )}

      <div className="flex gap-3 mb-8">
        <input
          type="text"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          placeholder="Add a new word"
          className="input flex-1"
        />
        <button 
          onClick={handleAddWord}
          className={`btn ${newWord.trim() ? 'btn-primary' : 'btn-disabled'}`}
          disabled={!newWord.trim()}
        >
          Add to dictionary
        </button>
      </div>

      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Your words ({words.length})</h3>
        <div className="space-y-3">
          {words.map((word) => (
            <div key={word} className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-200">
              <span className="text-gray-900">{word}</span>
              <div className="flex gap-2">
                <button
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  onClick={() => {
                    setNewWord(word);
                    handleRemoveWord(word);
                  }}
                >
                  <span role="img" aria-label="edit">✏️</span>
                </button>
                <button
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                  onClick={() => handleRemoveWord(word)}
                >
                  <span role="img" aria-label="delete">🗑️</span>
                </button>
              </div>
            </div>
          ))}
          {words.length === 0 && (
            <p className="text-center text-gray-500 italic py-6">No words in your dictionary yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DictionaryManager; 