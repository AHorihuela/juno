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
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Test Component */}
      <div className="bg-blue-500 text-white p-4 rounded-lg shadow-lg mb-8">
        <h1 className="text-2xl font-bold">Tailwind Test</h1>
        <p className="mt-2">If you can see this styled in blue with white text, Tailwind is working!</p>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <header className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Juno</h1>
            <p className="text-sm text-gray-600 mt-1">AI-Powered Dictation Tool</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
                ${showHistory 
                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}
            >
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
                ${showSettings 
                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}
            >
              {showSettings ? 'Hide Settings' : 'Settings'}
            </button>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Status Section */}
        <div className="mb-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
            <h2 className="text-xl font-semibold text-gray-900">
              {isRecording ? 'Recording...' : 'Ready to Record'}
            </h2>
          </div>
          <div className="space-y-2">
            <p className="text-gray-600">
              Double-tap <code className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">{shortcutText}</code> to {isRecording ? 'stop' : 'start'} recording
            </p>
            <p className="text-gray-600">
              Press <code className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">Esc</code> to cancel recording
            </p>
          </div>
        </div>

        {/* Transcription Display */}
        {transcription && (
          <div className="mb-6 overflow-hidden">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Latest Transcription</h3>
            <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
              <p className="text-gray-700 whitespace-pre-wrap">{transcription}</p>
            </div>
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