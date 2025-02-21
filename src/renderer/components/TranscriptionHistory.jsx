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
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Recent Transcriptions</h2>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>
      
      {history.length === 0 ? (
        <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-lg">No transcriptions yet</p>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-500 flex-shrink-0">
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap break-words">
                    {entry.text}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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