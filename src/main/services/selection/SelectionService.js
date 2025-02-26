const { ipcMain } = require('electron');
const BaseService = require('../BaseService');
const AppNameProvider = require('./AppNameProvider');
const ElectronSelectionStrategy = require('./ElectronSelectionStrategy');
const AccessibilitySelectionStrategy = require('./AccessibilitySelectionStrategy');
const ClipboardSelectionStrategy = require('./ClipboardSelectionStrategy');

/**
 * Service for getting selected text from the active application
 */
class SelectionService extends BaseService {
  constructor() {
    super('Selection');
    
    // Selection cache for performance optimization
    this.selectionCache = { text: '', timestamp: 0 };
    this.selectionCacheTTL = 1000; // 1 second
    
    // Debouncing for performance optimization
    this.pendingSelectionRequest = null;
    this.debounceTime = 300; // 300ms
    this.lastSelectionTime = 0;
    
    // IPC handler for renderer process
    this.ipcHandler = null;
  }

  async _initialize() {
    // Create app name provider
    this.appNameProvider = new AppNameProvider();
    
    // Create selection strategies
    this.strategies = [
      new ElectronSelectionStrategy(),
      new AccessibilitySelectionStrategy(),
      new ClipboardSelectionStrategy(this.getService('context'))
    ];
    
    // Set up IPC handler for getting selected text from renderer
    this.ipcHandler = async () => {
      return await this.getSelectedText();
    };

    ipcMain.handle('get-selected-text-from-renderer', this.ipcHandler);
    
    // Preload app name for better performance
    await this.appNameProvider.preloadAppName();
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
    
    // Clear references to strategies
    this.strategies = null;
    this.appNameProvider = null;
  }

  /**
   * Get selected text from the active application with debouncing
   * @returns {Promise<string>} Selected text or empty string if none
   */
  async getSelectedText() {
    // Implement debouncing to prevent rapid consecutive calls
    const now = Date.now();
    if (now - this.lastSelectionTime < this.debounceTime) {
      console.log('[SelectionService] Debouncing selection request');
      
      // Return cached selection if available and recent
      if (this.selectionCache.text && (now - this.selectionCache.timestamp < this.selectionCacheTTL)) {
        console.log('[SelectionService] Returning cached selection due to debounce');
        return this.selectionCache.text;
      }
      
      // Set up a debounced request
      return new Promise((resolve) => {
        if (this.pendingSelectionRequest) {
          clearTimeout(this.pendingSelectionRequest);
        }
        
        this.pendingSelectionRequest = setTimeout(async () => {
          const text = await this._getSelectedTextImpl();
          this.pendingSelectionRequest = null;
          resolve(text);
        }, this.debounceTime);
      });
    }
    
    // Update last selection time
    this.lastSelectionTime = now;
    
    // Proceed with normal selection
    return this._getSelectedTextImpl();
  }
  
  /**
   * Implementation of selection detection
   * @returns {Promise<string>} Selected text or empty string if none
   * @private
   */
  async _getSelectedTextImpl() {
    if (process.platform !== 'darwin') {
      console.log('[SelectionService] Platform not supported for getting selected text');
      return '';
    }

    try {
      console.log('[SelectionService] Starting selection detection');
      
      // First get the active app name
      const appName = await this.appNameProvider.getActiveAppName();
      console.log('[SelectionService] Active application:', appName);

      if (!appName) {
        console.log('[SelectionService] Could not determine active application');
        return '';
      }
      
      // Find applicable strategies for this app
      const applicableStrategies = this.strategies.filter(strategy => 
        strategy.isApplicable(appName)
      );
      
      console.log('[SelectionService] Using strategies:', 
        applicableStrategies.map(s => s.name).join(', ')
      );
      
      // Try each strategy in sequence
      let selectedText = '';
      for (const strategy of applicableStrategies) {
        const result = await strategy.getSelection(appName);
        if (result.success && result.text) {
          selectedText = result.text;
          console.log(`[SelectionService] Got selection using ${strategy.name} strategy`);
          break;
        }
      }
      
      // Cache the selection for potential recovery
      if (selectedText) {
        this.selectionCache = {
          text: selectedText,
          timestamp: Date.now()
        };
      }
      
      console.log('[SelectionService] Selection detection completed:', {
        hasSelection: Boolean(selectedText),
        selectionLength: selectedText?.length || 0
      });

      return selectedText || '';
    } catch (error) {
      console.error('[SelectionService] Failed to get selected text:', error);
      
      // If we have a recent selection cache, use it as fallback
      const now = Date.now();
      if (this.selectionCache.text && (now - this.selectionCache.timestamp) < 5000) {
        console.log('[SelectionService] Using cached selection as fallback');
        return this.selectionCache.text;
      }
      
      this.emitError(error);
      return '';
    }
  }
  
  /**
   * Get the active app name (for compatibility with old API)
   * @returns {Promise<string>} Name of the active application
   */
  async getCachedActiveAppName() {
    if (!this.appNameProvider) {
      console.warn('[SelectionService] AppNameProvider not initialized yet');
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
      console.warn('[SelectionService] AppNameProvider not initialized yet');
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
      console.warn('[SelectionService] Electron strategy not found');
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
      console.warn('[SelectionService] Accessibility strategy not found');
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
      console.warn('[SelectionService] Clipboard strategy not found');
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
    try {
      const appName = await this.appNameProvider.getCachedActiveAppName();
      console.log(`[SelectionService] Getting selection in parallel for app: ${appName}`);
      
      // Filter applicable strategies
      const applicableStrategies = this.strategies.filter(strategy => 
        strategy.isApplicable(appName)
      );
      
      if (applicableStrategies.length === 0) {
        console.error(`[SelectionService] No applicable selection strategy found for app: ${appName}`);
        return '';
      }
      
      console.log(`[SelectionService] Trying ${applicableStrategies.length} strategies in parallel`);
      
      // Create a promise for each strategy
      const selectionPromises = applicableStrategies.map(strategy => {
        return strategy.getSelection(appName)
          .then(selection => {
            console.log(`[SelectionService] Strategy ${strategy.name} returned: ${selection ? 'non-empty result' : 'empty result'}`);
            return { strategy: strategy.name, selection };
          })
          .catch(error => {
            console.error(`[SelectionService] Strategy ${strategy.name} failed:`, error);
            return { strategy: strategy.name, selection: '', error };
          });
      });
      
      // Use Promise.race with a filter to get the first non-empty result
      const results = await Promise.all(selectionPromises);
      
      // Find the first non-empty result
      const firstNonEmptyResult = results.find(result => result.selection);
      
      if (firstNonEmptyResult) {
        console.log(`[SelectionService] Using result from strategy: ${firstNonEmptyResult.strategy}`);
        return firstNonEmptyResult.selection;
      }
      
      // If all strategies returned empty or failed
      console.error('[SelectionService] All parallel selection strategies failed or returned empty results');
      return '';
    } catch (error) {
      console.error('[SelectionService] Error in parallel selection:', error);
      return '';
    }
  }
}

// Export a factory function instead of a singleton
module.exports = () => new SelectionService(); 