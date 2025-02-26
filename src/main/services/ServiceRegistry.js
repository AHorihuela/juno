const { EventEmitter } = require('events');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('ServiceRegistry');

class ServiceRegistry extends EventEmitter {
  constructor() {
    super();
    this.services = new Map();
    this.initialized = false;
    this.initOrder = [
      'config',
      'resource',
      'ipc',
      'logging',
      'notification',
      'dictionary',
      'textProcessing',
      'audio',
      'recorder',
      'transcription',
      'ai',
      'context',
      'selection',
      'textInsertion',
      'tray',
      'windowManager',
      'overlay'
    ];
  }

  register(name, service) {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} is already registered`);
    }
    logger.debug(`Registering service: ${name}`);
    this.services.set(name, service);
    return this;
  }

  get(name) {
    const service = this.services.get(name);
    if (!service) {
      logger.error(`Service not found: ${name}`);
      throw new Error(`Service ${name} not found`);
    }
    return service;
  }

  getAll() {
    const servicesObject = {};
    this.services.forEach((service, name) => {
      servicesObject[name] = service;
    });
    return servicesObject;
  }

  async initialize() {
    if (this.initialized) {
      logger.warn('ServiceRegistry is already initialized');
      return;
    }

    logger.info('Initializing services...');
    
    // Initialize services in order
    for (const serviceName of this.initOrder) {
      const service = this.services.get(serviceName);
      if (service) {
        logger.info(`Initializing service: ${serviceName}`);
        try {
          await service.initialize(this);
          logger.info(`Service initialized: ${serviceName}`);
        } catch (error) {
          logger.error(`Failed to initialize service: ${serviceName}`, { metadata: { error } });
          throw error;
        }
      }
    }

    // Initialize any remaining services not in the initOrder
    for (const [name, service] of this.services.entries()) {
      if (!this.initOrder.includes(name)) {
        logger.info(`Initializing additional service: ${name}`);
        try {
          await service.initialize(this);
          logger.info(`Additional service initialized: ${name}`);
        } catch (error) {
          logger.error(`Failed to initialize additional service: ${name}`, { metadata: { error } });
          throw error;
        }
      }
    }

    this.initialized = true;
    logger.info('All services initialized successfully');
    this.emit('initialized');
  }

  async shutdown() {
    if (!this.initialized) {
      logger.warn('ServiceRegistry is not initialized, nothing to shut down');
      return;
    }

    logger.info('Shutting down services...');
    
    // Shutdown in reverse order
    const reverseOrder = [...this.initOrder].reverse();
    
    for (const serviceName of reverseOrder) {
      const service = this.services.get(serviceName);
      if (service) {
        logger.info(`Shutting down service: ${serviceName}`);
        try {
          await service.shutdown();
          logger.info(`Service shut down: ${serviceName}`);
        } catch (error) {
          logger.error(`Error shutting down service: ${serviceName}`, { metadata: { error } });
          // Continue shutting down other services even if one fails
        }
      }
    }

    // Shutdown any remaining services not in the initOrder
    for (const [name, service] of this.services.entries()) {
      if (!this.initOrder.includes(name)) {
        logger.info(`Shutting down additional service: ${name}`);
        try {
          await service.shutdown();
          logger.info(`Additional service shut down: ${name}`);
        } catch (error) {
          logger.error(`Error shutting down additional service: ${name}`, { metadata: { error } });
          // Continue shutting down other services even if one fails
        }
      }
    }

    this.initialized = false;
    logger.info('All services shut down');
    this.emit('shutdown');
  }
}

module.exports = ServiceRegistry; 