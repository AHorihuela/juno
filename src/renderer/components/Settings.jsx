import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';
import ActionVerbManager from './ActionVerbManager';

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
  const [isChangingDevice, setIsChangingDevice] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const loadMicrophones = async () => {
    try {
      console.log('Requesting microphones from main process...');
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC not available');
      }
      const devices = await ipcRenderer.invoke('get-microphones');
      console.log('Received microphones:', devices);
      setMicrophones(devices);
      setPermissionDenied(false);
      setError(null);
    } catch (error) {
      console.error('Failed to load microphones:', error);
      if (error.message.includes('Permission denied') || 
          error.message.includes('NotAllowedError')) {
        setPermissionDenied(true);
      }
      setError('Failed to load microphones: ' + error.message);
    }
  };

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

    // Set up device change listener
    navigator.mediaDevices?.addEventListener('devicechange', loadMicrophones);

    loadSettings();
    loadMicrophones();

    // Cleanup function
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', loadMicrophones);
    };
  }, []);

  const handleChange = async (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSuccess(false);
    setError(null);

    // Special handling for microphone changes
    if (key === 'defaultMicrophone') {
      setIsChangingDevice(true);
      try {
        const ipcRenderer = getIpcRenderer();
        if (!ipcRenderer) throw new Error('IPC not available');

        // Notify the main process to change the recording device
        const result = await ipcRenderer.invoke('change-microphone', value);
        if (result.success) {
          setSuccess(true);
          // Show success message
          ipcRenderer.send('show-notification', {
            title: 'Microphone Changed',
            message: 'Successfully switched to new microphone',
            type: 'success'
          });
        } else {
          throw new Error('Failed to switch microphone');
        }
      } catch (error) {
        console.error('Failed to change microphone:', error);
        setError('Failed to change microphone: ' + error.message);
        // Reset the selection to the previous value
        setSettings(prev => ({
          ...prev,
          defaultMicrophone: prev.defaultMicrophone
        }));
      } finally {
        setIsChangingDevice(false);
      }
    }
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-8">Settings</h2>

      {/* Settings Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
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
                activeTab === 'ai'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('ai')}
            >
              AI Settings
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
                    <label 
                      htmlFor="default-microphone"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Default Microphone
                    </label>
                    <div className="relative">
                      <select
                        id="default-microphone"
                        value={settings.defaultMicrophone}
                        onChange={(e) => handleChange('defaultMicrophone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white
                          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                          disabled:bg-gray-100 disabled:cursor-not-allowed"
                        disabled={isChangingDevice}
                      >
                        {microphones.length === 0 ? (
                          <option value="">No microphones found</option>
                        ) : (
                          microphones.map(device => (
                            <option key={device.id} value={device.id}>
                              {device.label}
                            </option>
                          ))
                        )}
                      </select>
                      {isChangingDevice && (
                        <div data-testid="loading-spinner" className="absolute right-2 top-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                        </div>
                      )}
                    </div>
                    {permissionDenied && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        Microphone access is required. Please grant permission and click "Retry Access".
                        <button
                          onClick={loadMicrophones}
                          className="ml-2 underline hover:text-red-800"
                        >
                          Retry Access
                        </button>
                      </div>
                    )}
                    <p className="mt-2 text-sm text-gray-500">
                      💡 Use "Default" if you frequently switch between microphones
                    </p>
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
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* AI Settings */}
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">AI Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      OpenAI API Key
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
                      <option value="gpt-4">GPT-4 (Recommended)</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster)</option>
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

              {/* Action Verbs Section */}
              <div className="mb-8 pb-8 border-b border-gray-200">
                <ActionVerbManager />
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
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings; 