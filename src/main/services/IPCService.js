/**
 * IPCService - Service wrapper for IPCRegistry
 * 
 * This service wraps the IPCRegistry to provide a BaseService-compatible interface
 * for the service registry.
 */

const BaseService = require('./BaseService');
const ipcRegistry = require('../ipc/IPCRegistry');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('IPCService');

class IPCService extends BaseService {
  constructor() {
    super('IPC');
    this.registry = ipcRegistry;
  }

  async _initialize() {
    logger.info('Initializing IPCService');
    // No initialization needed for IPCRegistry
    logger.info('IPCService initialized');
  }

  async _shutdown() {
    logger.info('Shutting down IPCService');
    // Unregister all handlers
    this.registry.unregisterAll();
    logger.info('IPCService shut down');
  }

  // Delegate methods to the IPCRegistry
  register(channel, handler, options) {
    logger.debug(`Registering handler for channel: ${channel}`);
    return this.registry.register(channel, handler, options);
  }

  unregister(channel) {
    logger.debug(`Unregistering handler for channel: ${channel}`);
    return this.registry.unregister(channel);
  }

  isValidChannel(channel) {
    return this.registry.isValidChannel(channel);
  }

  getRegisteredChannels() {
    return this.registry.getRegisteredChannels();
  }

  unregisterAll() {
    logger.debug('Unregistering all handlers');
    return this.registry.unregisterAll();
  }
}

module.exports = () => new IPCService(); 