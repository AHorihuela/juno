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
        },
      });
    }
    return this.store;
  }

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
}

module.exports = new ConfigService(); 