const { ipcMain } = require('electron');
const BaseService = require('../BaseService');
const AppNameProvider = require('./AppNameProvider');
const ElectronSelectionStrategy = require('./ElectronSelectionStrategy');
const AccessibilitySelectionStrategy = require('./AccessibilitySelectionStrategy');
const ClipboardSelectionStrategy = require('./ClipboardSelectionStrategy');
const LogManager = require('../../utils/LogManager');

// Get a logger instance
const logger = LogManager.getLogger('SelectionService');

/**
 * Service for getting selected text from the active application
 * Using optimized parallel strategy execution and improved caching
 */
class SelectionService extends BaseService {
  constructor() {
    super('Selection');
    
    // Selection cache for performance optimization (increased TTL)
    this.selectionCache = { text: '', timestamp: 0 };
    this.selectionCacheTTL = 5000; // 5 seconds (increased from 1 second)
    
    // Debouncing for performance optimization
    this.pendingSelectionRequest = null;
    this.debounceTime = 300; // 300ms
    this.lastSelectionTime = 0;
    
    // Timeouts for strategy execution
    this.timeouts = {
      parallelExecution: 2000,   // 2 seconds for parallel execution
      sequentialExecution: 800,  // 800ms per strategy when running sequentially
      selectionOperation: 3000   // 3 seconds for the entire selection operation
    };
    
    // Cancellation support
    this.currentExecutions = new Map();
    
    // IPC handler for renderer process
    this.ipcHandler = null;
  }

  async _initialize() {
    // Create app name provider
    this.appNameProvider = new AppNameProvider();
    
    // Create selection strategies with optimized timeouts
    this.strategies = [
      new ElectronSelectionStrategy(),
      new AccessibilitySelectionStrategy(500), // Reduced timeout
      new ClipboardSelectionStrategy(this.getService('context'), 800) // Optimized timeout
    ];
    
    // Set up IPC handler for getting selected text from renderer
    this.ipcHandler = async () => {
      return await this.getSelectedText();
    };

    ipcMain.handle('get-selected-text-from-renderer', this.ipcHandler);
    
    // Preload app name for better performance
    await this.appNameProvider.preloadAppName().catch(error => {
      logger.error('Failed to preload app name:', error);
    });
    
    logger.debug('SelectionService initialized');
  }

  async _shutdown() {
    if (this.ipcHandler) {
      ipcMain.removeHandler('get-selected-text-from-renderer');
      this.ipcHandler = null;
    }
    
    // Cancel any pending selection requests
    if (this.pendingSelectionRequest) {
      clearTimeout(this.pendingSelectionRequest);
      this.pendingSelectionRequest = null;
    }
    
    // Cancel any running executions
    this.cancelAllExecutions();
    
    // Clear references to strategies
    this.strategies = null;
    this.appNameProvider = null;
    
    logger.debug('SelectionService shutdown complete');
  }
  
  /**
   * Cancel all running executions
   * @private
   */
  cancelAllExecutions() {
    if (this.currentExecutions.size > 0) {
      logger.debug(`Cancelling ${this.currentExecutions.size} running executions`);
      for (const timeout of this.currentExecutions.values()) {
        clearTimeout(timeout);
      }
      this.currentExecutions.clear();
    }
  }

  /**
   * Get selected text from the active application with debouncing
   * Uses parallel execution by default for better performance
   * @returns {Promise<string>} Selected text or empty string if none
   */
  async getSelectedText() {
    // Implement debouncing to prevent rapid consecutive calls
    const now = Date.now();
    if (now - this.lastSelectionTime < this.debounceTime) {
      logger.debug('Debouncing selection request');
      
      // Return cached selection if available and recent
      if (this.selectionCache.text && (now - this.selectionCache.timestamp < this.selectionCacheTTL)) {
        logger.debug('Returning cached selection due to debounce');
        return this.selectionCache.text;
      }
      
      // Set up a debounced request
      return new Promise((resolve) => {
        if (this.pendingSelectionRequest) {
          clearTimeout(this.pendingSelectionRequest);
        }
        
        this.pendingSelectionRequest = setTimeout(async () => {
          // Use parallel execution for better performance
          const text = await this.getSelectionInParallel();
          this.pendingSelectionRequest = null;
          resolve(text);
        }, this.debounceTime);
      });
    }
    
    // Update last selection time
    this.lastSelectionTime = now;
    
    // Use parallel execution by default for better performance
    return this.getSelectionInParallel();
  }
  
