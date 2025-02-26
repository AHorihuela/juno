/**
 * Tests for the MemoryScoring module
 */

// Mock logger
jest.mock('../../../../main/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const MemoryScoring = require('../../../../main/services/memory/MemoryScoring');
const { MemoryScoringError } = require('../../../../main/services/memory/MemoryErrors');

describe('MemoryScoring', () => {
  let memoryScoring;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a new instance for each test
    memoryScoring = new MemoryScoring();
  });
  
  describe('calculateInitialScore', () => {
    it('should calculate initial score based on usefulness', async () => {
      const item = {
        content: 'Test content',
        usefulness: 8 // High usefulness (0-10)
      };
      
      const score = await memoryScoring.calculateInitialScore(item);
      
      // Score should be between 0 and 1
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
      
      // With high usefulness, score should be high
      expect(score).toBeGreaterThan(0.7);
    });
    
    it('should handle items with no usefulness', async () => {
      const item = {
        content: 'Test content'
        // No usefulness specified
      };
      
      const score = await memoryScoring.calculateInitialScore(item);
      
      // Score should be between 0 and 1
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
    
    it('should throw error for invalid items', async () => {
      // Test with null item
      await expect(memoryScoring.calculateInitialScore(null))
        .resolves.toBe(0.5); // Default score on error
      
      // Test with undefined item
      await expect(memoryScoring.calculateInitialScore(undefined))
        .resolves.toBe(0.5); // Default score on error
    });
  });
  
  describe('calculateScore', () => {
    it('should calculate score based on recency, access count, and usefulness', async () => {
      const now = Date.now();
      const item = {
        content: 'Test content',
        createdAt: now - (5 * 24 * 60 * 60 * 1000), // 5 days ago
        lastAccessed: now - (1 * 24 * 60 * 60 * 1000), // 1 day ago
        accessCount: 5,
        usefulness: 7
      };
      
      const score = await memoryScoring.calculateScore(item);
      
      // Score should be between 0 and 1
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
      
      // With good recency, access count, and usefulness, score should be high
      expect(score).toBeGreaterThan(0.6);
    });
    
    it('should handle items with minimal metadata', async () => {
      const item = {
        content: 'Test content'
        // No metadata
      };
      
      const score = await memoryScoring.calculateScore(item);
      
      // Score should be between 0 and 1
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
    
    it('should apply age decay to older items', async () => {
      const now = Date.now();
      
      // Recent item
      const recentItem = {
        content: 'Recent content',
        createdAt: now - (1 * 24 * 60 * 60 * 1000), // 1 day ago
        lastAccessed: now - (1 * 60 * 60 * 1000), // 1 hour ago
        accessCount: 5,
        usefulness: 7
      };
      
      // Old item with same properties except age
      const oldItem = {
        content: 'Old content',
        createdAt: now - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        lastAccessed: now - (1 * 60 * 60 * 1000), // 1 hour ago
        accessCount: 5,
        usefulness: 7
      };
      
      const recentScore = await memoryScoring.calculateScore(recentItem);
      const oldScore = await memoryScoring.calculateScore(oldItem);
      
      // Recent item should have higher score due to less age decay
      expect(recentScore).toBeGreaterThan(oldScore);
    });
    
    it('should return existing score on error', async () => {
      const item = {
        content: 'Test content',
        relevanceScore: 0.75
      };
      
      // Force an error by making calculateScore throw
      jest.spyOn(memoryScoring, 'calculateScore').mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      const score = await memoryScoring.calculateScore(item);
      
      // Should return the existing score
      expect(score).toBe(0.75);
    });
  });
  
  describe('calculateRelevanceToCommand', () => {
    it('should calculate relevance based on text matching', async () => {
      const item = {
        content: 'This is a test about memory management and context retrieval',
        relevanceScore: 0.8
      };
      
      // Command with matching words
      const matchingCommand = 'Tell me about memory management';
      const matchingScore = await memoryScoring.calculateRelevanceToCommand(item, matchingCommand);
      
      // Command with no matching words
      const nonMatchingCommand = 'What is the weather today?';
      const nonMatchingScore = await memoryScoring.calculateRelevanceToCommand(item, nonMatchingCommand);
      
      // Matching command should have higher relevance
      expect(matchingScore).toBeGreaterThan(nonMatchingScore);
      expect(matchingScore).toBeGreaterThan(0.5);
    });
    
    it('should handle case insensitivity', async () => {
      const item = {
        content: 'This is a TEST about MEMORY management',
        relevanceScore: 0.8
      };
      
      // Command with different case
      const command = 'tell me about memory';
      const score = await memoryScoring.calculateRelevanceToCommand(item, command);
      
      // Should still match despite case differences
      expect(score).toBeGreaterThan(0.5);
    });
    
    it('should return low score for invalid inputs', async () => {
      // Test with null item
      await expect(memoryScoring.calculateRelevanceToCommand(null, 'test command'))
        .resolves.toBe(0.2); // Default low score on error
      
      // Test with null command
      await expect(memoryScoring.calculateRelevanceToCommand({ content: 'test' }, null))
        .resolves.toBe(0.2); // Default low score on error
    });
  });
}); 