/**
 * Tests for APICache
 */
const { expect } = require('chai');
const sinon = require('sinon');
const APICache = require('../../../main/services/utils/APICache');

describe('APICache', () => {
  let cache;
  
  beforeEach(() => {
    // Create a new cache instance with default options
    cache = new APICache();
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(cache.ttl).to.equal(5 * 60 * 1000); // 5 minutes
      expect(cache.maxSize).to.equal(100);
      expect(cache.cache).to.be.instanceOf(Map);
      expect(cache.cache.size).to.equal(0);
    });
    
    it('should initialize with custom options', () => {
      const customCache = new APICache({
        ttl: 10000,
        maxSize: 50
      });
      
      expect(customCache.ttl).to.equal(10000);
      expect(customCache.maxSize).to.equal(50);
    });
  });
  
  describe('_generateKey', () => {
    it('should generate a key from service and params', () => {
      const key = cache._generateKey('test-service', { param1: 'value1', param2: 'value2' });
      expect(key).to.equal('test-service:param1:"value1"|param2:"value2"');
    });
    
    it('should generate a stable key regardless of param order', () => {
      const key1 = cache._generateKey('test-service', { param1: 'value1', param2: 'value2' });
      const key2 = cache._generateKey('test-service', { param2: 'value2', param1: 'value1' });
      expect(key1).to.equal(key2);
    });
    
    it('should use cacheKey if provided', () => {
      const key = cache._generateKey('test-service', { cacheKey: 'custom-key', param1: 'value1' });
      expect(key).to.equal('test-service:custom-key');
    });
  });
  
  describe('get and set', () => {
    it('should return undefined for non-existent keys', () => {
      const value = cache.get('test-service', { param: 'value' });
      expect(value).to.be.undefined;
      expect(cache.stats.misses).to.equal(1);
    });
    
    it('should store and retrieve values', () => {
      const testValue = { data: 'test-data' };
      cache.set('test-service', { param: 'value' }, testValue);
      
      const retrievedValue = cache.get('test-service', { param: 'value' });
      expect(retrievedValue).to.deep.equal(testValue);
      expect(cache.stats.sets).to.equal(1);
      expect(cache.stats.hits).to.equal(1);
    });
    
    it('should expire entries after TTL', () => {
      // Create cache with short TTL
      const shortCache = new APICache({ ttl: 50 });
      
      // Set a value
      shortCache.set('test-service', { param: 'value' }, 'test-value');
      
      // Value should be available immediately
      expect(shortCache.get('test-service', { param: 'value' })).to.equal('test-value');
      
      // Wait for TTL to expire
      const clock = sinon.useFakeTimers();
      clock.tick(100); // Advance time past TTL
      
      // Value should now be expired
      expect(shortCache.get('test-service', { param: 'value' })).to.be.undefined;
      expect(shortCache.stats.misses).to.equal(1);
      
      clock.restore();
    });
    
    it('should respect custom TTL for specific entries', () => {
      // Set a value with custom TTL
      cache.set('test-service', { param: 'value' }, 'test-value', 50);
      
      // Value should be available immediately
      expect(cache.get('test-service', { param: 'value' })).to.equal('test-value');
      
      // Wait for custom TTL to expire
      const clock = sinon.useFakeTimers();
      clock.tick(100); // Advance time past TTL
      
      // Value should now be expired
      expect(cache.get('test-service', { param: 'value' })).to.be.undefined;
      
      clock.restore();
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
      expect(smallCache.get('service', { id: 1 })).to.equal('value1');
      expect(smallCache.get('service', { id: 2 })).to.equal('value2');
      expect(smallCache.get('service', { id: 3 })).to.equal('value3');
      
      // Add one more entry, which should evict the oldest
      smallCache.set('service', { id: 4 }, 'value4');
      
      // The oldest entry should be evicted
      expect(smallCache.get('service', { id: 1 })).to.be.undefined;
      expect(smallCache.get('service', { id: 2 })).to.equal('value2');
      expect(smallCache.get('service', { id: 3 })).to.equal('value3');
      expect(smallCache.get('service', { id: 4 })).to.equal('value4');
      expect(smallCache.stats.evictions).to.equal(1);
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
      expect(result).to.be.true;
      expect(cache.get('service', { id: 1 })).to.be.undefined;
      expect(cache.get('service', { id: 2 })).to.equal('value2');
    });
    
    it('should return false when entry does not exist', () => {
      const result = cache.invalidate('service', { id: 'nonexistent' });
      expect(result).to.be.false;
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
      expect(cache.get('service1', { id: 1 })).to.be.undefined;
      expect(cache.get('service2', { id: 2 })).to.be.undefined;
      expect(cache.cache.size).to.equal(0);
    });
    
    it('should reset stats', () => {
      // Generate some stats
      cache.get('nonexistent', {});
      cache.set('service', { id: 1 }, 'value');
      cache.get('service', { id: 1 });
      
      // Clear the cache
      cache.clear();
      
      // Check that stats are reset
      expect(cache.stats.hits).to.equal(0);
      expect(cache.stats.misses).to.equal(0);
      expect(cache.stats.sets).to.equal(0);
      expect(cache.stats.evictions).to.equal(0);
      expect(cache.stats.lifetime).to.exist; // Lifetime stats should be preserved
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
      expect(stats.size).to.equal(1);
      expect(stats.maxSize).to.equal(100);
      expect(stats.hits).to.equal(1);
      expect(stats.misses).to.equal(1);
      expect(stats.sets).to.equal(1);
      expect(stats.hitRate).to.equal(0.5);
    });
  });
}); 