import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';

const ActionVerbManager = () => {
  const [verbs, setVerbs] = useState([]);
  const [newVerb, setNewVerb] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadVerbs();
  }, []);

  const loadVerbs = async () => {
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }
      const loadedVerbs = await ipcRenderer.invoke('get-action-verbs');
      setVerbs(loadedVerbs);
      setError(null);
    } catch (error) {
      setError('Failed to load action verbs');
      setVerbs([]);
    }
  };

  const handleAddVerb = async (e) => {
    if (e) {
      e.preventDefault();
    }
    setError(null);
    setSuccess(false);

    const verb = newVerb.trim().toLowerCase();
    if (!verb) {
      return;
    }

    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }
      await ipcRenderer.invoke('add-action-verb', verb);
      
      setNewVerb('');
      await loadVerbs();
      setSuccess(true);
    } catch (error) {
      setError(error.message || 'Failed to add action verb');
    }
  };

  const handleRemoveVerb = async (verb) => {
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }
      await ipcRenderer.invoke('remove-action-verb', verb);
      await loadVerbs();
      setSuccess(true);
    } catch (error) {
      setError(error.message || 'Failed to remove action verb');
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          Action verbs updated successfully!
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-base font-medium text-gray-900 mb-2">Add New Action Verb</h3>
        <p className="text-sm text-gray-500 mb-4">
          Add verbs that will trigger AI processing when used at the start of a command.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={newVerb}
            onChange={(e) => setNewVerb(e.target.value)}
            placeholder="Enter an action verb"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button 
            onClick={handleAddVerb}
            disabled={!newVerb.trim()}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              newVerb.trim()
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Add Verb
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-base font-medium text-gray-900 mb-2">Action Verbs</h3>
        <p className="text-sm text-gray-500 mb-4">
          These verbs will trigger AI processing when used at the start of a command.
        </p>

        {verbs.length === 0 ? (
          <p className="text-sm text-gray-500">No action verbs configured.</p>
        ) : (
          <div className="space-y-2">
            {verbs.map((verb) => (
              <div
                key={verb}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
              >
                <span className="text-gray-900">{verb}</span>
                <button
                  onClick={() => handleRemoveVerb(verb)}
                  className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md
                    hover:bg-gray-100"
                  title="Remove verb"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionVerbManager; 