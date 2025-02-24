const { EventEmitter } = require('events');

class BaseService extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.initialized = false;
    this.registry = null;
  }

  async initialize(registry) {
    if (this.initialized) {
      return this;
    }

    console.log(`Initializing ${this.name}Service...`);
    this.registry = registry;
    
    try {
      await this._initialize();
      this.initialized = true;
      this.emit('initialized');
      console.log(`${this.name}Service initialized successfully`);
      return this;
    } catch (error) {
      console.error(`Error initializing ${this.name}Service:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  async shutdown() {
    if (!this.initialized) {
      return;
    }

    console.log(`Shutting down ${this.name}Service...`);
    
    try {
      await this._shutdown();
      this.initialized = false;
      this.registry = null;
      this.emit('shutdown');
      console.log(`${this.name}Service shut down successfully`);
    } catch (error) {
      console.error(`Error shutting down ${this.name}Service:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  // Protected methods to be implemented by derived classes
  async _initialize() {
    // Default implementation does nothing
  }

  async _shutdown() {
    // Default implementation does nothing
  }

  // Helper method to get other services
  getService(name) {
    if (!this.registry) {
      throw new Error('Service registry not available');
    }
    return this.registry.get(name);
  }

  // Helper method to emit errors with consistent format
  emitError(error) {
    const wrappedError = new Error(`${this.name}Service error: ${error.message}`);
    wrappedError.originalError = error;
    this.emit('error', wrappedError);
    return wrappedError;
  }
}

module.exports = BaseService; 