import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { getIpcRenderer } from './utils/electron';
import { runIpcTest } from './utils/test-ipc';

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
  const [testResult, setTestResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Run IPC test
    console.log('[App] Running IPC communication test...');
    const result = runIpcTest();
    setTestResult(result);
    console.log('[App] IPC test result:', result);

    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) {
      console.error('[App] Failed to get ipcRenderer, application will have limited functionality');
      setError('IPC communication failed. The application will have limited functionality.');
      return;
    }

    // Load settings
    ipcRenderer.invoke('get-settings')
      .then(setSettings)
      .catch(err => {
        console.error('[App] Error loading settings:', err);
        setError(`Failed to load settings: ${err.message}`);
      });

    // Listen for recording status changes
    try {
      ipcRenderer.on('recording-status', (status) => {
        setIsRecording(status);
        if (status) {
          setError(null);
        }
      });

      // Listen for recording errors
      ipcRenderer.on('recording-error', (errorMessage) => {
        setError(errorMessage);
        setIsRecording(false);
      });

      // Listen for general errors
      ipcRenderer.on('error', (errorMessage) => {
        setError(errorMessage);
      });

      // Listen for transcriptions
      ipcRenderer.on('transcription', (text) => {
        console.log('[App] Received transcription:', text);
        
        // Ensure we're treating this as a string
        const transcriptionText = typeof text === 'string' ? text : 
                                 (text && text.toString ? text.toString() : 'Transcription received');
        
        setTranscription(transcriptionText);
        
        // Debug: Verify state update after state has been updated
        setTimeout(() => {
          // Use a function ref to get the latest state value
          const latestTranscription = document.querySelector('.Latest-Transcription p');
          console.log('[App] Current transcription state:', transcriptionText);
          console.log('[App] Transcription in DOM:', latestTranscription ? latestTranscription.textContent : 'Element not found');
        }, 100);
      });

      // Listen for navigation events from the main process
      ipcRenderer.on('navigate', (route) => {
        console.log('[App] Navigating to route:', route);
        navigate(route);
      });
    } catch (err) {
      console.error('[App] Error setting up event listeners:', err);
      setError(`Failed to set up event listeners: ${err.message}`);
    }

    // Cleanup listeners
    return () => {
      if (ipcRenderer && ipcRenderer.removeAllListeners) {
        try {
          ipcRenderer.removeAllListeners('recording-status');
          ipcRenderer.removeAllListeners('recording-error');
          ipcRenderer.removeAllListeners('error');
          ipcRenderer.removeAllListeners('transcription');
          ipcRenderer.removeAllListeners('navigate');
        } catch (err) {
          console.error('[App] Error removing event listeners:', err);
        }
      }
    };
  }, [navigate]);

  return (
    <MainLayout>
      {testResult === false && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f8d7da',
          color: '#721c24',
          marginBottom: '10px',
          borderRadius: '4px'
        }}>
          IPC Test Result: FAILED
        </div>
      )}
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