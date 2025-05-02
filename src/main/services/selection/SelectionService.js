const { ipcMain } = require('electron');
const BaseService = require('../BaseService');
const AppNameProvider = require('./AppNameProvider');
const ElectronSelectionStrategy = require('./ElectronSelectionStrategy');
const AccessibilitySelectionStrategy = require('./AccessibilitySelectionStrategy');
const ClipboardSelectionStrategy = require('./ClipboardSelectionStrategy');
const LogManager = require('../../utils/LogManager');
const { EventEmitter } = require('events');
const { clipboard } = require('electron');
const os = require('os');
const { exec } = require('child_process');

// Get a logger instance
const logger = LogManager.getLogger('SelectionService');

/**
 * SelectionService responsible for retrieving selected text and active application
 * 
 * This service:
 * - Gets the currently selected text from active applications
 * - Retrieves the active application name
 * - Handles platform-specific selection methods
 */
class SelectionService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.initialized = false;
    this.options = {
      // Default selection method based on platform
      selectionMethod: this._getDefaultSelectionMethod(),
      ...options
    };
    
    this.services = null;
    this.platform = os.platform();
    
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
    
    // Initialize AppNameProvider
    this.appNameProvider = new AppNameProvider();
    
    // Initialize strategies
    this.strategies = [
      new ElectronSelectionStrategy(),
      new AccessibilitySelectionStrategy(),
      new ClipboardSelectionStrategy()
    ];
  }
  
  /**
   * Initialize the service
   * @param {ServiceRegistry} services Service registry
   * @returns {Promise<void>}
   */
  async initialize(services) {
    if (this.initialized) {
      return;
    }
    
    logger.info('Initializing selection service');
    this.services = services;
    
    try {
      // Load configuration
      const configService = services.get('config');
      if (configService) {
        const selectionConfig = await configService.getConfig('selection') || {};
        if (selectionConfig.method) {
          this.options.selectionMethod = selectionConfig.method;
        }
        
        logger.debug(`Selection service configured with method: ${this.options.selectionMethod}`);
      } else {
        logger.warn('Config service not available, using default selection settings');
      }
      
      // Preload app name to warm up the cache
      try {
        logger.debug('Preloading app name...');
        await this.appNameProvider.preloadAppName();
        logger.debug('App name preloaded successfully');
      } catch (appNameError) {
        logger.warn('Failed to preload app name:', appNameError);
      }
      
      this.initialized = true;
      logger.info('Selection service initialized successfully');
    } catch (error) {
      logger.error('Error initializing selection service:', error);
      throw error;
    }
  }
  
  /**
   * Shutdown the service
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('Shutting down selection service');
    this.initialized = false;
    
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
   * Get the currently selected text
   * @returns {Promise<string>} Selected text
   */
  async getSelectedText() {
    try {
      logger.debug('Getting selected text');
      
      const selectedText = await this._getSelectionByMethod(this.options.selectionMethod);
      
      logger.debug(`Retrieved selected text: ${selectedText ? 
        `"${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}" (${selectedText.length} chars)` : 
        'none'}`);
        
      return selectedText || '';
    } catch (error) {
      logger.error('Error getting selected text:', error);
      this.emit('error', error);
      return '';
    }
  }
  
  /**
   * Get the name of the active application
   * @returns {Promise<string>} Application name
   */
  async getActiveAppName() {
    try {
      logger.debug('Getting active application name');
      
      let appName = 'unknown';
      
      if (this.platform === 'darwin') {
        appName = await this._getMacAppName();
      } else if (this.platform === 'win32') {
        appName = await this._getWindowsAppName();
      } else if (this.platform === 'linux') {
        appName = await this._getLinuxAppName();
      }
      
      logger.debug(`Active application: ${appName}`);
      return appName;
    } catch (error) {
      logger.error('Error getting active application name:', error);
      return 'unknown';
    }
  }
  
  /**
   * Get selected text using specified method
   * @param {string} method Selection method to use
   * @returns {Promise<string>} Selected text
   * @private
   */
  async _getSelectionByMethod(method) {
    switch (method) {
      case 'clipboard':
        return this._getSelectionFromClipboard();
      case 'macos-script':
        return this._getMacOSSelection();
      case 'windows-powershell':
        return this._getWindowsSelection();
      case 'linux-xclip':
        return this._getLinuxSelection();
      default:
        logger.warn(`Unknown selection method: ${method}, falling back to clipboard`);
        return this._getSelectionFromClipboard();
    }
  }
  
  /**
   * Get default selection method based on platform
   * @returns {string} Default selection method
   * @private
   */
  _getDefaultSelectionMethod() {
    const platform = os.platform();
    
    if (platform === 'darwin') {
      return 'macos-script';
    } else if (platform === 'win32') {
      return 'windows-powershell';
    } else if (platform === 'linux') {
      return 'linux-xclip';
    } else {
      return 'clipboard';
    }
  }
  
  /**
   * Get selection from clipboard
   * @returns {Promise<string>} Selected text
   * @private
   */
  async _getSelectionFromClipboard() {
    try {
      // Save original clipboard
      const originalClipboard = clipboard.readText();
      
      // Simulate copy command (platform specific)
      await this._simulateCopyCommand();
      
      // Wait a bit for clipboard to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Read the selection from clipboard
      const selection = clipboard.readText();
      
      // Restore original clipboard
      clipboard.writeText(originalClipboard);
      
      return selection;
    } catch (error) {
      logger.error('Error getting selection from clipboard:', error);
      return '';
    }
  }
  
  /**
   * Simulate copy command based on platform
   * @returns {Promise<void>}
   * @private
   */
  async _simulateCopyCommand() {
    return new Promise((resolve, reject) => {
      try {
        if (this.platform === 'darwin') {
          // macOS
          exec('osascript -e \'tell application "System Events" to keystroke "c" using command down\'', (error) => {
            if (error) {
              logger.warn('Error simulating copy on macOS:', error);
            }
            resolve();
          });
        } else if (this.platform === 'win32') {
          // Windows
          exec('powershell -command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys(\'^c\')"', (error) => {
            if (error) {
              logger.warn('Error simulating copy on Windows:', error);
            }
            resolve();
          });
        } else if (this.platform === 'linux') {
          // Linux
          exec('xdotool key ctrl+c', (error) => {
            if (error) {
              logger.warn('Error simulating copy on Linux:', error);
            }
            resolve();
          });
        } else {
          resolve();
        }
      } catch (error) {
        logger.error('Error simulating copy command:', error);
        resolve();
      }
    });
  }
  
  /**
   * Get selection on macOS using AppleScript
   * @returns {Promise<string>} Selected text
   * @private
   */
  async _getMacOSSelection() {
    return new Promise((resolve, reject) => {
      // First, try to get selection from frontmost app
      const script = `
        tell application "System Events"
          set frontApp to name of first process whose frontmost is true
          tell process frontApp
            set selectedText to ""
            try
              set selectedText to value of attribute "AXSelectedText" of (first text area whose focused is true)
            end try
            if selectedText is "" then
              try
                set selectedText to value of attribute "AXSelectedText" of (first text field whose focused is true)
              end try
            end if
            return selectedText
          end tell
        end tell
      `;
      
      exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
        if (error) {
          logger.warn('Error getting macOS selection with AppleScript:', error);
          // Fall back to clipboard method
          this._getSelectionFromClipboard().then(resolve).catch(reject);
          return;
        }
        
        resolve(stdout.trim());
      });
    });
  }
  
  /**
   * Get selection on Windows using PowerShell
   * @returns {Promise<string>} Selected text
   * @private
   */
  async _getWindowsSelection() {
    // For Windows, we'll use clipboard as the most reliable method
    return this._getSelectionFromClipboard();
  }
  
  /**
   * Get selection on Linux using xclip
   * @returns {Promise<string>} Selected text
   * @private
   */
  async _getLinuxSelection() {
    return new Promise((resolve, reject) => {
      // Try to use xclip to get the X selection
      exec('xclip -o -selection primary', (error, stdout, stderr) => {
        if (error) {
          logger.warn('Error getting Linux selection with xclip:', error);
          // Fall back to clipboard method
          this._getSelectionFromClipboard().then(resolve).catch(reject);
          return;
        }
        
        resolve(stdout.trim());
      });
    });
  }
  
  /**
   * Get application name on macOS
   * @returns {Promise<string>} Application name
   * @private
   */
  async _getMacAppName() {
    return new Promise((resolve) => {
      const script = `tell application "System Events" to get name of first process whose frontmost is true`;
      
      exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
        if (error) {
          logger.warn('Error getting macOS app name:', error);
          resolve('unknown');
          return;
        }
        
        resolve(stdout.trim());
      });
    });
  }
  
  /**
   * Get application name on Windows
   * @returns {Promise<string>} Application name
   * @private
   */
  async _getWindowsAppName() {
    return new Promise((resolve) => {
      const command = 'powershell -command "Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Sort-Object -Property WS -Descending | Select-Object -First 1 -ExpandProperty ProcessName"';
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.warn('Error getting Windows app name:', error);
          resolve('unknown');
          return;
        }
        
        resolve(stdout.trim());
      });
    });
  }
  
  /**
   * Get application name on Linux
   * @returns {Promise<string>} Application name
   * @private
   */
  async _getLinuxAppName() {
    return new Promise((resolve) => {
      // Try to use xdotool to get active window
      exec('xdotool getwindowfocus getwindowname', (error, stdout, stderr) => {
        if (error) {
          logger.warn('Error getting Linux app name:', error);
          resolve('unknown');
          return;
        }
        
        resolve(stdout.trim());
      });
    });
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
   * Get selected text using parallel strategy execution for better reliability
   * All applicable strategies are run in parallel with individual timeouts
   * @returns {Promise<string>} Selected text or empty string if none found
   */
  async getSelectionInParallel() {
    if (process.platform !== 'darwin') {
      logger.debug('Platform not supported for getting selected text');
      return '';
    }

    try {
      logger.debug('Getting selection in parallel for app:', await this.appNameProvider.getActiveAppName());
      
      // Get active app name (cached if available)
      const appName = await this.getCachedActiveAppName().catch(err => {
        logger.warn('Error getting app name for selection:', err);
        return '';
      });
      
      if (!appName) {
        logger.debug('Could not determine active application');
        return '';
      }
      
      logger.debug('Trying 3 strategies in parallel');

      // Create a promise that resolves with selection results
      const selectionPromise = new Promise(async (resolve) => {
        // Track which strategies have completed
        const results = [];
        let strategiesCompleted = 0;
        
        // Apply all strategies in parallel with individual timeouts
        for (const strategy of this.strategies) {
          // Check if the strategy is applicable
          if (!strategy.isApplicable(appName)) {
            strategiesCompleted++;
            results.push({ strategy: strategy.name, result: { success: false } });
            continue;
          }
          
          // Execute each strategy with its own timeout
          try {
            const timeoutPromise = new Promise((_, reject) => {
              const timeoutId = setTimeout(() => {
                reject(new Error(`Strategy ${strategy.name} timed out`));
              }, this.timeouts.sequentialExecution);
              this.currentExecutions.set(strategy.name, timeoutId);
            });
            
            // Race the strategy execution against its timeout
            const result = await Promise.race([
              strategy.getSelection(appName),
              timeoutPromise
            ]).catch(error => {
              logger.debug(`Strategy ${strategy.name} returned:`, 'failure');
              return { success: false, error };
            });
            
            // Clear the timeout
            if (this.currentExecutions.has(strategy.name)) {
              clearTimeout(this.currentExecutions.get(strategy.name));
              this.currentExecutions.delete(strategy.name);
            }
            
            strategiesCompleted++;
            results.push({ strategy: strategy.name, result });
            
            // If we found a successful result with text, store it in cache for potential recovery
            if (result.success && result.text) {
              logger.debug(`Strategy ${strategy.name} returned:`, 'success');
              this.selectionCache = {
                text: result.text,
                timestamp: Date.now()
              };
            }
          } catch (error) {
            strategiesCompleted++;
            results.push({ strategy: strategy.name, result: { success: false, error } });
            logger.debug(`Strategy ${strategy.name} returned:`, 'failure');
          }
          
          // If all strategies have completed, resolve with the best result
          if (strategiesCompleted === this.strategies.length) {
            // Find the first successful result with text
            const successfulResult = results.find(r => r.result.success && r.result.text);
            if (successfulResult) {
              logger.debug('Using result from strategy:', successfulResult.strategy);
              resolve(successfulResult.result.text);
            } else {
              logger.debug('No successful selection strategies found');
              resolve('');
            }
          }
        }
      });
      
      // Add a global timeout for the entire selection operation
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          logger.debug('Selection operation timed out after', this.timeouts.parallelExecution, 'ms');
          
          // If we have a recent cache, use it
          if (this.selectionCache.text && 
              (Date.now() - this.selectionCache.timestamp < this.selectionCacheTTL)) {
            logger.debug('Using cached selection due to timeout');
            resolve(this.selectionCache.text);
          } else {
            resolve('');
          }
        }, this.timeouts.parallelExecution);
      });
      
      // Race the selection operation against the global timeout
      return await Promise.race([selectionPromise, timeoutPromise]);
    } catch (error) {
      logger.error('Error in parallel selection detection:', error);
      
      // If we have a recent selection cache, use it as fallback
      const now = Date.now();
      if (this.selectionCache.text && (now - this.selectionCache.timestamp) < 5000) {
        logger.debug('Using cached selection as fallback after error');
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
}

/**
 * Factory function for creating SelectionService instances
 * @param {Object} options Service options
 * @returns {SelectionService} Selection service instance
 */
module.exports = (options = {}) => {
  return new SelectionService(options);
};

module.exports.SelectionService = SelectionService; 