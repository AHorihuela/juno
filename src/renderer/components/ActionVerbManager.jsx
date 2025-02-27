import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';

const ActionVerbManager = () => {
  const [verbs, setVerbs] = useState([]);
  const [newVerb, setNewVerb] = useState('');
  const [error, setError] = useState(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    loadVerbs();
  }, []);

  const loadVerbs = async () => {
    try {
      const ipcRenderer = getIpcRenderer();
      const settings = await ipcRenderer.invoke('get-settings');
      setVerbs(settings.actionVerbs || []);
      setEnabled(settings.actionVerbsEnabled !== undefined ? settings.actionVerbsEnabled : true);
      setError(null);
    } catch (err) {
      setError('Failed to load action verbs');
      console.error('Error loading action verbs:', err);
    }
  };

  const handleAddVerb = async () => {
    if (!newVerb.trim()) return;

    try {
      const ipcRenderer = getIpcRenderer();
      await ipcRenderer.invoke('save-settings', {
        actionVerbs: [...verbs, newVerb.trim()]
      });
      setVerbs(prev => [...prev, newVerb.trim()]);
      setNewVerb('');
      setError(null);
    } catch (err) {
      setError('Failed to add verb');
      console.error('Error adding verb:', err);
    }
  };

  const handleRemoveVerb = async (verbToRemove) => {
    try {
      const ipcRenderer = getIpcRenderer();
      const updatedVerbs = verbs.filter(verb => verb !== verbToRemove);
      await ipcRenderer.invoke('save-settings', {
        actionVerbs: updatedVerbs
      });
      setVerbs(updatedVerbs);
      setError(null);
    } catch (err) {
      setError('Failed to remove verb');
      console.error('Error removing verb:', err);
    }
  };

  const handleToggleEnabled = async () => {
    try {
      const ipcRenderer = getIpcRenderer();
      const newEnabledState = !enabled;
      await ipcRenderer.invoke('save-settings', {
        actionVerbsEnabled: newEnabledState
      });
      setEnabled(newEnabledState);
      setError(null);
    } catch (err) {
      setError('Failed to update action verb settings');
      console.error('Error updating action verb settings:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600 mb-4">
          Action verbs allow you to trigger AI commands without using the trigger word.
          For example, saying "Summarize this text" will be recognized as an AI command.
        </p>
        
        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg mb-6">
          <label htmlFor="action-verbs-toggle" className="text-sm font-medium text-gray-700">
            Enable action verb detection
            <p className="text-xs text-gray-500 mt-1">When enabled, commands starting with action verbs will be processed</p>
          </label>
          <div className="relative inline-flex items-center">
            <input
              id="action-verbs-toggle"
              type="checkbox"
              checked={enabled}
              onChange={handleToggleEnabled}
              className="sr-only"
            />
            <button
              role="switch"
              aria-checked={enabled}
              onClick={handleToggleEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                enabled ? 'bg-indigo-500' : 'bg-gray-300'
              }`}
            >
              <span 
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-1'
                }`} 
              />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center mb-4">
          <svg className="w-5 h-5 mr-2 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className={`${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={newVerb}
            onChange={(e) => setNewVerb(e.target.value)}
            placeholder="Add a new action verb (e.g., 'summarize')"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            disabled={!enabled}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddVerb();
              }
            }}
          />
          <button
            onClick={handleAddVerb}
            disabled={!enabled || !newVerb.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Add Verb
          </button>
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Your Action Verbs</h4>
          <div className={`space-y-2 ${!enabled ? 'opacity-50' : ''}`}>
            {verbs.length === 0 ? (
              <p className="text-sm text-gray-500 italic py-3">No action verbs added yet.</p>
            ) : (
              verbs.map((verb, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md group hover:border-gray-300 transition-colors"
                >
                  <p className="text-sm text-gray-700">{verb}</p>
                  <button
                    onClick={() => handleRemoveVerb(verb)}
                    disabled={!enabled}
                    className={`${!enabled ? 'hidden' : 'opacity-0 group-hover:opacity-100'} text-gray-400 hover:text-red-500 focus:opacity-100 transition-opacity p-1`}
                    aria-label={`Remove ${verb}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionVerbManager; 