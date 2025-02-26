/**
 * MemoryPersistence - Handles saving and loading memory from disk
 * 
 * This class is responsible for:
 * - Saving long-term memory to disk
 * - Loading long-term memory from disk
 * - Managing the persistence format and location
 */

const fs = require('fs').promises;
const path = require('path');
const { MemoryStorageError } = require('./MemoryErrors');
const logger = require('../../utils/logger');

class MemoryPersistence {
  constructor() {
    this.initialized = false;
    this.memoryFilePath = null;
    this.configService = null;
  }
  
  /**
   * Initialize the memory persistence service
   * 
   * @async
   * @param {Object} services - Service container for dependency injection
   * @returns {Promise<void>}
   * @throws {MemoryStorageError} If initialization fails
   */
  async initialize(services) {
    try {
      if (this.initialized) return;
      
      logger.info('[MemoryPersistence] Initializing');
      
      if (!services || !services.config) {
        throw new MemoryStorageError('Config service is required');
      }
      
      this.configService = services.config;
      
      // Get the app data directory from config service
      const appDataDir = this.configService.getAppDataPath();
      
      // Create memory directory if it doesn't exist
      const memoryDir = path.join(appDataDir, 'memory');
      await this.ensureDirectoryExists(memoryDir);
      
      // Set memory file path
      this.memoryFilePath = path.join(memoryDir, 'long-term-memory.json');
      
      this.initialized = true;
      logger.info('[MemoryPersistence] Initialized successfully');
    } catch (error) {
      const wrappedError = new MemoryStorageError('Failed to initialize memory persistence', { cause: error });
      logger.error('[MemoryPersistence] Initialization error:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Ensure a directory exists, creating it if necessary
   * 
   * @async
   * @param {string} dirPath - Path to the directory
   * @returns {Promise<void>}
   * @throws {MemoryStorageError} If directory creation fails
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new MemoryStorageError(`Failed to create directory: ${dirPath}`, { cause: error });
    }
  }
  
  /**
   * Load long-term memory from disk
   * 
   * @async
   * @returns {Promise<Array>} Long-term memory items
   * @throws {MemoryStorageError} If loading fails
   */
  async loadLongTermMemory() {
    try {
      if (!this.initialized) {
        throw new MemoryStorageError('Memory persistence not initialized');
      }
      
      logger.info('[MemoryPersistence] Loading long-term memory');
      
      // Check if memory file exists
      try {
        await fs.access(this.memoryFilePath);
      } catch (error) {
        // File doesn't exist, return empty array
        logger.info('[MemoryPersistence] Long-term memory file not found, starting with empty memory');
        return [];
      }
      
      // Read and parse memory file
      const data = await fs.readFile(this.memoryFilePath, 'utf8');
      
      try {
        const memory = JSON.parse(data);
        
        if (!Array.isArray(memory)) {
          throw new MemoryStorageError('Invalid memory format: not an array');
        }
        
        logger.info(`[MemoryPersistence] Loaded ${memory.length} long-term memory items`);
        return memory;
      } catch (parseError) {
        throw new MemoryStorageError('Failed to parse memory file', { cause: parseError });
      }
    } catch (error) {
      // If this is not a critical error (e.g., file doesn't exist yet),
      // log a warning and return an empty array
      if (error.code === 'ENOENT') {
        logger.warn('[MemoryPersistence] Long-term memory file not found, starting with empty memory');
        return [];
      }
      
      const wrappedError = new MemoryStorageError('Failed to load long-term memory', { cause: error });
      logger.error('[MemoryPersistence] Error loading long-term memory:', wrappedError);
      
      // Return empty array instead of throwing to allow the app to continue
      return [];
    }
  }
  
  /**
   * Save long-term memory to disk
   * 
   * @async
   * @param {Array} memory - Long-term memory items to save
   * @returns {Promise<boolean>} Success status
   * @throws {MemoryStorageError} If saving fails
   */
  async saveLongTermMemory(memory) {
    try {
      if (!this.initialized) {
        throw new MemoryStorageError('Memory persistence not initialized');
      }
      
      if (!Array.isArray(memory)) {
        throw new MemoryStorageError('Invalid memory format: not an array');
      }
      
      logger.info(`[MemoryPersistence] Saving ${memory.length} long-term memory items`);
      
      // Create a backup of the existing file if it exists
      try {
        const stats = await fs.stat(this.memoryFilePath);
        
        if (stats.isFile()) {
          const backupPath = `${this.memoryFilePath}.backup`;
          await fs.copyFile(this.memoryFilePath, backupPath);
          logger.info('[MemoryPersistence] Created backup of long-term memory file');
        }
      } catch (error) {
        // File doesn't exist yet, no need for backup
        if (error.code !== 'ENOENT') {
          logger.warn('[MemoryPersistence] Failed to create backup:', error);
        }
      }
      
      // Write memory to file
      const data = JSON.stringify(memory, null, 2);
      await fs.writeFile(this.memoryFilePath, data, 'utf8');
      
      logger.info('[MemoryPersistence] Long-term memory saved successfully');
      return true;
    } catch (error) {
      const wrappedError = new MemoryStorageError('Failed to save long-term memory', { cause: error });
      logger.error('[MemoryPersistence] Error saving long-term memory:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Get the path to the memory file
   * 
   * @returns {string} Path to the memory file
   */
  getMemoryFilePath() {
    return this.memoryFilePath;
  }
}

module.exports = MemoryPersistence; 