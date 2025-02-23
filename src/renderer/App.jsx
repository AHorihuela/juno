import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { getIpcRenderer } from './utils/electron';
import Settings from './components/Settings';
import TranscriptionHistory from './components/TranscriptionHistory';
import DictionaryManager from './components/DictionaryManager';

// Import the bird icon
import birdIcon from '../../assets/icon.png';

const Home = ({ isRecording, error, transcription }) => (
  <>
    {/* Error Display */}
    {error && (
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
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
  </>
);

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [transcription, setTranscription] = useState('');
  const location = useLocation();

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

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - Fixed */}
      <aside className="fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <img src={birdIcon} alt="Juno" className="w-10 h-10" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Juno</h1>
              <p className="text-xs text-gray-600">AI-Powered Dictation</p>
            </div>
          </div>

          <nav className="space-y-1">
            <Link
              to="/"
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${location.pathname === '/' 
                  ? 'bg-gray-100 text-gray-900' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </Link>

            <Link
              to="/dictionary"
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${location.pathname.startsWith('/dictionary')
                  ? 'bg-gray-100 text-gray-900' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Dictionary
            </Link>

            <Link
              to="/history"
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${location.pathname.startsWith('/history')
                  ? 'bg-gray-100 text-gray-900' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              History
            </Link>

            <Link
              to="/settings"
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${location.pathname.startsWith('/settings')
                  ? 'bg-gray-100 text-gray-900' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content - Scrollable */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-3xl mx-auto">
          <Routes>
            <Route path="/" element={<Home isRecording={isRecording} error={error} transcription={transcription} />} />
            <Route path="/dictionary" element={<DictionaryManager />} />
            <Route path="/history" element={<TranscriptionHistory />} />
            <Route path="/settings/*" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default App; 