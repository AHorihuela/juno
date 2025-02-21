import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from './utils/electron';
import Settings from './components/Settings';
import TranscriptionHistory from './components/TranscriptionHistory';

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

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
    <div className="min-h-screen bg-gray-50 px-6 py-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Juno</h1>
          <p className="text-sm text-gray-600 mt-0.5">AI-Powered Dictation Tool</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
              bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50
              focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500"
          >
            {showHistory ? 'Hide History' : 'Show History'}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
              bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50
              focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500"
          >
            {showSettings ? 'Hide Settings' : 'Settings'}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
            <div className="flex items-center gap-2 text-red-700">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Recording Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-3 h-3 rounded-full transition-colors ${
              isRecording 
                ? 'bg-red-500 animate-pulse' 
                : 'bg-green-500'
            }`} />
            <h2 className="text-xl font-semibold text-gray-900">
              {isRecording ? 'Recording...' : 'Ready to Record'}
            </h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-[5.5rem] text-sm text-gray-600">Start/Stop:</span>
              <code className="px-2.5 py-1.5 bg-gray-50 rounded-md font-mono text-sm text-gray-700 border border-gray-200">
                {shortcutText}
              </code>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-[5.5rem] text-sm text-gray-600">Cancel:</span>
              <code className="px-2.5 py-1.5 bg-gray-50 rounded-md font-mono text-sm text-gray-700 border border-gray-200">
                Esc
              </code>
            </div>
          </div>
        </div>

        {/* Latest Transcription */}
        {transcription && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden transition-shadow hover:shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2">
              <h3 className="text-sm font-medium text-gray-700">Latest Transcription</h3>
            </div>
            <div className="p-4">
              <p className="text-gray-700 whitespace-pre-wrap">{transcription}</p>
            </div>
          </div>
        )}

        {/* Settings */}
        {showSettings && <Settings />}

        {/* History */}
        {showHistory && <TranscriptionHistory />}
      </div>
    </div>
  );
};

export default App; 