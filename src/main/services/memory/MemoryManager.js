/**
 * MemoryManager - Service for tracking and managing memory usage
 * 
 * This module provides utilities for tracking memory usage, detecting potential
 * memory leaks, and cleaning up resources.
 */

const { EventEmitter } = require('events');
const BaseService = require('../BaseService');

class MemoryManager extends BaseService {
  constructor() {
    super('Memory');
    this.trackedResources = new Map();
    this.memoryUsageHistory = [];
    this.historyLimit = 100;
    this.warningThreshold = 500 * 1024 * 1024; // 500MB
    this.criticalThreshold = 800 * 1024 * 1024; // 800MB
    this.checkInterval = null;
    this.checkIntervalTime = 60000; // 1 minute
  }

  async _initialize() {
    // Start periodic memory checks
    this.checkInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkIntervalTime);
    
    // Initial check
    this.checkMemoryUsage();
  }

  async _shutdown() {
    // Clear interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Clean up all tracked resources
    this.cleanupAllResources();
  }

  /**
   * Track a resource for memory management
   * @param {string} id - Unique identifier for the resource
   * @param {Object} resource - The resource to track
   * @param {Function} cleanupFn - Function to call to clean up the resource
   * @param {Object} metadata - Additional metadata about the resource
   */
  trackResource(id, resource, cleanupFn, metadata = {}) {
    if (this.trackedResources.has(id)) {
      console.warn(`[MemoryManager] Resource with ID '${id}' is already being tracked. Overwriting.`);
      // Clean up existing resource first
      this.cleanupResource(id);
    }
    
    this.trackedResources.set(id, {
      resource,
      cleanupFn,
      metadata,
      createdAt: Date.now()
    });
    
    return this;
  }

  /**
   * Clean up a tracked resource
   * @param {string} id - ID of the resource to clean up
   * @returns {boolean} Whether the resource was cleaned up
   */
  cleanupResource(id) {
    const trackedResource = this.trackedResources.get(id);
    if (!trackedResource) {
      return false;
    }
    
    try {
      // Call cleanup function
      if (typeof trackedResource.cleanupFn === 'function') {
        trackedResource.cleanupFn(trackedResource.resource);
      }
      
      // Remove from tracked resources
      this.trackedResources.delete(id);
      return true;
    } catch (error) {
      console.error(`[MemoryManager] Error cleaning up resource '${id}':`, error);
      return false;
    }
  }

  /**
   * Clean up all tracked resources
   */
  cleanupAllResources() {
    for (const id of this.trackedResources.keys()) {
      this.cleanupResource(id);
    }
  }

  /**
   * Clean up resources older than a certain age
   * @param {number} maxAgeMs - Maximum age in milliseconds
   */
  cleanupOldResources(maxAgeMs) {
    const now = Date.now();
    for (const [id, resource] of this.trackedResources.entries()) {
      if (now - resource.createdAt > maxAgeMs) {
        this.cleanupResource(id);
      }
    }
  }

  /**
   * Check current memory usage and take action if needed
   */
  checkMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    
    // Add to history
    this.memoryUsageHistory.push({
      timestamp: Date.now(),
      ...memoryUsage
    });
    
    // Trim history if needed
    if (this.memoryUsageHistory.length > this.historyLimit) {
      this.memoryUsageHistory = this.memoryUsageHistory.slice(-this.historyLimit);
    }
    
    // Check for high memory usage
    if (memoryUsage.heapUsed > this.criticalThreshold) {
      console.error('[MemoryManager] CRITICAL: Memory usage is very high!', memoryUsage);
      this.emit('memory-critical', memoryUsage);
      
      // Take emergency action - clean up old resources
      this.cleanupOldResources(5 * 60 * 1000); // Clean up resources older than 5 minutes
      
      // Force garbage collection if available (requires --expose-gc flag)
      if (global.gc) {
        console.log('[MemoryManager] Forcing garbage collection');
        global.gc();
      }
    } else if (memoryUsage.heapUsed > this.warningThreshold) {
      console.warn('[MemoryManager] WARNING: Memory usage is high', memoryUsage);
      this.emit('memory-warning', memoryUsage);
    }
    
    return memoryUsage;
  }

  /**
   * Get memory usage history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Memory usage history
   */
  getMemoryUsageHistory(limit = this.historyLimit) {
    return this.memoryUsageHistory.slice(-limit);
  }

  /**
   * Get current memory usage
   * @returns {Object} Current memory usage
   */
  getCurrentMemoryUsage() {
    return process.memoryUsage();
  }

  /**
   * Get tracked resources
   * @returns {Map} Map of tracked resources
   */
  getTrackedResources() {
    return new Map(this.trackedResources);
  }

  /**
   * Set memory thresholds
   * @param {Object} thresholds - New thresholds
   * @param {number} thresholds.warning - Warning threshold in bytes
   * @param {number} thresholds.critical - Critical threshold in bytes
   */
  setThresholds({ warning, critical } = {}) {
    if (warning) this.warningThreshold = warning;
    if (critical) this.criticalThreshold = critical;
    return this;
  }
}

module.exports = () => new MemoryManager(); 