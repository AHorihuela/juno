const { EventEmitter } = require('events');

class ServiceRegistry extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.initialized = false;
    this.initOrder = [
      'config',
      'notification',
      'dictionary',
      'audio',
      'recorder',
      'transcription',
      'ai',
      'context',
      'selection',
      'textInsertion',
      'tray',
      'window',
      'overlay'
    ];
  }

  register(name, service) {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} is already registered`);
    }
    this.services.set(name, service);
    return this;
  }

  get(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    console.log('Initializing services...');
    
    try {
      for (const serviceName of this.initOrder) {
        const service = this.services.get(serviceName);
        if (!service) {
          console.warn(`Warning: Service ${serviceName} not registered but in initialization order`);
          continue;
        }

        console.log(`Initializing ${serviceName} service...`);
        if (typeof service.initialize === 'function') {
          await service.initialize(this);
        }
        console.log(`${serviceName} service initialized`);
      }

      this.initialized = true;
      this.emit('initialized');
      console.log('All services initialized successfully');
    } catch (error) {
      console.error('Service initialization failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async shutdown() {
    console.log('Shutting down services...');
    
    // Shutdown in reverse order
    for (const serviceName of [...this.initOrder].reverse()) {
      const service = this.services.get(serviceName);
      if (!service) continue;

      try {
        if (typeof service.shutdown === 'function') {
          console.log(`Shutting down ${serviceName} service...`);
          await service.shutdown();
          console.log(`${serviceName} service shut down`);
        }
      } catch (error) {
        console.error(`Error shutting down ${serviceName} service:`, error);
      }
    }

    this.services.clear();
    this.initialized = false;
    this.emit('shutdown');
    console.log('All services shut down');
  }
}

module.exports = new ServiceRegistry(); 