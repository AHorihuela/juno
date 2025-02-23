import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../../utils/electron';
import { useSettings } from '../../hooks/useSettings';

const GeneralSettings = () => {
  const { settings, updateSetting, error, success } = useSettings();
  const [microphones, setMicrophones] = useState([]);
  const [isChangingDevice, setIsChangingDevice] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const loadMicrophones = async () => {
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) throw new Error('IPC not available');
      
      const devices = await ipcRenderer.invoke('get-microphones');
      setMicrophones(devices);
      setPermissionDenied(false);
    } catch (error) {
      if (error.message.includes('Permission denied') || 
          error.message.includes('NotAllowedError')) {
        setPermissionDenied(true);
      }
    }
  };

  useEffect(() => {
    // Set up device change listener
    navigator.mediaDevices?.addEventListener('devicechange', loadMicrophones);
    loadMicrophones();

    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', loadMicrophones);
    };
  }, []);

  const handleMicrophoneChange = async (value) => {
    setIsChangingDevice(true);
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) throw new Error('IPC not available');

      const result = await ipcRenderer.invoke('change-microphone', value);
      if (result.success) {
        await updateSetting('defaultMicrophone', value);
        ipcRenderer.send('show-notification', {
          title: 'Microphone Changed',
          message: 'Successfully switched to new microphone',
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Failed to change microphone:', error);
    } finally {
      setIsChangingDevice(false);
    }
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
      <div>
        <h3 className="text-base font-medium text-gray-900 mb-4">Application Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Startup Behavior
            </label>
            <select
              value={settings.startupBehavior}
              onChange={(e) => updateSetting('startupBehavior', e.target.value)}
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
                onChange={(e) => handleMicrophoneChange(e.target.value)}
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
                <div className="absolute right-2 top-2">
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

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          ✓ Settings saved successfully
        </div>
      )}
    </form>
  );
};

export default GeneralSettings; 