  /**
   * Implementation of selection detection using sequential strategy execution
   * Kept for compatibility with older code
   * @returns {Promise<string>} Selected text or empty string if none
   * @private
   */
  async _getSelectedTextImpl() {
    if (process.platform !== 'darwin') {
      logger.debug('Platform not supported for getting selected text');
      return '';
    }

    try {
      logger.debug('Starting selection detection (sequential)');
      
      // First get the active app name
      const appName = await this.appNameProvider.getActiveAppName();
      logger.debug('Active application:', appName);

      if (!appName) {
        logger.debug('Could not determine active application');
        return '';
      }
      
      // Find applicable strategies for this app
      const applicableStrategies = this.strategies.filter(strategy => 
        strategy.isApplicable(appName)
      );
      
      if (applicableStrategies.length === 0) {
        logger.debug('No applicable strategies found for app:', appName);
        return '';
      }
      
      logger.debug('Using strategies:', 
        applicableStrategies.map(s => s.name).join(', ')
      );
      
      // Try each strategy in sequence with timeouts
      let selectedText = '';
      for (const strategy of applicableStrategies) {
        try {
          // Create a promise with timeout
          const timeoutPromise = new Promise((_, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`Strategy ${strategy.name} timed out after ${this.timeouts.sequentialExecution}ms`));
            }, this.timeouts.sequentialExecution);
            this.currentExecutions.set(strategy.name, timeoutId);
          });
          
          // Race the strategy execution against the timeout
          const result = await Promise.race([
            strategy.getSelection(appName),
            timeoutPromise
          ]);
          
          // Clear the timeout
          if (this.currentExecutions.has(strategy.name)) {
            clearTimeout(this.currentExecutions.get(strategy.name));
            this.currentExecutions.delete(strategy.name);
          }
          
