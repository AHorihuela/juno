/**
 * Tests for APICache
 */
const assert = require('assert');
const APICache = require('../../utils/APICache');

describe('APICache', () => {
  let cache;
  
  beforeEach(() => {
    // Create a new cache instance with default options
    cache = new APICache();
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      assert.strictEqual(cache.ttl, 5 * 60 * 1000); // 5 minutes
      assert.strictEqual(cache.maxSize, 100);
      assert(cache.cache instanceof Map);
      assert.strictEqual(cache.cache.size, 0);
    });
    
    it('should initialize with custom options', () => {
      const customCache = new APICache({
        ttl: 10000,
        maxSize: 50
      });
      
      assert.strictEqual(customCache.ttl, 10000);
      assert.strictEqual(customCache.maxSize, 50);
    });
  });
  
  describe('_generateKey', () => {
    it('should generate a key from service and params', () => {
      const key = cache._generateKey('test-service', { param1: 'value1', param2: 'value2' });
      assert.strictEqual(key, 'test-service:param1:"value1"|param2:"value2"');
    });
    
    it('should generate a stable key regardless of param order', () => {
      const key1 = cache._generateKey('test-service', { param1: 'value1', param2: 'value2' });
      const key2 = cache._generateKey('test-service', { param2: 'value2', param1: 'value1' });
      assert.strictEqual(key1, key2);
    });
    
    it('should use cacheKey if provided', () => {
      const key = cache._generateKey('test-service', { cacheKey: 'custom-key', param1: 'value1' });
      assert.strictEqual(key, 'test-service:custom-key');
    });
  });
  
  describe('get and set', () => {
    it('should return undefined for non-existent keys', () => {
      const value = cache.get('test-service', { param: 'value' });
      assert.strictEqual(value, undefined);
      assert.strictEqual(cache.stats.misses, 1);
    });
    
    it('should store and retrieve values', () => {
      const testValue = { data: 'test-data' };
      cache.set('test-service', { param: 'value' }, testValue);
      
      const retrievedValue = cache.get('test-service', { param: 'value' });
      assert.deepStrictEqual(retrievedValue, testValue);
      assert.strictEqual(cache.stats.sets, 1);
      assert.strictEqual(cache.stats.hits, 1);
    });
    
    it('should expire entries after TTL', () => {
      // Create cache with short TTL
      const shortCache = new APICache({ ttl: 50 });
      
      // Set a value
      shortCache.set('test-service', { param: 'value' }, 'test-value');
      
      // Value should be available immediately
      assert.strictEqual(shortCache.get('test-service', { param: 'value' }), 'test-value');
      
      // Wait for TTL to expire - using setTimeout instead of sinon.useFakeTimers
      return new Promise(resolve => {
        setTimeout(() => {
          // Value should now be expired
          assert.strictEqual(shortCache.get('test-service', { param: 'value' }), undefined);
          assert.strictEqual(shortCache.stats.misses, 1);
          resolve();
        }, 100);
      });
    });
    
    it('should respect custom TTL for specific entries', () => {
      // Set a value with custom TTL
      cache.set('test-service', { param: 'value' }, 'test-value', 50);
      
      // Value should be available immediately
      assert.strictEqual(cache.get('test-service', { param: 'value' }), 'test-value');
      
      // Wait for custom TTL to expire
      return new Promise(resolve => {
        setTimeout(() => {
          // Value should now be expired
          assert.strictEqual(cache.get('test-service', { param: 'value' }), undefined);
          resolve();
        }, 100);
      });
    });
  });
  
  describe('eviction', () => {
    it('should evict oldest entries when cache is full', () => {
      // Create a cache with small size
      const smallCache = new APICache({ maxSize: 3 });
      
      // Fill the cache
      smallCache.set('service', { id: 1 }, 'value1');
      smallCache.set('service', { id: 2 }, 'value2');
      smallCache.set('service', { id: 3 }, 'value3');
      
      // All values should be available
      assert.strictEqual(smallCache.get('service', { id: 1 }), 'value1');
      assert.strictEqual(smallCache.get('service', { id: 2 }), 'value2');
      assert.strictEqual(smallCache.get('service', { id: 3 }), 'value3');
      
      // Add one more entry, which should evict the oldest
      smallCache.set('service', { id: 4 }, 'value4');
      
      // The oldest entry should be evicted
      assert.strictEqual(smallCache.get('service', { id: 1 }), undefined);
      assert.strictEqual(smallCache.get('service', { id: 2 }), 'value2');
      assert.strictEqual(smallCache.get('service', { id: 3 }), 'value3');
      assert.strictEqual(smallCache.get('service', { id: 4 }), 'value4');
      assert.strictEqual(smallCache.stats.evictions, 1);
    });
  });
  
  describe('invalidate', () => {
    it('should remove a specific entry', () => {
      // Set some values
      cache.set('service', { id: 1 }, 'value1');
      cache.set('service', { id: 2 }, 'value2');
      
      // Invalidate one entry
      const result = cache.invalidate('service', { id: 1 });
      
      // Check result and remaining entries
      assert.strictEqual(result, true);
      assert.strictEqual(cache.get('service', { id: 1 }), undefined);
      assert.strictEqual(cache.get('service', { id: 2 }), 'value2');
    });
    
    it('should return false when entry does not exist', () => {
      const result = cache.invalidate('service', { id: 'nonexistent' });
      assert.strictEqual(result, false);
    });
  });
  
  describe('clear', () => {
    it('should remove all entries', () => {
      // Set some values
      cache.set('service1', { id: 1 }, 'value1');
      cache.set('service2', { id: 2 }, 'value2');
      
      // Clear the cache
      cache.clear();
      
      // Check that all entries are removed
      assert.strictEqual(cache.get('service1', { id: 1 }), undefined);
      assert.strictEqual(cache.get('service2', { id: 2 }), undefined);
      assert.strictEqual(cache.cache.size, 0);
    });
    
    it('should reset stats', () => {
      // Generate some stats
      cache.get('nonexistent', {});
      cache.set('service', { id: 1 }, 'value');
      cache.get('service', { id: 1 });
      
      // Clear the cache
      cache.clear();
      
      // Check that stats are reset
      assert.strictEqual(cache.stats.hits, 0);
      assert.strictEqual(cache.stats.misses, 0);
      assert.strictEqual(cache.stats.sets, 0);
      assert.strictEqual(cache.stats.evictions, 0);
      assert(cache.stats.lifetime); // Lifetime stats should be preserved
    });
  });
  
  describe('getStats', () => {
    it('should return cache statistics', () => {
      // Generate some stats
      cache.get('nonexistent', {});
      cache.set('service', { id: 1 }, 'value');
      cache.get('service', { id: 1 });
      
      // Get stats
      const stats = cache.getStats();
      
      // Check stats
      assert.strictEqual(stats.size, 1);
      assert.strictEqual(stats.maxSize, 100);
      assert.strictEqual(stats.hits, 1);
      assert.strictEqual(stats.misses, 1);
      assert.strictEqual(stats.sets, 1);
      assert.strictEqual(stats.hitRate, 0.5);
    });
  });
}); 