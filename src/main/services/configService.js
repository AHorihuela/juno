let Store;
(async () => {
  Store = (await import('electron-store')).default;
})();

const crypto = require('crypto');

class ConfigService {
  constructor() {
    this.store = null;
  }

  async initializeStore() {
    if (!Store) {
      Store = (await import('electron-store')).default;
    }
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
  async getOpenAIApiKey() {
    const store = await this.initializeStore();
    return store.get('openaiApiKey');
  }

  async setOpenAIApiKey(key) {
    const store = await this.initializeStore();
    store.set('openaiApiKey', key);
  }

  async hasOpenAIApiKey() {
    const key = await this.getOpenAIApiKey();
    return Boolean(key && key.trim());
  }

  // AI Trigger Word
  async getAITriggerWord() {
    const store = await this.initializeStore();
    return store.get('aiTriggerWord');
  }

  async setAITriggerWord(word) {
    const store = await this.initializeStore();
    store.set('aiTriggerWord', word);
  }

  // AI Model
  async getAIModel() {
    const store = await this.initializeStore();
    return store.get('aiModel');
  }

  async setAIModel(model) {
    const store = await this.initializeStore();
    store.set('aiModel', model);
  }

  // AI Temperature
  async getAITemperature() {
    const store = await this.initializeStore();
    return store.get('aiTemperature');
  }

  async setAITemperature(temp) {
    if (temp < 0 || temp > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    const store = await this.initializeStore();
    store.set('aiTemperature', temp);
  }

  // Startup Behavior
  async getStartupBehavior() {
    const store = await this.initializeStore();
    return store.get('startupBehavior');
  }

  async setStartupBehavior(behavior) {
    if (!['minimized', 'normal'].includes(behavior)) {
      throw new Error('Invalid startup behavior');
    }
    const store = await this.initializeStore();
    store.set('startupBehavior', behavior);
  }

  // Default Microphone
  async getDefaultMicrophone() {
    const store = await this.initializeStore();
    return store.get('defaultMicrophone');
  }

  async setDefaultMicrophone(deviceId) {
    const store = await this.initializeStore();
    store.set('defaultMicrophone', deviceId);
  }

  // Reset all settings to defaults
  async resetToDefaults() {
    const store = await this.initializeStore();
    store.clear();
    return store.store;
  }
}

module.exports = new ConfigService(); 