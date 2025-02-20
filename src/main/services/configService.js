let Store;
(async () => {
  Store = (await import('electron-store')).default;
})();

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

class ConfigService {
  constructor() {
    this.store = null;
  }

  async initializeStore() {
    if (!Store) {
      Store = (await import('electron-store')).default;
    }
    
    try {
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
    } catch (error) {
      console.error('Error initializing store:', error);
      
      // If there's a JSON parse error, the config file is corrupted
      if (error instanceof SyntaxError) {
        console.log('Config file corrupted, attempting recovery...');
        try {
          // Get the config file path
          const userDataPath = (await import('electron')).app.getPath('userData');
          const configPath = path.join(userDataPath, 'config.json');
          
          // Delete the corrupted file
          if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
            console.log('Deleted corrupted config file');
          }
          
          // Try initializing again
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
        } catch (recoveryError) {
          console.error('Failed to recover config:', recoveryError);
          throw new Error('Failed to initialize settings storage');
        }
      } else {
        throw error;
      }
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