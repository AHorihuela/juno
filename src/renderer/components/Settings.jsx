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
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) {
      setError('IPC not available');
      return;
    }

    const loadSettings = async () => {
      try {
        const loadedSettings = await ipcRenderer.invoke('get-settings');
        setSettings(loadedSettings);
        setLoading(false);
      } catch (error) {
        setError(error.message);
        setLoading(false);
      }
    };

    const loadMicrophones = async () => {
      try {
        const devices = await ipcRenderer.invoke('get-microphones');
        setMicrophones(devices);
      } catch (error) {
        setError(error.message);
      }
    };

    loadSettings();
    loadMicrophones();
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
      await ipcRenderer.invoke('save-settings', settings);
      setSuccess(true);
    } catch (error) {
      setError(error.message);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-600">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('general')}
          >
            General Settings
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'dictionary'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('dictionary')}
          >
            Dictionary
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
            Settings saved successfully!
          </div>
        )}

        {activeTab === 'general' ? (
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* OpenAI Configuration */}
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-4">OpenAI Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={settings.openaiApiKey}
                    onChange={(e) => handleChange('openaiApiKey', e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    AI Model
                  </label>
                  <select
                    value={settings.aiModel}
                    onChange={(e) => handleChange('aiModel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.aiTemperature}
                      onChange={(e) => handleChange('aiTemperature', parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm text-gray-600 w-12 text-right tabular-nums">
                      {settings.aiTemperature}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Voice Commands */}
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-4">Voice Commands</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Word
                </label>
                <input
                  type="text"
                  value={settings.aiTriggerWord}
                  onChange={(e) => handleChange('aiTriggerWord', e.target.value)}
                  placeholder="juno"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Application Settings */}
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-4">Application Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Startup Behavior
                  </label>
                  <select
                    value={settings.startupBehavior}
                    onChange={(e) => handleChange('startupBehavior', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="minimized">Start Minimized</option>
                    <option value="normal">Show Window</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Microphone
                  </label>
                  <select
                    value={settings.defaultMicrophone}
                    onChange={(e) => handleChange('defaultMicrophone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">System Default</option>
                    {microphones.map(device => (
                      <option key={device.id} value={device.id}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white
                  hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2
                  focus:ring-offset-1 focus:ring-indigo-500"
              >
                Save Settings
              </button>
              <button 
                type="button"
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
                    setError(error.message);
                  }
                }}
                className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white
                  hover:bg-red-700 transition-colors focus:outline-none focus:ring-2
                  focus:ring-offset-1 focus:ring-red-500"
              >
                Reset to Defaults
              </button>
            </div>
          </form>
        ) : (
          <DictionaryManager />
        )}
      </div>
    </div>
  );
};

export default Settings; 