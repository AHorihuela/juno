/**
 * Tests for the AIUsageTracker module
 */

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue('{}'),
    mkdir: jest.fn().mockResolvedValue(),
    access: jest.fn().mockResolvedValue(),
    stat: jest.fn().mockResolvedValue({ isFile: () => true })
  }
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

// Mock logger
jest.mock('../../../../main/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const AIUsageTracker = require('../../../../main/services/memory/AIUsageTracker');
const { MemoryStatsError } = require('../../../../main/services/memory/MemoryErrors');
const fs = require('fs').promises;
const path = require('path');

describe('AIUsageTracker', () => {
  let aiUsageTracker;
  let mockConfigService;
  let mockDate;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock Date.now
    mockDate = new Date('2025-01-01T12:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    
    // Create mock config service
    mockConfigService = {
      getAppDataPath: jest.fn().mockReturnValue('/mock/app/data')
    };
    
    // Create a new instance for each test
    aiUsageTracker = new AIUsageTracker();
  });
  
  afterEach(() => {
    // Restore Date
    jest.restoreAllMocks();
  });
  
  describe('initialization', () => {
    it('should initialize successfully with valid services', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      expect(aiUsageTracker.initialized).toBe(true);
      expect(aiUsageTracker.configService).toBe(mockConfigService);
      expect(aiUsageTracker.statsFilePath).toBe('/mock/app/data/ai-usage/usage-stats.json');
      expect(fs.mkdir).toHaveBeenCalledWith('/mock/app/data/ai-usage', { recursive: true });
    });
    
    it('should throw error if config service is missing', async () => {
      const services = {};
      
      await expect(aiUsageTracker.initialize(services))
        .rejects.toThrow(MemoryStatsError);
      
      expect(aiUsageTracker.initialized).toBe(false);
    });
    
    it('should load existing stats during initialization', async () => {
      const services = {
        config: mockConfigService
      };
      
      const mockStats = {
        totalTokens: 1000,
        sessionTokens: 0,
        dailyUsage: {
          '2025-01-01': 500
        },
        modelUsage: {
          'gpt-4': 800,
          'gpt-3.5-turbo': 200
        },
        lastUpdated: '2025-01-01T10:00:00Z'
      };
      
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockStats));
      
      await aiUsageTracker.initialize(services);
      
      expect(aiUsageTracker.stats).toEqual({
        ...mockStats,
        sessionTokens: 0, // Session tokens should be reset
        lastUpdated: mockDate.toISOString()
      });
    });
    
    it('should handle file not found during initialization', async () => {
      const services = {
        config: mockConfigService
      };
      
      fs.access.mockRejectedValueOnce(new Error('File not found'));
      
      await aiUsageTracker.initialize(services);
      
      expect(aiUsageTracker.stats).toEqual({
        totalTokens: 0,
        sessionTokens: 0,
        dailyUsage: {},
        modelUsage: {},
        lastUpdated: mockDate.toISOString()
      });
    });
  });
  
  describe('trackUsage', () => {
    it('should track token usage correctly', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      const usageData = {
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4'
      };
      
      await aiUsageTracker.trackUsage(usageData);
      
      // Total tokens should be updated
      expect(aiUsageTracker.stats.totalTokens).toBe(150);
      expect(aiUsageTracker.stats.sessionTokens).toBe(150);
      
      // Daily usage should be updated
      expect(aiUsageTracker.stats.dailyUsage['2025-01-01']).toBe(150);
      
      // Model usage should be updated
      expect(aiUsageTracker.stats.modelUsage['gpt-4']).toBe(150);
      
      // Stats should be saved
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/mock/app/data/ai-usage/usage-stats.json',
        expect.any(String),
        'utf8'
      );
    });
    
    it('should accumulate usage across multiple calls', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      // First usage
      await aiUsageTracker.trackUsage({
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4'
      });
      
      // Second usage
      await aiUsageTracker.trackUsage({
        promptTokens: 200,
        completionTokens: 100,
        model: 'gpt-3.5-turbo'
      });
      
      // Total tokens should be accumulated
      expect(aiUsageTracker.stats.totalTokens).toBe(450);
      expect(aiUsageTracker.stats.sessionTokens).toBe(450);
      
      // Daily usage should be accumulated
      expect(aiUsageTracker.stats.dailyUsage['2025-01-01']).toBe(450);
      
      // Model usage should be tracked separately
      expect(aiUsageTracker.stats.modelUsage['gpt-4']).toBe(150);
      expect(aiUsageTracker.stats.modelUsage['gpt-3.5-turbo']).toBe(300);
    });
    
    it('should handle missing token counts', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      // Missing completion tokens
      await aiUsageTracker.trackUsage({
        promptTokens: 100,
        model: 'gpt-4'
      });
      
      expect(aiUsageTracker.stats.totalTokens).toBe(100);
      
      // Missing prompt tokens
      await aiUsageTracker.trackUsage({
        completionTokens: 50,
        model: 'gpt-4'
      });
      
      expect(aiUsageTracker.stats.totalTokens).toBe(150);
      
      // Missing both (should not change totals)
      await aiUsageTracker.trackUsage({
        model: 'gpt-4'
      });
      
      expect(aiUsageTracker.stats.totalTokens).toBe(150);
    });
    
    it('should handle missing model name', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      await aiUsageTracker.trackUsage({
        promptTokens: 100,
        completionTokens: 50
        // No model specified
      });
      
      expect(aiUsageTracker.stats.totalTokens).toBe(150);
      expect(aiUsageTracker.stats.modelUsage['unknown']).toBe(150);
    });
    
    it('should throw error if not initialized', async () => {
      const usageData = {
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4'
      };
      
      await expect(aiUsageTracker.trackUsage(usageData))
        .rejects.toThrow(MemoryStatsError);
    });
  });
  
  describe('getStats', () => {
    it('should return a copy of the stats', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      // Add some usage
      await aiUsageTracker.trackUsage({
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4'
      });
      
      const stats = aiUsageTracker.getStats();
      
      // Should be a copy, not a reference
      expect(stats).not.toBe(aiUsageTracker.stats);
      expect(stats).toEqual(aiUsageTracker.stats);
      
      // Modifying the returned stats should not affect the original
      stats.totalTokens = 1000;
      expect(aiUsageTracker.stats.totalTokens).toBe(150);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => aiUsageTracker.getStats())
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('getDailyUsage', () => {
    it('should return daily usage stats', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      // Add some usage
      await aiUsageTracker.trackUsage({
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4'
      });
      
      const dailyUsage = aiUsageTracker.getDailyUsage();
      
      expect(dailyUsage).toEqual({ '2025-01-01': 150 });
    });
    
    it('should throw error if not initialized', () => {
      expect(() => aiUsageTracker.getDailyUsage())
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('getModelUsage', () => {
    it('should return model usage stats', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      // Add usage for different models
      await aiUsageTracker.trackUsage({
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4'
      });
      
      await aiUsageTracker.trackUsage({
        promptTokens: 200,
        completionTokens: 100,
        model: 'gpt-3.5-turbo'
      });
      
      const modelUsage = aiUsageTracker.getModelUsage();
      
      expect(modelUsage).toEqual({
        'gpt-4': 150,
        'gpt-3.5-turbo': 300
      });
    });
    
    it('should throw error if not initialized', () => {
      expect(() => aiUsageTracker.getModelUsage())
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('getSessionUsage', () => {
    it('should return session token usage', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      // Add some usage
      await aiUsageTracker.trackUsage({
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4'
      });
      
      const sessionUsage = aiUsageTracker.getSessionUsage();
      
      expect(sessionUsage).toBe(150);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => aiUsageTracker.getSessionUsage())
        .toThrow(MemoryStatsError);
    });
  });
  
  describe('saveStats', () => {
    it('should save stats to file', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      // Add some usage
      await aiUsageTracker.trackUsage({
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4'
      });
      
      // Clear the mock to check if saveStats calls it
      fs.writeFile.mockClear();
      
      await aiUsageTracker.saveStats();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/mock/app/data/ai-usage/usage-stats.json',
        expect.any(String),
        'utf8'
      );
      
      // Check that the saved data contains the correct values
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(savedData.totalTokens).toBe(150);
      expect(savedData.sessionTokens).toBe(150);
      expect(savedData.dailyUsage['2025-01-01']).toBe(150);
      expect(savedData.modelUsage['gpt-4']).toBe(150);
    });
    
    it('should handle errors when saving', async () => {
      const services = {
        config: mockConfigService
      };
      
      await aiUsageTracker.initialize(services);
      
      fs.writeFile.mockRejectedValueOnce(new Error('Write error'));
      
      // Should not throw but log the error
      await expect(aiUsageTracker.saveStats()).resolves.toBe(false);
    });
    
    it('should throw error if not initialized', async () => {
      await expect(aiUsageTracker.saveStats())
        .rejects.toThrow(MemoryStatsError);
    });
  });
  
  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', async () => {
      await aiUsageTracker.ensureDirectoryExists('/test/dir');
      
      expect(fs.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });
    
    it('should throw error if directory creation fails', async () => {
      fs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(aiUsageTracker.ensureDirectoryExists('/test/dir'))
        .rejects.toThrow(MemoryStatsError);
    });
  });
}); 