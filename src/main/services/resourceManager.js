const { OpenAI } = require('openai');
const BaseService = require('./BaseService');

class ResourceManager extends BaseService {
  constructor() {
    super('Resource');
    this.openai = null;
  }

  async _initialize() {
    // We don't initialize OpenAI here - we'll do it on demand
    // to avoid unnecessary API client creation
  }

  async getOpenAIClient() {
    if (this.openai) {
      return this.openai;
    }

    try {
      const apiKey = await this.getService('config').getOpenAIApiKey();
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      this.openai = new OpenAI({ apiKey });
      return this.openai;
    } catch (error) {
      throw this.emitError(error);
    }
  }

  async _shutdown() {
    this.openai = null;
  }
}

// Export factory function
module.exports = () => new ResourceManager(); 