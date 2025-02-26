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
        <h3 className="text-base font-medium text-gray-900 mb-2">Action Verbs</h3>
        <p className="text-sm text-gray-600 mb-4">
          Action verbs allow you to trigger AI commands without using the trigger word.
          For example, saying "Summarize this text" will be recognized as an AI command.
        </p>
        
        <div className="flex items-center justify-between mb-4">
          <label htmlFor="action-verbs-toggle" className="text-sm font-medium text-gray-700">
            Enable action verb detection
          </label>
          <div className="relative inline-block w-10 mr-2 align-middle select-none">
            <input
              id="action-verbs-toggle"
              type="checkbox"
              checked={enabled}
              onChange={handleToggleEnabled}
              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
            />
            <label
              htmlFor="action-verbs-toggle"
              className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                enabled ? 'bg-indigo-500' : 'bg-gray-300'
              }`}
            ></label>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className={`flex gap-3 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <input
          type="text"
          value={newVerb}
          onChange={(e) => setNewVerb(e.target.value)}
          placeholder="Add a new action verb (e.g., 'summarize')"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          disabled={!enabled}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAddVerb();
            }
          }}
        />
        <button
          onClick={handleAddVerb}
          disabled={!enabled}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Add Verb
        </button>
      </div>

      <div className={`space-y-3 ${!enabled ? 'opacity-50' : ''}`}>
        {verbs.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No action verbs added yet.</p>
        ) : (
          verbs.map((verb, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg group"
            >
              <p className="text-gray-700">{verb}</p>
              <button
                onClick={() => handleRemoveVerb(verb)}
                disabled={!enabled}
                className={`${!enabled ? 'hidden' : 'opacity-0 group-hover:opacity-100'} text-gray-400 hover:text-red-500 focus:opacity-100 transition-opacity`}
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
  );
};

export default ActionVerbManager; 