          if (result.success && result.text) {
            selectedText = result.text;
            logger.debug(`Got selection using ${strategy.name} strategy`);
            break;
          }
        } catch (strategyError) {
          logger.warn(`Strategy ${strategy.name} failed:`, strategyError);
          // Continue with next strategy
        }
      }
      
      // Cache the selection for potential recovery
      if (selectedText) {
        this.selectionCache = {
          text: selectedText,
          timestamp: Date.now()
        };
      }
      
      logger.debug('Selection detection completed:', {
        hasSelection: Boolean(selectedText),
        selectionLength: selectedText?.length || 0
      });

      return selectedText || '';
    } catch (error) {
      logger.error('Failed to get selected text:', error);
      
      // If we have a recent selection cache, use it as fallback
      const now = Date.now();
      if (this.selectionCache.text && (now - this.selectionCache.timestamp) < 5000) {
        logger.debug('Using cached selection as fallback');
        return this.selectionCache.text;
      }
      
      this.emitError(error);
      return '';
    } finally {
      // Clean up any remaining timeouts
      this.cancelAllExecutions();
    }
  }
  
  /**
   * Get the active app name (for compatibility with old API)
   * @returns {Promise<string>} Name of the active application
   */
  async getCachedActiveAppName() {
    if (!this.appNameProvider) {
      logger.warn('AppNameProvider not initialized yet');
      return '';
    }
    return await this.appNameProvider.getActiveAppName();
  }
  
  /**
   * Get the active app name without caching (for compatibility with old API)
   * @returns {Promise<string>} Name of the active application
   */
  async getActiveAppName() {
    if (!this.appNameProvider) {
      logger.warn('AppNameProvider not initialized yet');
      return '';
    }
    // Force a fresh app name by invalidating the cache first
    this.appNameProvider.invalidateCache();
    return await this.appNameProvider.getActiveAppName();
  }
  
  /**
   * Get selection from Electron apps using IPC (for compatibility with old API)
   * @returns {Promise<string>} Selected text
   */
  async getElectronAppSelection() {
    const electronStrategy = this.strategies?.find(s => s.name === 'Electron');
    if (!electronStrategy) {
      logger.warn('Electron strategy not found');
      return '';
    }
    const result = await electronStrategy.getSelection('Electron');
    return result.text || '';
  }
  
  /**
   * Get selection using macOS Accessibility API (for compatibility with old API)
   * @param {string} appName - Name of the active application
   * @returns {Promise<string>} Selected text
   */
  async getSelectionViaAccessibility(appName) {
    const accessibilityStrategy = this.strategies?.find(s => s.name === 'Accessibility');
    if (!accessibilityStrategy) {
      logger.warn('Accessibility strategy not found');
      return '';
    }
    const result = await accessibilityStrategy.getSelection(appName);
    return result.text || '';
  }
  
  /**
   * Get selection using clipboard method as fallback (for compatibility with old API)
   * @param {string} appName - Name of the active application
   * @returns {Promise<string>} Selected text
   */
  async getSelectionViaClipboard(appName) {
    const clipboardStrategy = this.strategies?.find(s => s.name === 'Clipboard');
    if (!clipboardStrategy) {
      logger.warn('Clipboard strategy not found');
      return '';
    }
    const result = await clipboardStrategy.getSelection(appName);
    return result.text || '';
  }
  
  /**
   * Preload app name for better performance in subsequent calls
   * This can be called during app initialization or when user activity is detected
   */
  async preloadAppName() {
    return this.appNameProvider.preloadAppName();
  }
  
  /**
   * Invalidate the app name cache
   * This can be called when the user switches applications
   */
  invalidateAppNameCache() {
    this.appNameProvider.invalidateCache();
  }

  /**
   * Gets the selection by trying all applicable strategies in parallel
   * Returns the first non-empty result from any strategy
   * @returns {Promise<string>} The selected text
   */
  async getSelectionInParallel() {
    // Set up an overall timeout for the entire operation
    let operationTimeoutId;
    const operationTimeoutPromise = new Promise((_, reject) => {
      operationTimeoutId = setTimeout(() => {
        reject(new Error(`Selection operation timed out after ${this.timeouts.selectionOperation}ms`));
      }, this.timeouts.selectionOperation);
    });
    
    try {
      // Get app name with optimization - use cached or quick retrieval
      const appName = await this.appNameProvider.getActiveAppName();
      logger.debug(`Getting selection in parallel for app: ${appName}`);
      
      // If no app name, return empty early
      if (!appName) {
        logger.debug('No active app name found, returning empty selection');
        return '';
      }
      
      // Filter applicable strategies
      const applicableStrategies = this.strategies.filter(strategy => 
        strategy.isApplicable(appName)
      );
      
      if (applicableStrategies.length === 0) {
        logger.debug(`No applicable selection strategy found for app: ${appName}`);
        return '';
      }
      
      logger.debug(`Trying ${applicableStrategies.length} strategies in parallel`);
      
      // Create a promise for each strategy with individual timeouts
      const selectionPromises = applicableStrategies.map(strategy => {
        // Create a timeout for this strategy
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            logger.debug(`Strategy ${strategy.name} timed out after ${this.timeouts.parallelExecution}ms`);
            reject(new Error(`Strategy ${strategy.name} timed out`));
          }, this.timeouts.parallelExecution);
          this.currentExecutions.set(`${strategy.name}_parallel`, timeoutId);
        });
        
        // Race the strategy against its timeout
        return Promise.race([
          strategy.getSelection(appName)
            .then(selection => {
              // Clear timeout on success
              clearTimeout(timeoutId);
              this.currentExecutions.delete(`${strategy.name}_parallel`);
              logger.debug(`Strategy ${strategy.name} returned: ${selection.success ? 'success' : 'failure'}`);
              return { strategy: strategy.name, selection };
            }),
          timeoutPromise.catch(error => {
            return { strategy: strategy.name, selection: { text: '', success: false }, error };
          })
        ]);
      });
      
      // Race the strategy promises and the overall timeout
      const results = await Promise.race([
        Promise.all(selectionPromises),
        operationTimeoutPromise.then(() => [])
      ]);
      
      // Clean up the operation timeout
      clearTimeout(operationTimeoutId);
      
      // Find the first non-empty successful result
      const successfulResult = results.find(result => 
        result.selection && result.selection.success && result.selection.text
      );
      
      if (successfulResult) {
        logger.debug(`Using result from strategy: ${successfulResult.strategy}`);
        
        // Cache the successful result
        this.selectionCache = {
          text: successfulResult.selection.text,
          timestamp: Date.now()
        };
        
        return successfulResult.selection.text;
      }
      
      // If all strategies returned empty or failed
      const emptyCacheTime = Date.now() - this.selectionCache.timestamp;
      if (this.selectionCache.text && emptyCacheTime < 10000) {
        // Use recent cache as fallback if all current strategies failed
        logger.debug('All parallel strategies failed, using recent cache as fallback');
        return this.selectionCache.text;
      }
      
      logger.debug('All parallel selection strategies failed or returned empty results');
      return '';
    } catch (error) {
      logger.error('Error in parallel selection:', error);
      
      // Check if we have a recent cache to use as fallback
      if (this.selectionCache.text && (Date.now() - this.selectionCache.timestamp < 10000)) {
        logger.debug('Using cached selection as fallback after error');
        return this.selectionCache.text;
      }
      
      return '';
    } finally {
      // Clean up all timeouts
      clearTimeout(operationTimeoutId);
      this.cancelAllExecutions();
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new SelectionService(); 