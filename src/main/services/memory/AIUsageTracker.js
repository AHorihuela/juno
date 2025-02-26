/**
 * AIUsageTracker - Tracks AI usage statistics
 * 
 * This class is responsible for:
 * - Tracking AI token usage
 * - Providing insights into AI usage patterns
 * - Persisting usage statistics across sessions
 */

const fs = require('fs').promises;
const path = require('path');
const { MemoryStatsError } = require('./MemoryErrors');
const logger = require('../../utils/logger');

class AIUsageTracker {
  constructor() {
    this.initialized = false;
    this.statsFilePath = null;
    this.configService = null;
    
    // Initialize stats
    this.stats = {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      sessionPromptTokens: 0,
      sessionCompletionTokens: 0,
      sessionTokens: 0,
      dailyUsage: {},
      modelUsage: {},
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Initialize the AI usage tracker
   * 
   * @async
   * @param {Object} services - Service container for dependency injection
   * @returns {Promise<void>}
   * @throws {MemoryStatsError} If initialization fails
   */
  async initialize(services) {
    try {
      if (this.initialized) return;
      
      logger.info('[AIUsageTracker] Initializing');
      
      if (!services || !services.config) {
        throw new MemoryStatsError('Config service is required');
      }
      
      this.configService = services.config;
      
      // Get the app data directory from config service
      const appDataDir = this.configService.getAppDataPath();
      
      // Create stats directory if it doesn't exist
      const statsDir = path.join(appDataDir, 'stats');
      await this.ensureDirectoryExists(statsDir);
      
      // Set stats file path
      this.statsFilePath = path.join(statsDir, 'ai-usage.json');
      
      // Load existing stats if available
      await this.loadStats();
      
      this.initialized = true;
      logger.info('[AIUsageTracker] Initialized successfully');
    } catch (error) {
      const wrappedError = new MemoryStatsError('Failed to initialize AI usage tracker', { cause: error });
      logger.error('[AIUsageTracker] Initialization error:', wrappedError);
      throw wrappedError;
    }
  }
  
  /**
   * Ensure a directory exists, creating it if necessary
   * 
   * @async
   * @param {string} dirPath - Path to the directory
   * @returns {Promise<void>}
   * @throws {MemoryStatsError} If directory creation fails
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new MemoryStatsError(`Failed to create directory: ${dirPath}`, { cause: error });
    }
  }
  
  /**
   * Load AI usage statistics from disk
   * 
   * @async
   * @returns {Promise<void>}
   */
  async loadStats() {
    try {
      // Check if stats file exists
      try {
        await fs.access(this.statsFilePath);
      } catch (error) {
        // File doesn't exist, use default stats
        logger.info('[AIUsageTracker] AI usage stats file not found, starting with empty stats');
        return;
      }
      
      // Read and parse stats file
      const data = await fs.readFile(this.statsFilePath, 'utf8');
      
      try {
        const loadedStats = JSON.parse(data);
        
        // Merge loaded stats with default stats
        this.stats = {
          ...this.stats,
          ...loadedStats,
          // Reset session stats
          sessionPromptTokens: 0,
          sessionCompletionTokens: 0,
          sessionTokens: 0
        };
        
        logger.info('[AIUsageTracker] Loaded AI usage stats');
      } catch (parseError) {
        logger.error('[AIUsageTracker] Failed to parse AI usage stats file:', parseError);
        // Continue with default stats
      }
    } catch (error) {
      logger.error('[AIUsageTracker] Error loading AI usage stats:', error);
      // Continue with default stats
    }
  }
  
  /**
   * Save AI usage statistics to disk
   * 
   * @async
   * @returns {Promise<boolean>} Success status
   */
  async saveStats() {
    try {
      if (!this.initialized) {
        logger.warn('[AIUsageTracker] Not initialized, skipping save');
        return false;
      }
      
      logger.info('[AIUsageTracker] Saving AI usage stats');
      
      // Update timestamp
      this.stats.lastUpdated = Date.now();
      
      // Write stats to file
      const data = JSON.stringify(this.stats, null, 2);
      await fs.writeFile(this.statsFilePath, data, 'utf8');
      
      logger.info('[AIUsageTracker] AI usage stats saved successfully');
      return true;
    } catch (error) {
      logger.error('[AIUsageTracker] Error saving AI usage stats:', error);
      return false;
    }
  }
  
  /**
   * Track AI usage
   * 
   * @async
   * @param {Object} usage - Usage statistics
   * @param {number} usage.promptTokens - Number of prompt tokens
   * @param {number} usage.completionTokens - Number of completion tokens
   * @param {string} [usage.model] - AI model used
   * @returns {Promise<void>}
   */
  async trackUsage(usage) {
    try {
      if (!this.initialized) {
        logger.warn('[AIUsageTracker] Not initialized, skipping tracking');
        return;
      }
      
      if (!usage || typeof usage !== 'object') {
        logger.warn('[AIUsageTracker] Invalid usage data:', usage);
        return;
      }
      
      const promptTokens = parseInt(usage.promptTokens) || 0;
      const completionTokens = parseInt(usage.completionTokens) || 0;
      const totalTokens = promptTokens + completionTokens;
      const model = usage.model || 'unknown';
      
      // Update total stats
      this.stats.totalPromptTokens += promptTokens;
      this.stats.totalCompletionTokens += completionTokens;
      this.stats.totalTokens += totalTokens;
      
      // Update session stats
      this.stats.sessionPromptTokens += promptTokens;
      this.stats.sessionCompletionTokens += completionTokens;
      this.stats.sessionTokens += totalTokens;
      
      // Update daily usage
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      if (!this.stats.dailyUsage[today]) {
        this.stats.dailyUsage[today] = {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        };
      }
      
      this.stats.dailyUsage[today].promptTokens += promptTokens;
      this.stats.dailyUsage[today].completionTokens += completionTokens;
      this.stats.dailyUsage[today].totalTokens += totalTokens;
      
      // Update model usage
      if (!this.stats.modelUsage[model]) {
        this.stats.modelUsage[model] = {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        };
      }
      
      this.stats.modelUsage[model].promptTokens += promptTokens;
      this.stats.modelUsage[model].completionTokens += completionTokens;
      this.stats.modelUsage[model].totalTokens += totalTokens;
      
      // Update timestamp
      this.stats.lastUpdated = Date.now();
      
      // Periodically save stats (every 10 updates)
      if (Math.random() < 0.1) {
        await this.saveStats();
      }
    } catch (error) {
      logger.error('[AIUsageTracker] Error tracking AI usage:', error);
      // Don't throw, as this is non-critical functionality
    }
  }
  
  /**
   * Get AI usage statistics
   * 
   * @returns {Object} AI usage statistics
   */
  getStats() {
    return { ...this.stats };
  }
  
  /**
   * Get daily usage for a specific date range
   * 
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Object} Daily usage statistics
   */
  getDailyUsage(startDate, endDate) {
    try {
      const result = {};
      
      // If no dates provided, return all daily usage
      if (!startDate && !endDate) {
        return { ...this.stats.dailyUsage };
      }
      
      // Convert dates to timestamps for comparison
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Date.now();
      
      // Filter daily usage by date range
      Object.entries(this.stats.dailyUsage).forEach(([date, usage]) => {
        const dateTimestamp = new Date(date).getTime();
        
        if (dateTimestamp >= start && dateTimestamp <= end) {
          result[date] = usage;
        }
      });
      
      return result;
    } catch (error) {
      logger.error('[AIUsageTracker] Error getting daily usage:', error);
      return {};
    }
  }
  
  /**
   * Get model usage statistics
   * 
   * @returns {Object} Model usage statistics
   */
  getModelUsage() {
    return { ...this.stats.modelUsage };
  }
  
  /**
   * Get session usage statistics
   * 
   * @returns {Object} Session usage statistics
   */
  getSessionUsage() {
    return {
      promptTokens: this.stats.sessionPromptTokens,
      completionTokens: this.stats.sessionCompletionTokens,
      totalTokens: this.stats.sessionTokens
    };
  }
}

module.exports = AIUsageTracker; 