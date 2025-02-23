import { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';

export const useSettings = () => {
  const [settings, setSettings] = useState({
    openaiApiKey: '',
    aiTriggerWord: 'juno',
    aiModel: 'gpt-4',
    aiTemperature: 0.7,
    startupBehavior: 'minimized',
    defaultMicrophone: '',
    aiRules: [],
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const ipcRenderer = getIpcRenderer();
        if (!ipcRenderer) throw new Error('IPC not available');
        
        const loadedSettings = await ipcRenderer.invoke('get-settings');
        setSettings(loadedSettings);
        setError(null);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSetting = async (key, value) => {
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) throw new Error('IPC not available');

      const updatedSettings = { ...settings, [key]: value };
      await ipcRenderer.invoke('save-settings', updatedSettings);
      setSettings(updatedSettings);
      setSuccess(true);
      setError(null);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (error) {
      setError(error.message);
      setSuccess(false);
    }
  };

  return {
    settings,
    updateSetting,
    error,
    success,
    loading,
  };
}; 