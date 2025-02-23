import React, { useState, useRef } from 'react';
import { useSettings } from '../../hooks/useSettings';
import ActionVerbManager from '../ActionVerbManager';

const OpenAISection = ({ settings, updateSetting }) => (
  <div>
    <h3 className="text-base font-medium text-gray-900 mb-4">OpenAI Settings</h3>
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          OpenAI API Key
        </label>
        <input
          type="password"
          value={settings.openaiApiKey}
          onChange={(e) => updateSetting('openaiApiKey', e.target.value)}
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
          onChange={(e) => updateSetting('aiModel', e.target.value)}
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
            onChange={(e) => updateSetting('aiTemperature', parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-600 w-12 text-right tabular-nums">
            {settings.aiTemperature}
          </span>
        </div>
      </div>
    </div>
  </div>
);

const VoiceCommandsSection = ({ settings, updateSetting }) => {
  return (
    <div>
      <h3 className="text-base font-medium text-gray-900 mb-4">Voice Commands</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trigger Word
          </label>
          <input
            type="text"
            value={settings.aiTriggerWord || 'juno'}
            onChange={(e) => updateSetting('aiTriggerWord', e.target.value)}
            placeholder="juno"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};

const AISettings = () => {
  const { settings, updateSetting, error, success } = useSettings();

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
      {/* OpenAI Settings */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <OpenAISection settings={settings} updateSetting={updateSetting} />
      </div>

      {/* Voice Commands */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <VoiceCommandsSection settings={settings} updateSetting={updateSetting} />
      </div>

      {/* Action Verbs Section */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <ActionVerbManager />
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

export default AISettings; 