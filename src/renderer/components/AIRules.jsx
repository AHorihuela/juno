import React, { useState, useEffect } from 'react';
import { getIpcRenderer } from '../utils/electron';

const AIRules = () => {
  const [rules, setRules] = useState([]);
  const [newRule, setNewRule] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const ipcRenderer = getIpcRenderer();
      const settings = await ipcRenderer.invoke('get-settings');
      setRules(settings.aiRules || []);
      setError(null);
    } catch (err) {
      setError('Failed to load AI rules');
      console.error('Error loading AI rules:', err);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.trim()) return;

    try {
      const ipcRenderer = getIpcRenderer();
      await ipcRenderer.invoke('save-settings', {
        aiRules: [...rules, newRule.trim()]
      });
      setRules(prev => [...prev, newRule.trim()]);
      setNewRule('');
      setError(null);
    } catch (err) {
      setError('Failed to add rule');
      console.error('Error adding rule:', err);
    }
  };

  const handleRemoveRule = async (ruleToRemove) => {
    try {
      const ipcRenderer = getIpcRenderer();
      const updatedRules = rules.filter(rule => rule !== ruleToRemove);
      await ipcRenderer.invoke('save-settings', {
        aiRules: updatedRules
      });
      setRules(updatedRules);
      setError(null);
    } catch (err) {
      setError('Failed to remove rule');
      console.error('Error removing rule:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Rules</h1>
        <p className="mt-2 text-sm text-gray-600">
          Add rules that describe your preferences, expertise, and writing style. 
          These will help the AI better understand how to respond to your requests.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <input
          type="text"
          value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          placeholder="Add a new rule for AI (e.g., 'User prefers technical explanations')"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAddRule();
            }
          }}
        />
        <button
          onClick={handleAddRule}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Add Rule
        </button>
      </div>

      <div className="space-y-3">
        {rules.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No rules added yet.</p>
        ) : (
          rules.map((rule, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg group"
            >
              <p className="text-gray-700">{rule}</p>
              <button
                onClick={() => handleRemoveRule(rule)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 focus:opacity-100 transition-opacity"
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

export default AIRules; 