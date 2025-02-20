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
      <div className="p-4 text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Recent Transcriptions</h2>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50"
          >
            Clear All
          </button>
        )}
      </div>
      
      {history.length === 0 ? (
        <p className="text-gray-500">No transcriptions yet</p>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-gray-500">
                  {formatDate(entry.timestamp)}
                </span>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-gray-400 hover:text-red-600"
                  title="Delete"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap">{entry.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TranscriptionHistory; 