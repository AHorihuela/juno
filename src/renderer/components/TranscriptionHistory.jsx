import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';

const TranscriptionHistory = () => {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) return;

    // Get initial history
    ipcRenderer.send('get-transcription-history');

    // Listen for history updates
    ipcRenderer.on('transcription-history', (_, data) => {
      setHistory(data);
    });

    // Listen for errors
    ipcRenderer.on('transcription-history-error', (_, errorMessage) => {
      setError(errorMessage);
    });

    // Listen for new transcriptions
    ipcRenderer.on('transcription', (_, text) => {
      ipcRenderer.send('get-transcription-history');
    });

    return () => {
      ipcRenderer.removeAllListeners('transcription-history');
      ipcRenderer.removeAllListeners('transcription-history-error');
      ipcRenderer.removeAllListeners('transcription');
    };
  }, []);

  const handleDelete = (id) => {
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) return;
    ipcRenderer.send('delete-transcription', id);
  };

  const handleClear = () => {
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) return;
    ipcRenderer.send('clear-transcription-history');
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Clear All button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Transcriptions</h2>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Transcription List */}
      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">
          <p>No transcriptions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 mb-2 whitespace-pre-wrap">
                    {entry.text}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(entry.timestamp)}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-gray-400 hover:text-gray-500 flex-shrink-0"
                  title="Delete transcription"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TranscriptionHistory; 