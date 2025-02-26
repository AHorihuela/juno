const AppleScriptExecutor = require('./AppleScriptExecutor');

/**
 * Provider for getting and caching active application names
 */
class AppNameProvider {
  constructor(cacheTTL = 5000) {
    this.cache = { name: '', timestamp: 0 };
    this.cacheTTL = cacheTTL; // 5 seconds by default
  }

  /**
   * Get the name of the active application with caching
   * @returns {Promise<string>} Name of the active application
   */
  async getActiveAppName() {
    const now = Date.now();
    
    // Return cached app name if it's still valid
    if (this.cache.name && (now - this.cache.timestamp) < this.cacheTTL) {
      console.log('[AppNameProvider] Using cached app name:', this.cache.name);
      return this.cache.name;
    }
    
    // Get fresh app name
    try {
      const appName = await this._getActiveAppNameFromSystem();
      
      // Update cache
      this.cache = {
        name: appName,
        timestamp: now
      };
      
      console.log('[AppNameProvider] Got active app name:', appName);
      return appName;
    } catch (error) {
      console.error('[AppNameProvider] Error getting app name:', error);
      return '';
    }
  }

  /**
   * Get the name of the active application from the system
   * @returns {Promise<string>} Name of the active application
   * @private
   */
  async _getActiveAppNameFromSystem() {
    const appNameScript = `
      tell application "System Events"
        set frontApp to first application process whose frontmost is true
        return name of frontApp
      end tell
    `;
    
    return AppleScriptExecutor.execute(appNameScript, 500, 'AppNameProvider');
  }
  
  /**
   * Preload app name for better performance in subsequent calls
   * This can be called during app initialization or when user activity is detected
   */
  async preloadAppName() {
    try {
      const appName = await this._getActiveAppNameFromSystem();
      this.cache = {
        name: appName,
        timestamp: Date.now()
      };
      console.log('[AppNameProvider] Preloaded app name:', appName);
      return appName;
    } catch (error) {
      console.error('[AppNameProvider] Error preloading app name:', error);
      return '';
    }
  }
  
  /**
   * Invalidate the app name cache
   * This can be called when the user switches applications
   */
  invalidateCache() {
    this.cache = { name: '', timestamp: 0 };
    console.log('[AppNameProvider] Cache invalidated');
  }
}

module.exports = AppNameProvider; 