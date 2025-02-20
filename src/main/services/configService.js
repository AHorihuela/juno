const Store = require('electron-store');
const crypto = require('crypto');

class ConfigService {
  constructor() {
    this.store = null;
  }

  initializeStore() {
    if (!this.store) {
      this.store = new Store({
        encryptionKey: crypto.randomBytes(32).toString('hex'),
        schema: {
          openaiApiKey: {
            type: 'string',
          },
          aiTriggerWord: {
            type: 'string',
            default: 'juno',
          },
          aiModel: {
            type: 'string',
            default: 'gpt-4',
          },
          aiTemperature: {
            type: 'number',
            minimum: 0,
            maximum: 2,
            default: 0.7,
          },
          startupBehavior: {
            type: 'string',
            enum: ['minimized', 'normal'],
            default: 'minimized',
          },
          defaultMicrophone: {
            type: 'string',
          },
        },
      });
    }
    return this.store;
  }

  // OpenAI API Key
  getOpenAIApiKey() {
    return this.initializeStore().get('openaiApiKey');
  }

  setOpenAIApiKey(key) {
    this.initializeStore().set('openaiApiKey', key);
  }

  hasOpenAIApiKey() {
    const key = this.getOpenAIApiKey();
    return Boolean(key && key.trim());
  }

  // AI Trigger Word
  getAITriggerWord() {
    return this.initializeStore().get('aiTriggerWord');
  }

  setAITriggerWord(word) {
    this.initializeStore().set('aiTriggerWord', word);
  }

  // AI Model
  getAIModel() {
    return this.initializeStore().get('aiModel');
  }

  setAIModel(model) {
    this.initializeStore().set('aiModel', model);
  }

  // AI Temperature
  getAITemperature() {
    return this.initializeStore().get('aiTemperature');
  }

  setAITemperature(temp) {
    if (temp < 0 || temp > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    this.initializeStore().set('aiTemperature', temp);
  }

  // Startup Behavior
  getStartupBehavior() {
    return this.initializeStore().get('startupBehavior');
  }

  setStartupBehavior(behavior) {
    if (!['minimized', 'normal'].includes(behavior)) {
      throw new Error('Invalid startup behavior');
    }
    this.initializeStore().set('startupBehavior', behavior);
  }

  // Default Microphone
  getDefaultMicrophone() {
    return this.initializeStore().get('defaultMicrophone');
  }

  setDefaultMicrophone(deviceId) {
    this.initializeStore().set('defaultMicrophone', deviceId);
  }

  // Reset all settings to defaults
  resetToDefaults() {
    const store = this.initializeStore();
    store.clear();
    return store.store;
  }
}

module.exports = new ConfigService(); 