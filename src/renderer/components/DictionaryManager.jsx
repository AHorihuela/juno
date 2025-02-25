import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';

const DictionaryManager = () => {
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [ipcTestResult, setIpcTestResult] = useState('PENDING');

  useEffect(() => {
    // Test if IPC is working
    testIpcConnection();
    loadWords();
  }, []);

  const testIpcConnection = async () => {
    try {
      const ipcRenderer = getIpcRenderer();
      console.log('IPC renderer available:', !!ipcRenderer);
      if (ipcRenderer) {
        console.log('IPC methods available:', {
          invoke: typeof ipcRenderer.invoke === 'function',
          on: typeof ipcRenderer.on === 'function',
          send: typeof ipcRenderer.send === 'function',
          removeAllListeners: typeof ipcRenderer.removeAllListeners === 'function'
        });
        setIpcTestResult('PASSED');
      } else {
        console.error('IPC renderer not available');
        setIpcTestResult('FAILED');
      }
    } catch (error) {
      console.error('Error testing IPC connection:', error);
      setIpcTestResult('ERROR');
    }
  };

  const loadWords = async () => {
    console.log('Loading dictionary words...');
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        console.error('IPC renderer not available for loading words');
        throw new Error('IPC renderer not available');
      }
      
      console.log('Invoking get-dictionary-words...');
      const loadedWords = await ipcRenderer.invoke('get-dictionary-words');
      console.log('Dictionary words loaded:', loadedWords);
      
      setWords(loadedWords || []);
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

    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }
      await ipcRenderer.invoke('add-dictionary-word', word);
      
      setNewWord('');
      await loadWords();
      setSuccess(true);
    } catch (error) {
      setError(error.message || 'Failed to add word');
    }
  };

  const handleRemoveWord = async (word) => {
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }
      await ipcRenderer.invoke('remove-dictionary-word', word);
      await loadWords();
      setSuccess(true);
    } catch (error) {
      setError(error.message || 'Failed to remove word');
    }
  };

  return (
    <div>
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
        IPC Test Result: {ipcTestResult}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          Dictionary updated successfully!
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-base font-medium text-gray-900 mb-2">Add New Word</h3>
        <p className="text-sm text-gray-500 mb-4">
          Add words that you want Juno to recognize accurately during transcription.
        </p>
        <form onSubmit={handleAddWord} className="flex gap-3">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="Enter a word or phrase"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button 
            type="submit"
            disabled={!newWord.trim()}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              newWord.trim()
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Add to Dictionary
          </button>
        </form>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium text-gray-900">
            Dictionary Words
            <span className="ml-2 text-sm text-gray-500">({words.length})</span>
          </h3>
        </div>

        {words.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No words in your dictionary yet</p>
            <p className="text-sm text-gray-400 mt-1">Add words above to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {words.map((word) => (
              <div 
                key={word}
                className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-lg border border-gray-200"
              >
                <span className="text-gray-900">{word}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setNewWord(word);
                      handleRemoveWord(word);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md
                      hover:bg-gray-100"
                    title="Edit word"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRemoveWord(word)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md
                      hover:bg-gray-100"
                    title="Remove word"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DictionaryManager; 