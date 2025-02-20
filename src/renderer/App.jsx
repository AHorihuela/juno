import React, { useState, useEffect } from 'react';

// Get electron IPC renderer safely
const getIpcRenderer = () => {
  try {
    return window.require('electron').ipcRenderer;
  } catch (e) {
    console.warn('Failed to load electron IPC, are we in a test environment?');
    return null;
  }
};

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

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

    // Cleanup listeners
    return () => {
      ipcRenderer.removeAllListeners('recording-status');
      ipcRenderer.removeAllListeners('recording-error');
      ipcRenderer.removeAllListeners('error');
    };
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dictation Tool</h1>
      
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
            color: '#d32f2f'
          }}>
            Error: {error}
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
    </div>
  );
};

export default App; 