/**
 * MemoryScoring - Handles relevance calculations for memory items
 * 
 * This class is responsible for:
 * - Calculating initial relevance scores for new memory items
 * - Updating relevance scores for existing memory items
 * - Calculating relevance of memory items to specific commands
 */

const { MemoryScoringError } = require('./MemoryErrors');
const logger = require('../../utils/logger');

// Constants for scoring weights
const WEIGHTS = {
  RECENCY: 0.3,
  ACCESS_COUNT: 0.2,
  USEFULNESS: 0.4,
  AGE_DECAY: 0.1
};

// Constants for decay calculation
const DECAY = {
  HALF_LIFE_DAYS: 7, // Relevance halves every 7 days
  MIN_SCORE: 0.1 // Minimum score after decay
};

class MemoryScoring {
  constructor() {
    this.initialized = true; // No async initialization needed
  }
  
  /**
   * Calculate initial relevance score for a new memory item
   * 
   * @async
   * @param {Object} item - The memory item
   * @returns {Promise<number>} The calculated relevance score (0-1)
   * @throws {MemoryScoringError} If calculation fails
   */
  async calculateInitialScore(item) {
    try {
      if (!item) {
        throw new MemoryScoringError('Invalid memory item');
      }
      
      // For new items, we primarily use the usefulness if provided
      const usefulness = item.usefulness || 0;
      
      // Convert usefulness (0-10) to a score (0-1)
      const usefulnessScore = usefulness / 10;
      
      // New items get a recency boost
      const recencyScore = 1.0;
      
      // Combine scores with weights
      const score = (
        WEIGHTS.USEFULNESS * usefulnessScore +
        WEIGHTS.RECENCY * recencyScore
      ) / (WEIGHTS.USEFULNESS + WEIGHTS.RECENCY);
      
      // Ensure score is between 0 and 1
      return Math.max(0, Math.min(1, score));
    } catch (error) {
      const wrappedError = new MemoryScoringError('Failed to calculate initial score', { 
        cause: error,
        item
      });
      logger.error('[MemoryScoring] Error calculating initial score:', wrappedError);
      return 0.5; // Default to medium relevance on error
    }
  }
  
  /**
   * Calculate relevance score for an existing memory item
   * 
   * @async
   * @param {Object} item - The memory item
   * @returns {Promise<number>} The calculated relevance score (0-1)
   * @throws {MemoryScoringError} If calculation fails
   */
  async calculateScore(item) {
    try {
      if (!item) {
        throw new MemoryScoringError('Invalid memory item');
      }
      
      const now = Date.now();
      
      // Calculate recency score (how recently the item was accessed)
      const lastAccessed = item.lastAccessed || item.createdAt || now;
      const daysSinceLastAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, Math.min(1, 1 / (1 + daysSinceLastAccess / 7))); // Decay over time
      
      // Calculate access count score
      const accessCount = item.accessCount || 0;
      const accessCountScore = Math.min(1, accessCount / 10); // Max out at 10 accesses
      
      // Calculate usefulness score
      const usefulness = item.usefulness || 0;
      const usefulnessScore = usefulness / 10; // Convert 0-10 to 0-1
      
      // Calculate age decay
      const createdAt = item.createdAt || now;
      const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);
      const ageDecayFactor = Math.pow(0.5, ageInDays / DECAY.HALF_LIFE_DAYS);
      const ageDecayScore = DECAY.MIN_SCORE + (1 - DECAY.MIN_SCORE) * ageDecayFactor;
      
      // Combine scores with weights
      const score = (
        WEIGHTS.RECENCY * recencyScore +
        WEIGHTS.ACCESS_COUNT * accessCountScore +
        WEIGHTS.USEFULNESS * usefulnessScore +
        WEIGHTS.AGE_DECAY * ageDecayScore
      );
      
      // Ensure score is between 0 and 1
      return Math.max(0, Math.min(1, score));
    } catch (error) {
      const wrappedError = new MemoryScoringError('Failed to calculate score', { 
        cause: error,
        item
      });
      logger.error('[MemoryScoring] Error calculating score:', wrappedError);
      
      // Return existing score or default to medium relevance
      return item.relevanceScore || 0.5;
    }
  }
  
  /**
   * Calculate relevance of a memory item to a specific command
   * 
   * @async
   * @param {Object} item - The memory item
   * @param {string} command - The command to check relevance against
   * @returns {Promise<number>} The calculated relevance score (0-1)
   * @throws {MemoryScoringError} If calculation fails
   */
  async calculateRelevanceToCommand(item, command) {
    try {
      if (!item || !command) {
        throw new MemoryScoringError('Invalid item or command');
      }
      
      // Start with the item's base relevance score
      const baseScore = item.relevanceScore || 0.5;
      
      // Simple text matching for now - in a real implementation, this would use
      // more sophisticated semantic matching or embeddings
      let textMatchScore = 0;
      
      // Convert both to lowercase for case-insensitive matching
      const commandLower = command.toLowerCase();
      const contentLower = (item.content || '').toLowerCase();
      
      // Check if command contains any words from the item content
      const commandWords = commandLower.split(/\s+/);
      const contentWords = contentLower.split(/\s+/);
      
      // Count matching words
      let matchingWords = 0;
      for (const word of commandWords) {
        if (word.length > 3 && contentLower.includes(word)) { // Only consider words longer than 3 chars
          matchingWords++;
        }
      }
      
      // Calculate text match score based on proportion of matching words
      textMatchScore = Math.min(1, matchingWords / Math.min(5, commandWords.length));
      
      // Combine base score and text match score
      // Weight text matching more heavily for command relevance
      const commandRelevance = 0.3 * baseScore + 0.7 * textMatchScore;
      
      return Math.max(0, Math.min(1, commandRelevance));
    } catch (error) {
      const wrappedError = new MemoryScoringError('Failed to calculate relevance to command', { 
        cause: error,
        item,
        command
      });
      logger.error('[MemoryScoring] Error calculating relevance to command:', wrappedError);
      
      // Return a low default score on error
      return 0.2;
    }
  }
}

module.exports = MemoryScoring; 