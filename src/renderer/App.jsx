import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from './utils/electron';
import Settings from './components/Settings';

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [showSettings, setShowSettings] = useState(false);

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
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Dictation Tool</h1>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {showSettings ? 'Back to App' : 'Settings'}
        </button>
      </div>

      {showSettings ? (
        <Settings />
      ) : (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            padding: '10px',
            backgroundColor: isRecording ? '#ffebee' : '#f1f8e9',
            borderRadius: '4px',
            marginBottom: '10px'
          }}>
            Status: {isRecording ? 'Recording...' : 'Ready'}
          </div>

          {error && (
            <div style={{
              padding: '10px',
              backgroundColor: '#fff3e0',
              borderRadius: '4px',
              color: '#d32f2f',
              marginBottom: '10px'
            }}>
              Error: {error}
            </div>
          )}

          {transcription && (
            <div style={{
              padding: '10px',
              backgroundColor: '#e8f5e9',
              borderRadius: '4px',
              marginBottom: '10px'
            }}>
              <strong>Last Transcription:</strong>
              <p>{transcription}</p>
            </div>
          )}

          <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
            <p>Keyboard Shortcuts:</p>
            <ul>
              <li>Double-tap F6: Start recording</li>
              <li>Single-tap F6: Stop recording</li>
              <li>Esc: Stop recording</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default App; 