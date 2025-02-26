/**
 * APICache - A simple caching mechanism for API responses
 * 
 * This module provides a lightweight caching solution for API responses
 * to reduce redundant API calls and improve application performance.
 */

class APICache {
  /**
   * Create a new APICache instance
   * @param {Object} options - Cache configuration options
   * @param {number} options.ttl - Time to live in milliseconds (default: 5 minutes)
   * @param {number} options.maxSize - Maximum number of items in cache (default: 100)
   */
  constructor(options = {}) {
    this.ttl = options.ttl || 5 * 60 * 1000; // Default: 5 minutes
    this.maxSize = options.maxSize || 100;
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  /**
   * Generate a cache key from service name and parameters
   * @param {string} service - Service name
   * @param {Object} params - Request parameters
   * @returns {string} Cache key
   * @private
   */
  _generateKey(service, params) {
    if (params.cacheKey) {
      return `${service}:${params.cacheKey}`;
    }
    
    // Create a stable key from parameters
    const sortedParams = Object.keys(params)
      .filter(key => key !== 'cacheKey') // Exclude the cacheKey itself
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
      
    return `${service}:${sortedParams}`;
  }

  /**
   * Get a value from the cache
   * @param {string} service - Service name
   * @param {Object} params - Request parameters
   * @returns {*} Cached value or undefined if not found
   */
  get(service, params = {}) {
    const key = this._generateKey(service, params);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Store a value in the cache
   * @param {string} service - Service name
   * @param {Object} params - Request parameters
   * @param {*} value - Value to cache
   * @param {number} [customTtl] - Optional custom TTL for this entry
   */
  set(service, params = {}, value, customTtl) {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
    
    const key = this._generateKey(service, params);
    const ttl = customTtl || this.ttl;
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl,
      created: Date.now()
    });
    
    this.stats.sets++;
  }

  /**
   * Remove a specific entry from the cache
   * @param {string} service - Service name
   * @param {Object} params - Request parameters
   * @returns {boolean} True if entry was found and removed
   */
  invalidate(service, params = {}) {
    const key = this._generateKey(service, params);
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    this.cache.clear();
    // Reset stats except for lifetime totals
    const lifetimeTotals = { ...this.stats };
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      lifetime: lifetimeTotals
    };
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses || 1)
    };
  }
}

module.exports = APICache; 