import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from './utils/electron';
import Settings from './components/Settings';
import TranscriptionHistory from './components/TranscriptionHistory';

// Import the bird icon
import birdIcon from '../../assets/icon.png';

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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src={birdIcon} 
              alt="Juno" 
              className="w-12 h-12" 
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Juno</h1>
              <p className="text-sm text-gray-600">AI-Powered Dictation Tool</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            >
              Show History
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-4">
        <div className="max-w-2xl mx-auto">
          {/* Error Display */}
          {error && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Recording Status Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className={`w-4 h-4 rounded-full ${
                isRecording 
                  ? 'bg-red-500 animate-pulse' 
                  : 'bg-green-500'
              }`} />
              <h2 className="text-2xl font-semibold text-gray-900">
                {isRecording ? 'Recording...' : 'Ready to Record'}
              </h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center">
                <span className="text-gray-600 w-24">Start/Stop:</span>
                <span className="px-3 py-1.5 bg-gray-50 rounded text-sm text-gray-900">
                  Space
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 w-24">Cancel:</span>
                <span className="px-3 py-1.5 bg-gray-50 rounded text-sm text-gray-900">
                  Esc
                </span>
              </div>
            </div>
          </div>

          {/* Latest Transcription */}
          {transcription && (
            <div className="mt-6 bg-white rounded-lg border border-gray-200">
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
      </main>
    </div>
  );
};

export default App; 