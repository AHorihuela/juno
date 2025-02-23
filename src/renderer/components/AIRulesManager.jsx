import React, { useState } from 'react';
import { getIpcRenderer } from '../utils/electron';

const AIRulesManager = () => {
  const [newRule, setNewRule] = useState('');
  const [rules, setRules] = useState([]);
  const [error, setError] = useState(null);

  // Load rules on component mount
  React.useEffect(() => {
    const loadRules = async () => {
      try {
        const ipcRenderer = getIpcRenderer();
        if (!ipcRenderer) throw new Error('IPC not available');
        const settings = await ipcRenderer.invoke('get-settings');
        setRules(settings.aiRules || []);
      } catch (error) {
        setError(error.message);
      }
    };
    loadRules();
  }, []);

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!newRule.trim()) return;

    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) throw new Error('IPC not available');

      const updatedRules = [...rules, newRule.trim()];
      await ipcRenderer.invoke('save-settings', { aiRules: updatedRules });
      setRules(updatedRules);
      setNewRule('');
      setError(null);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleRemoveRule = async (ruleToRemove) => {
    try {
      const ipcRenderer = getIpcRenderer();
      if (!ipcRenderer) throw new Error('IPC not available');

      const updatedRules = rules.filter(rule => rule !== ruleToRemove);
      await ipcRenderer.invoke('save-settings', { aiRules: updatedRules });
      setRules(updatedRules);
      setError(null);
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium text-gray-900 mb-4">AI Rules</h3>
      
      <p className="text-sm text-gray-600 mb-4">
        Add rules that describe your preferences, expertise, and writing style. These will help the AI better understand how to respond to your requests.
      </p>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          placeholder="Add a new rule for AI (e.g., 'User prefers technical explanations' or 'User writes in a concise style')"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddRule(e);
            }
          }}
        />
        <button
          type="button"
          onClick={handleAddRule}
          disabled={!newRule.trim()}
          className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white
            hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2
            focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Rule
        </button>
      </div>

      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
          >
            <span className="text-sm text-gray-700">{rule}</span>
            <button
              type="button"
              onClick={() => handleRemoveRule(rule)}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
        {rules.length === 0 && (
          <p className="text-sm text-gray-500 italic">No rules added yet.</p>
        )}
      </div>
    </div>
  );
};

export default AIRulesManager; 