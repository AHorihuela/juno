/**
 * AIStatsTracker - Tracks statistics for AI usage
 * 
 * This class handles tracking and calculating statistics for AI usage,
 * including request counts, success rates, and response times.
 */

class AIStatsTracker {
  constructor() {
    // Initialize statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastResponseTime: 0,
      lastRequestTimestamp: 0
    };
    
    // Track the current request start time
    this.currentRequestStartTime = 0;
  }

  /**
   * Start timing a new request
   */
  startRequest() {
    this.currentRequestStartTime = Date.now();
    this.stats.lastRequestTimestamp = this.currentRequestStartTime;
    this.stats.totalRequests++;
    
    console.log('[AIStatsTracker] Started timing new request');
  }

  /**
   * Record a successful request and update statistics
   */
  recordSuccessfulRequest() {
    const endTime = Date.now();
    this.stats.lastResponseTime = endTime - this.currentRequestStartTime;
    this.stats.successfulRequests++;
    
    // Update the running average
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (this.stats.successfulRequests - 1) + this.stats.lastResponseTime) / 
      this.stats.successfulRequests;
    
    console.log('[AIStatsTracker] Recorded successful request:', {
      responseTime: this.stats.lastResponseTime,
      averageResponseTime: this.stats.averageResponseTime
    });
  }

  /**
   * Record a failed request
   */
  recordFailedRequest() {
    this.stats.failedRequests++;
    console.log('[AIStatsTracker] Recorded failed request');
  }

  /**
   * Get the current statistics
   * @returns {Object} Current statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get the last response time
   * @returns {number} Last response time in milliseconds
   */
  getLastResponseTime() {
    return this.stats.lastResponseTime;
  }

  /**
   * Get the average response time
   * @returns {number} Average response time in milliseconds
   */
  getAverageResponseTime() {
    return this.stats.averageResponseTime;
  }

  /**
   * Format response time in a human-readable way
   * @param {number} time - Time in milliseconds
   * @returns {string} Formatted time
   */
  formatResponseTime(time) {
    if (!time) return 'N/A';
    
    if (time < 1000) {
      return `${time}ms`;
    } else {
      return `${(time / 1000).toFixed(1)}s`;
    }
  }
  
  /**
   * Get success rate as a percentage
   * @returns {number} Success rate percentage
   */
  getSuccessRate() {
    if (this.stats.totalRequests === 0) return 0;
    return (this.stats.successfulRequests / this.stats.totalRequests) * 100;
  }
  
  /**
   * Reset all statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastResponseTime: 0,
      lastRequestTimestamp: 0
    };
    console.log('[AIStatsTracker] Reset all statistics');
  }
}

module.exports = AIStatsTracker; 