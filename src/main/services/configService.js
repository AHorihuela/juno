let Store;
(async () => {
  Store = (await import('electron-store')).default;
})();

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class ConfigService {
  constructor() {
    this.store = null;
    this.encryptionKey = null;
    this.initializeStore();
  }

  async getEncryptionKey() {
    if (this.encryptionKey) return this.encryptionKey;

    const keyPath = path.join(app.getPath('userData'), '.encryption-key');
    
    try {
      // Try to read existing key
      if (fs.existsSync(keyPath)) {
        this.encryptionKey = fs.readFileSync(keyPath, 'utf8');
      } else {
        // Generate and save new key if none exists
        this.encryptionKey = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(keyPath, this.encryptionKey, { mode: 0o600 });
      }
      return this.encryptionKey;
    } catch (error) {
      console.error('Error managing encryption key:', error);
      throw new Error('Failed to manage encryption key');
    }
  }

  async initializeStore() {
    if (!Store) {
      Store = (await import('electron-store')).default;
    }
    
    try {
      if (!this.store) {
        const encryptionKey = await this.getEncryptionKey();
        this.store = new Store({
          encryptionKey,
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
            actionVerbs: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: [
                'summarize',
                'explain',
                'analyze',
                'rewrite',
                'translate',
                'improve',
                'simplify',
                'elaborate',
                'fix',
                'check',
                'shorten',
                'expand',
                'clarify',
                'lengthen',
                'write',
                'update',
                'modify',
                'edit',
                'revise',
                'make'
              ]
            },
            aiRules: {
              type: 'array',
              items: {
                type: 'string'
              },
              default: []
            },
            keyboardShortcut: {
              type: 'string',
              default: 'CommandOrControl+Shift+Space'
            }
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
          const encryptionKey = await this.getEncryptionKey();
          this.store = new Store({
            encryptionKey,
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
              actionVerbs: {
                type: 'array',
                items: {
                  type: 'string'
                },
                default: [
                  'summarize',
                  'explain',
                  'analyze',
                  'rewrite',
                  'translate',
                  'improve',
                  'simplify',
                  'elaborate',
                  'fix',
                  'check',
                  'shorten',
                  'expand',
                  'clarify',
                  'lengthen',
                  'write',
                  'update',
                  'modify',
                  'edit',
                  'revise',
                  'make'
                ]
              },
              aiRules: {
                type: 'array',
                items: {
                  type: 'string'
                },
                default: []
              },
              keyboardShortcut: {
                type: 'string',
                default: 'CommandOrControl+Shift+Space'
              }
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
    const key = this.store.get('openaiApiKey', '');
    console.log('Retrieved OpenAI API key, length:', key ? key.length : 0);
    return key;
  }

  async setOpenAIApiKey(key) {
    console.log('Setting OpenAI API key, length:', key ? key.length : 0);
    if (!key) {
      console.log('Deleting OpenAI API key');
      this.store.delete('openaiApiKey');
    } else {
      console.log('Storing new OpenAI API key');
      this.store.set('openaiApiKey', key);
    }
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
    if (!word) {
      store.set('aiTriggerWord', 'juno'); // Use default
    } else {
      store.set('aiTriggerWord', word);
    }
  }

  // AI Model
  async getAIModel() {
    const store = await this.initializeStore();
    return store.get('aiModel');
  }

  async setAIModel(model) {
    const store = await this.initializeStore();
    if (!model) {
      store.set('aiModel', 'gpt-4'); // Use default
    } else {
      store.set('aiModel', model);
    }
  }

  // AI Temperature
  async getAITemperature() {
    const store = await this.initializeStore();
    return store.get('aiTemperature');
  }

  async setAITemperature(temp) {
    const store = await this.initializeStore();
    if (temp === null || temp === undefined) {
      store.set('aiTemperature', 0.7); // Use default
    } else if (temp < 0 || temp > 2) {
      throw new Error('Temperature must be between 0 and 2');
    } else {
      store.set('aiTemperature', temp);
    }
  }

  // Startup Behavior
  async getStartupBehavior() {
    const store = await this.initializeStore();
    return store.get('startupBehavior');
  }

  async setStartupBehavior(behavior) {
    const store = await this.initializeStore();
    if (!behavior) {
      store.set('startupBehavior', 'minimized'); // Use default
    } else if (!['minimized', 'normal'].includes(behavior)) {
      throw new Error('Invalid startup behavior');
    } else {
      store.set('startupBehavior', behavior);
    }
  }

  // Default Microphone
  async getDefaultMicrophone() {
    const store = await this.initializeStore();
    return store.get('defaultMicrophone');
  }

  async setDefaultMicrophone(deviceId) {
    const store = await this.initializeStore();
    if (!deviceId) {
      store.delete('defaultMicrophone');
    } else {
      store.set('defaultMicrophone', deviceId);
    }
  }

  // Reset all settings to defaults
  async resetToDefaults() {
    const store = await this.initializeStore();
    store.clear();
    return store.store;
  }

  // Action Verbs
  async getActionVerbs() {
    const store = await this.initializeStore();
    return store.get('actionVerbs');
  }

  async setActionVerbs(verbs) {
    if (!Array.isArray(verbs)) {
      throw new Error('Action verbs must be an array of strings');
    }
    if (!verbs.every(verb => typeof verb === 'string')) {
      throw new Error('All action verbs must be strings');
    }
    const store = await this.initializeStore();
    store.set('actionVerbs', verbs);
  }

  async addActionVerb(verb) {
    if (typeof verb !== 'string') {
      throw new Error('Action verb must be a string');
    }
    const store = await this.initializeStore();
    const verbs = store.get('actionVerbs');
    if (!verbs.includes(verb)) {
      verbs.push(verb);
      store.set('actionVerbs', verbs);
    }
  }

  async removeActionVerb(verb) {
    const store = await this.initializeStore();
    const verbs = store.get('actionVerbs');
    const updatedVerbs = verbs.filter(v => v !== verb);
    store.set('actionVerbs', updatedVerbs);
  }

  // AI Rules
  async getAIRules() {
    const store = await this.initializeStore();
    const rules = store.get('aiRules');
    console.log('[ConfigService] Retrieved AI rules:', rules);
    return rules;
  }

  async setAIRules(rules) {
    const store = await this.initializeStore();
    console.log('[ConfigService] Saving AI rules:', rules);
    store.set('aiRules', rules);
  }

  async addAIRule(rule) {
    const store = await this.initializeStore();
    const rules = await this.getAIRules();
    if (!rules.includes(rule)) {
      rules.push(rule);
      console.log('[ConfigService] Adding new AI rule:', rule);
      await this.setAIRules(rules);
    }
  }

  async removeAIRule(rule) {
    const store = await this.initializeStore();
    const rules = await this.getAIRules();
    const index = rules.indexOf(rule);
    if (index !== -1) {
      rules.splice(index, 1);
      console.log('[ConfigService] Removing AI rule:', rule);
      await this.setAIRules(rules);
    }
  }

  // Keyboard Shortcut
  async getKeyboardShortcut() {
    const store = await this.initializeStore();
    return store.get('keyboardShortcut');
  }

  async setKeyboardShortcut(shortcut) {
    const store = await this.initializeStore();
    if (!shortcut) {
      store.set('keyboardShortcut', 'CommandOrControl+Shift+Space'); // Use default
    } else {
      store.set('keyboardShortcut', shortcut);
    }
  }
}

module.exports = new ConfigService(); 