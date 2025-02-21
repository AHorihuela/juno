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
    <div className="dictionary-container">
      <h2>Your dictionary</h2>
      <p className="subtitle">Add words that you want Flow to remember</p>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="add-word-container">
        <input
          type="text"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          placeholder="Add a new word"
          className="word-input"
        />
        <button 
          onClick={handleAddWord}
          className="add-button"
          disabled={!newWord.trim()}
        >
          Add to dictionary
        </button>
      </div>

      <div className="words-section">
        <h3>Your words ({words.length})</h3>
        <div className="words-list">
          {words.map((word) => (
            <div key={word} className="word-item">
              <span className="word-text">{word}</span>
              <div className="word-actions">
                <button
                  className="action-button edit"
                  onClick={() => {
                    setNewWord(word);
                    handleRemoveWord(word);
                  }}
                >
                  <span role="img" aria-label="edit">✏️</span>
                </button>
                <button
                  className="action-button delete"
                  onClick={() => handleRemoveWord(word)}
                >
                  <span role="img" aria-label="delete">🗑️</span>
                </button>
              </div>
            </div>
          ))}
          {words.length === 0 && (
            <p className="no-words">No words in your dictionary yet</p>
          )}
        </div>
      </div>

      <style jsx>{`
        .dictionary-container {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        h2 {
          font-size: 24px;
          margin-bottom: 8px;
          color: #333;
        }

        .subtitle {
          color: #666;
          margin-bottom: 24px;
        }

        .add-word-container {
          display: flex;
          gap: 12px;
          margin-bottom: 32px;
        }

        .word-input {
          flex: 1;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 16px;
        }

        .add-button {
          padding: 12px 24px;
          background-color: #6b7280;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
        }

        .add-button:hover {
          background-color: #4b5563;
        }

        .add-button:disabled {
          background-color: #d1d5db;
          cursor: not-allowed;
        }

        .words-section {
          background-color: #f9fafb;
          border-radius: 12px;
          padding: 24px;
        }

        h3 {
          font-size: 18px;
          color: #374151;
          margin-bottom: 16px;
        }

        .words-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .word-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background-color: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .word-text {
          font-size: 16px;
          color: #111827;
        }

        .word-actions {
          display: flex;
          gap: 8px;
        }

        .action-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .action-button:hover {
          opacity: 1;
        }

        .no-words {
          text-align: center;
          color: #6b7280;
          font-style: italic;
          padding: 24px;
        }

        .error-message {
          background-color: #fee2e2;
          color: #991b1b;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
};

export default DictionaryManager; 