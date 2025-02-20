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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Juno</h1>
            <p className="text-sm text-gray-500 mt-1">AI-Powered Dictation Tool</p>
          </div>
          <div className="space-x-3">
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
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="mb-8">
          <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                  <h2 className="text-xl font-semibold text-gray-900">
                    {isRecording ? 'Recording...' : 'Ready to Record'}
                  </h2>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    Double-tap <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{shortcutText}</span> to {isRecording ? 'stop' : 'start'} recording
                  </p>
                  <p className="text-sm text-gray-600">
                    Press <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">Esc</span> to cancel recording
                  </p>
                </div>
              </div>
            </div>
            
            {/* Transcription Display */}
            {transcription && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Latest Transcription</h3>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-gray-700 whitespace-pre-wrap">{transcription}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settings and History */}
        {showSettings && <Settings />}
        {showHistory && <TranscriptionHistory />}
      </div>
    </div>
  );
};

export default App; 