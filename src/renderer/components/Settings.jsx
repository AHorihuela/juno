import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';

const Settings = () => {
  const [settings, setSettings] = useState({
    openaiApiKey: '',
    aiTriggerWord: 'juno',
    aiModel: 'gpt-4',
    aiTemperature: 0.7,
    startupBehavior: 'minimized',
    defaultMicrophone: '',
  });

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [microphones, setMicrophones] = useState([]);

  useEffect(() => {
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) return;

    // Load initial settings
    ipcRenderer.send('get-settings');
    ipcRenderer.on('settings-loaded', (_, loadedSettings) => {
      setSettings(loadedSettings);
      setLoading(false);
    });

    // Load available microphones using the new invoke method
    const loadMicrophones = async () => {
      try {
        const devices = await ipcRenderer.invoke('get-microphones');
        setMicrophones(devices);
      } catch (error) {
        setError(error.message);
      }
    };
    loadMicrophones();

    // Handle errors
    ipcRenderer.on('settings-error', (_, errorMessage) => {
      setError(errorMessage);
      setLoading(false);
    });

    return () => {
      ipcRenderer.removeAllListeners('settings-loaded');
      ipcRenderer.removeAllListeners('settings-error');
    };
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) {
      setError('IPC not available');
      return;
    }

    try {
      ipcRenderer.send('save-settings', settings);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="settings-container">
      <h2>Settings</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {success && (
        <div className="success-message">
          Settings saved successfully!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="setting-group">
          <h3>OpenAI Configuration</h3>
          
          <label>
            API Key
            <input
              type="password"
              value={settings.openaiApiKey}
              onChange={(e) => handleChange('openaiApiKey', e.target.value)}
              placeholder="sk-..."
            />
          </label>

          <label>
            AI Model
            <select
              value={settings.aiModel}
              onChange={(e) => handleChange('aiModel', e.target.value)}
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </label>

          <label>
            Temperature
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.aiTemperature}
              onChange={(e) => handleChange('aiTemperature', parseFloat(e.target.value))}
            />
            <span>{settings.aiTemperature}</span>
          </label>
        </div>

        <div className="setting-group">
          <h3>Voice Commands</h3>
          
          <label>
            Trigger Word
            <input
              type="text"
              value={settings.aiTriggerWord}
              onChange={(e) => handleChange('aiTriggerWord', e.target.value)}
              placeholder="juno"
            />
          </label>
        </div>

        <div className="setting-group">
          <h3>Application Settings</h3>
          
          <label>
            Startup Behavior
            <select
              value={settings.startupBehavior}
              onChange={(e) => handleChange('startupBehavior', e.target.value)}
            >
              <option value="minimized">Start Minimized</option>
              <option value="normal">Show Window</option>
            </select>
          </label>

          <label>
            Default Microphone
            <select
              value={settings.defaultMicrophone}
              onChange={(e) => handleChange('defaultMicrophone', e.target.value)}
            >
              <option value="">System Default</option>
              {microphones.map(device => (
                <option key={device.id} value={device.id}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="button-group">
          <button type="submit">
            Save Settings
          </button>
        </div>
      </form>

      <style jsx>{`
        .settings-container {
          padding: 20px;
          max-width: 600px;
          margin: 0 auto;
        }

        .setting-group {
          margin-bottom: 24px;
          padding: 16px;
          border: 1px solid #eee;
          border-radius: 8px;
        }

        h2 {
          margin-bottom: 24px;
          color: #333;
        }

        h3 {
          margin-bottom: 16px;
          color: #666;
        }

        label {
          display: block;
          margin-bottom: 16px;
          color: #333;
        }

        input, select {
          display: block;
          width: 100%;
          padding: 8px;
          margin-top: 4px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        input[type="range"] {
          width: calc(100% - 40px);
          display: inline-block;
        }

        .error-message {
          padding: 12px;
          background-color: #fee;
          color: #c00;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .success-message {
          padding: 12px;
          background-color: #efe;
          color: #0c0;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .button-group {
          margin-top: 24px;
          text-align: right;
        }

        button {
          padding: 8px 16px;
          background-color: #0066cc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        button:hover {
          background-color: #0052a3;
        }
      `}</style>
    </div>
  );
};

export default Settings; 