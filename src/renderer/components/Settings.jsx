import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';
import DictionaryManager from './DictionaryManager';

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
    console.log('Settings component mounted');
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) {
      console.error('IPC renderer not available');
      return;
    }
    console.log('IPC renderer available');

    // Load initial settings
    const loadSettings = async () => {
      console.log('Loading settings...');
      try {
        console.log('Invoking get-settings...');
        const loadedSettings = await ipcRenderer.invoke('get-settings');
        console.log('Settings loaded:', loadedSettings);
        setSettings(loadedSettings);
        setLoading(false);
      } catch (error) {
        console.error('Error loading settings:', error);
        setError(error.message);
        setLoading(false);
      }
    };
    loadSettings();

    // Load available microphones
    const loadMicrophones = async () => {
      console.log('Loading microphones...');
      try {
        const devices = await ipcRenderer.invoke('get-microphones');
        console.log('Microphones loaded:', devices);
        setMicrophones(devices);
      } catch (error) {
        console.error('Error loading microphones:', error);
        setError(error.message);
      }
    };
    loadMicrophones();

    return () => {
      // No need to remove listeners since we're using invoke
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
      console.log('Saving settings...', {
        ...settings,
        openaiApiKey: settings.openaiApiKey ? '[KEY LENGTH: ' + settings.openaiApiKey.length + ']' : 'none'
      });
      await ipcRenderer.invoke('save-settings', settings);
      console.log('Settings saved successfully');
      setSuccess(true);
    } catch (error) {
      console.error('Error saving settings:', error);
      setError(error.message);
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-600">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-5">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
      
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-group">
          <h3 className="form-section-title">OpenAI Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <label className="form-label">
                API Key
                <input
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={(e) => handleChange('openaiApiKey', e.target.value)}
                  placeholder="sk-..."
                  className="input mt-1"
                />
              </label>
            </div>

            <div>
              <label className="form-label">
                AI Model
                <select
                  value={settings.aiModel}
                  onChange={(e) => handleChange('aiModel', e.target.value)}
                  className="select mt-1"
                >
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </label>
            </div>

            <div>
              <label className="form-label">
                Temperature
                <div className="flex items-center gap-4 mt-1">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.aiTemperature}
                    onChange={(e) => handleChange('aiTemperature', parseFloat(e.target.value))}
                    className="range flex-1"
                  />
                  <span className="text-sm text-gray-600 w-12 text-right">{settings.aiTemperature}</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="form-group">
          <h3 className="form-section-title">Voice Commands</h3>
          
          <div>
            <label className="form-label">
              Trigger Word
              <input
                type="text"
                value={settings.aiTriggerWord}
                onChange={(e) => handleChange('aiTriggerWord', e.target.value)}
                placeholder="juno"
                className="input mt-1"
              />
            </label>
          </div>
        </div>

        <div className="form-group">
          <h3 className="form-section-title">Application Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="form-label">
                Startup Behavior
                <select
                  value={settings.startupBehavior}
                  onChange={(e) => handleChange('startupBehavior', e.target.value)}
                  className="select mt-1"
                >
                  <option value="minimized">Start Minimized</option>
                  <option value="normal">Show Window</option>
                </select>
              </label>
            </div>

            <div>
              <label className="form-label">
                Default Microphone
                <select
                  value={settings.defaultMicrophone}
                  onChange={(e) => handleChange('defaultMicrophone', e.target.value)}
                  className="select mt-1"
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
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="submit" className="btn btn-primary">
            Save Settings
          </button>
          <button 
            type="button" 
            className="btn btn-danger"
            onClick={async () => {
              try {
                const ipcRenderer = getIpcRenderer();
                if (!ipcRenderer) {
                  setError('IPC not available');
                  return;
                }
                
                if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
                  await ipcRenderer.invoke('reset-settings');
                  const loadedSettings = await ipcRenderer.invoke('get-settings');
                  setSettings(loadedSettings);
                  setSuccess(true);
                }
              } catch (error) {
                console.error('Error resetting settings:', error);
                setError(error.message);
              }
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </form>

      <DictionaryManager />
    </div>
  );
};

export default Settings; 