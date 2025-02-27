import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../../utils/electron';
import { useSettings } from '../../hooks/useSettings';

const GeneralSettings = () => {
  const { settings, updateSetting, error, success } = useSettings();
  const [microphones, setMicrophones] = useState([]);
  const [isChangingDevice, setIsChangingDevice] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isLoadingMicrophones, setIsLoadingMicrophones] = useState(true);
  const [microphoneError, setMicrophoneError] = useState(null);

  const loadMicrophones = async () => {
    try {
      setIsLoadingMicrophones(true);
      setMicrophoneError(null);
      
      console.log('[Settings] Loading microphones...');
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC not available');
      }
      
      console.log('[Settings] Calling get-microphones IPC handler...');
      
      // Force a direct call to the main process
      const devices = await ipcRenderer.invoke('get-microphones');
      
      console.log('[Settings] Received microphones:', devices);
      
      setMicrophones(devices);
      setPermissionDenied(false);
      
      if (devices.length <= 1) {
        console.warn('[Settings] Warning: Only found default microphone or no microphones');
      }
    } catch (error) {
      console.error('[Settings] Error loading microphones:', error);
      setMicrophoneError(error.message);
      
      if (error.message.includes('Permission denied') || 
          error.message.includes('NotAllowedError')) {
        setPermissionDenied(true);
      }
    } finally {
      setIsLoadingMicrophones(false);
    }
  };

  useEffect(() => {
    console.log('[Settings] Component mounted, setting up microphone detection');
    
    // Set up device change listener
    try {
      navigator.mediaDevices?.addEventListener('devicechange', loadMicrophones);
    } catch (error) {
      console.error('[Settings] Error setting up device change listener:', error);
    }
    
    // Load microphones on mount
    loadMicrophones();

    return () => {
      try {
        navigator.mediaDevices?.removeEventListener('devicechange', loadMicrophones);
      } catch (error) {
        console.error('[Settings] Error removing device change listener:', error);
      }
    };
  }, []);

  const handleMicrophoneChange = async (value) => {
    setIsChangingDevice(true);
    try {
      console.log('[Settings] Changing microphone to:', value);
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
      console.error('[Settings] Failed to change microphone:', error);
      setMicrophoneError(error.message);
    } finally {
      setIsChangingDevice(false);
    }
  };

  const forceRefreshMicrophones = async () => {
    await loadMicrophones();
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center">
          <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Application Settings
        </h3>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Startup Behavior
              </label>
              <select
                value={settings.startupBehavior}
                onChange={(e) => updateSetting('startupBehavior', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                  transition-colors"
              >
                <option value="minimized">Start Minimized</option>
                <option value="normal">Show Window</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <label htmlFor="pause-background-audio" className="text-sm font-medium text-gray-700">
              Pause background audio during recording
              <p className="text-xs text-gray-500 mt-1">Audio will automatically resume when recording is complete</p>
            </label>
            <div className="relative inline-flex items-center">
              <input
                id="pause-background-audio"
                type="checkbox"
                checked={settings.pauseBackgroundAudio}
                onChange={(e) => updateSetting('pauseBackgroundAudio', e.target.checked)}
                className="sr-only"
              />
              <button
                role="switch"
                aria-checked={settings.pauseBackgroundAudio}
                onClick={() => updateSetting('pauseBackgroundAudio', !settings.pauseBackgroundAudio)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  settings.pauseBackgroundAudio ? 'bg-indigo-500' : 'bg-gray-300'
                }`}
              >
                <span 
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    settings.pauseBackgroundAudio ? 'translate-x-5' : 'translate-x-1'
                  }`} 
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center">
          <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Microphone Settings
        </h3>
        
        <div className="space-y-4">
          <div>
            <label 
              htmlFor="default-microphone"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Default Microphone
            </label>
            <div className="relative">
              <select
                id="default-microphone"
                value={settings.defaultMicrophone}
                onChange={(e) => handleMicrophoneChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                  disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                disabled={isChangingDevice || isLoadingMicrophones}
              >
                {isLoadingMicrophones ? (
                  <option value="">Loading microphones...</option>
                ) : microphones.length === 0 ? (
                  <option value="">No microphones found</option>
                ) : (
                  microphones.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.label}
                    </option>
                  ))
                )}
              </select>
              {(isChangingDevice || isLoadingMicrophones) && (
                <div className="absolute right-2 top-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                </div>
              )}
            </div>
            
            {permissionDenied && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center">
                <svg className="w-5 h-5 mr-2 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  Microphone access is required. Please grant permission and click "Retry Access".
                  <button
                    onClick={loadMicrophones}
                    className="ml-2 text-red-700 font-medium hover:text-red-800 underline"
                  >
                    Retry Access
                  </button>
                </div>
              </div>
            )}
            
            {microphoneError && !permissionDenied && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center">
                <svg className="w-5 h-5 mr-2 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  Error: {microphoneError}
                  <button
                    onClick={loadMicrophones}
                    className="ml-2 text-red-700 font-medium hover:text-red-800 underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
            
            {microphones.length === 0 && !isLoadingMicrophones && !microphoneError && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700 flex items-center">
                <svg className="w-5 h-5 mr-2 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  No microphones detected. Please check your microphone connection and click "Refresh".
                  <button
                    onClick={loadMicrophones}
                    className="ml-2 text-yellow-700 font-medium hover:text-yellow-800 underline"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            )}
            
            <div className="mt-4 flex justify-between items-center">
              <div className="flex items-center text-sm text-gray-500">
                <svg className="w-4 h-4 mr-1 text-amber-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                Use "Default" if you frequently switch between microphones
              </div>
              <button
                onClick={forceRefreshMicrophones}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm rounded-md border border-indigo-200 transition-colors flex items-center"
                type="button"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Force Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center">
          <svg className="w-5 h-5 mr-2 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 flex items-center">
          <svg className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Settings saved successfully
        </div>
      )}
    </div>
  );
};

export default GeneralSettings; 