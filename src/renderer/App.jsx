import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from './utils/electron';
import Settings from './components/Settings';
import TranscriptionHistory from './components/TranscriptionHistory';

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) return;

    // Listen for recording status changes
    ipcRenderer.on('recording-status', (_, status) => {
      setIsRecording(status);
      if (status) {
        setError(null);
      }
    });

    // Listen for recording errors
    ipcRenderer.on('recording-error', (_, errorMessage) => {
      setError(errorMessage);
      setIsRecording(false);
    });

    // Listen for general errors
    ipcRenderer.on('error', (_, errorMessage) => {
      setError(errorMessage);
    });

    // Listen for transcriptions
    ipcRenderer.on('transcription', (_, text) => {
      setTranscription(text);
    });

    // Cleanup listeners
    return () => {
      ipcRenderer.removeAllListeners('recording-status');
      ipcRenderer.removeAllListeners('recording-error');
      ipcRenderer.removeAllListeners('error');
      ipcRenderer.removeAllListeners('transcription');
    };
  }, []);

  const isMac = process.platform === 'darwin';
  const shortcutText = isMac ? '⌘ ⇧ Space' : 'Ctrl + Shift + Space';

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Juno</h1>
          <p className="text-gray-600">AI-Powered Dictation Tool</p>
          
          <div className="mt-4 space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              {showSettings ? 'Hide Settings' : 'Settings'}
            </button>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Status Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded shadow-sm">
          <h2 className="text-xl font-semibold mb-2">
            {isRecording ? 'Recording...' : 'Ready to Record'}
          </h2>
          <p className="text-gray-600">
            Double-tap <code className="bg-gray-100 px-1 rounded">{shortcutText}</code> to start recording
          </p>
          <p className="text-gray-600">
            Press <code className="bg-gray-100 px-1 rounded">Esc</code> to cancel recording
          </p>
        </div>

        {/* Transcription Display */}
        {transcription && (
          <div className="p-4 bg-gray-50 rounded shadow-sm">
            <h3 className="font-medium mb-2">Latest Transcription</h3>
            <p className="whitespace-pre-wrap">{transcription}</p>
          </div>
        )}

        {/* Settings and History */}
        {showSettings && <Settings />}
        {showHistory && <TranscriptionHistory />}
      </div>
    </div>
  );
};

export default App; 