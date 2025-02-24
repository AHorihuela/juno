import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { getIpcRenderer } from './utils/electron';

// Import components
import MainLayout from './layouts/MainLayout';
import Home from './components/Home';
import Settings from './components/Settings';
import TranscriptionHistory from './components/TranscriptionHistory';
import DictionaryManager from './components/DictionaryManager';
import AIRules from './components/AIRules';

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [settings, setSettings] = useState({});

  useEffect(() => {
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) return;

    // Load settings
    ipcRenderer.invoke('get-settings').then(setSettings);

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
    <MainLayout>
      <Routes>
        <Route path="/" element={
          <Home 
            isRecording={isRecording} 
            error={error} 
            transcription={transcription}
            settings={settings}
          />
        } />
        <Route path="/dictionary" element={<DictionaryManager />} />
        <Route path="/ai-rules" element={<AIRules />} />
        <Route path="/history" element={<TranscriptionHistory />} />
        <Route path="/settings/*" element={<Settings />} />
      </Routes>
    </MainLayout>
  );
};

export default App; 