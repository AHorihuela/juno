/**
 * Tests for the MemoryPersistence module
 */

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue('[]'),
    mkdir: jest.fn().mockResolvedValue(),
    access: jest.fn().mockResolvedValue(),
    stat: jest.fn().mockResolvedValue({ isFile: () => true }),
    copyFile: jest.fn().mockResolvedValue()
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

const MemoryPersistence = require('../../../../main/services/memory/MemoryPersistence');
const { MemoryStorageError } = require('../../../../main/services/memory/MemoryErrors');
const fs = require('fs').promises;
const path = require('path');

describe('MemoryPersistence', () => {
  let memoryPersistence;
  let mockConfigService;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock config service
    mockConfigService = {
      getAppDataPath: jest.fn().mockReturnValue('/mock/app/data')
    };
    
    // Create a new instance for each test
    memoryPersistence = new MemoryPersistence();
  });
  
  describe('initialization', () => {
    it('should initialize successfully with valid services', async () => {
      const services = {
        config: mockConfigService
      };
      
      await memoryPersistence.initialize(services);
      
      expect(memoryPersistence.initialized).toBe(true);
      expect(memoryPersistence.configService).toBe(mockConfigService);
      expect(memoryPersistence.memoryFilePath).toBe('/mock/app/data/memory/long-term-memory.json');
      expect(fs.mkdir).toHaveBeenCalledWith('/mock/app/data/memory', { recursive: true });
    });
    
    it('should throw error if config service is missing', async () => {
      const services = {};
      
      await expect(memoryPersistence.initialize(services))
        .rejects.toThrow(MemoryStorageError);
      
      expect(memoryPersistence.initialized).toBe(false);
    });
    
    it('should not initialize twice', async () => {
      const services = {
        config: mockConfigService
      };
      
      // First initialization
      await memoryPersistence.initialize(services);
      
      // Reset mock to check if it's called again
      mockConfigService.getAppDataPath.mockClear();
      fs.mkdir.mockClear();
      
      // Second initialization
      await memoryPersistence.initialize(services);
      
      // Should not call these methods again
      expect(mockConfigService.getAppDataPath).not.toHaveBeenCalled();
      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });
  
  describe('loadLongTermMemory', () => {
    it('should load memory from file', async () => {
      // Setup
      const services = {
        config: mockConfigService
      };
      
      const mockMemoryData = JSON.stringify([
        { id: 'item1', content: 'Test content 1' },
        { id: 'item2', content: 'Test content 2' }
      ]);
      
      fs.readFile.mockResolvedValueOnce(mockMemoryData);
      
      // Initialize
      await memoryPersistence.initialize(services);
      
      // Test
      const memory = await memoryPersistence.loadLongTermMemory();
      
      // Verify
      expect(fs.access).toHaveBeenCalledWith('/mock/app/data/memory/long-term-memory.json');
      expect(fs.readFile).toHaveBeenCalledWith('/mock/app/data/memory/long-term-memory.json', 'utf8');
      expect(memory).toHaveLength(2);
      expect(memory[0].id).toBe('item1');
      expect(memory[1].id).toBe('item2');
    });
    
    it('should return empty array if file does not exist', async () => {
      // Setup
      const services = {
        config: mockConfigService
      };
      
      fs.access.mockRejectedValueOnce(new Error('File not found'));
      
      // Initialize
      await memoryPersistence.initialize(services);
      
      // Test
      const memory = await memoryPersistence.loadLongTermMemory();
      
      // Verify
      expect(memory).toEqual([]);
    });
    
    it('should handle invalid JSON data', async () => {
      // Setup
      const services = {
        config: mockConfigService
      };
      
      fs.readFile.mockResolvedValueOnce('invalid json');
      
      // Initialize
      await memoryPersistence.initialize(services);
      
      // Test
      await expect(memoryPersistence.loadLongTermMemory())
        .rejects.toThrow(MemoryStorageError);
    });
    
    it('should throw error if not initialized', async () => {
      await expect(memoryPersistence.loadLongTermMemory())
        .rejects.toThrow(MemoryStorageError);
    });
  });
  
  describe('saveLongTermMemory', () => {
    it('should save memory to file', async () => {
      // Setup
      const services = {
        config: mockConfigService
      };
      
      const memory = [
        { id: 'item1', content: 'Test content 1' },
        { id: 'item2', content: 'Test content 2' }
      ];
      
      // Initialize
      await memoryPersistence.initialize(services);
      
      // Test
      const result = await memoryPersistence.saveLongTermMemory(memory);
      
      // Verify
      expect(result).toBe(true);
      expect(fs.stat).toHaveBeenCalledWith('/mock/app/data/memory/long-term-memory.json');
      expect(fs.copyFile).toHaveBeenCalledWith(
        '/mock/app/data/memory/long-term-memory.json',
        '/mock/app/data/memory/long-term-memory.json.backup'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/mock/app/data/memory/long-term-memory.json',
        JSON.stringify(memory, null, 2),
        'utf8'
      );
    });
    
    it('should handle case where file does not exist yet', async () => {
      // Setup
      const services = {
        config: mockConfigService
      };
      
      const memory = [
        { id: 'item1', content: 'Test content 1' }
      ];
      
      fs.stat.mockRejectedValueOnce({ code: 'ENOENT' });
      
      // Initialize
      await memoryPersistence.initialize(services);
      
      // Test
      const result = await memoryPersistence.saveLongTermMemory(memory);
      
      // Verify
      expect(result).toBe(true);
      expect(fs.copyFile).not.toHaveBeenCalled(); // Should not try to backup non-existent file
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/mock/app/data/memory/long-term-memory.json',
        JSON.stringify(memory, null, 2),
        'utf8'
      );
    });
    
    it('should throw error if not initialized', async () => {
      const memory = [{ id: 'item1', content: 'Test content' }];
      
      await expect(memoryPersistence.saveLongTermMemory(memory))
        .rejects.toThrow(MemoryStorageError);
    });
    
    it('should throw error if memory is not an array', async () => {
      // Setup
      const services = {
        config: mockConfigService
      };
      
      // Initialize
      await memoryPersistence.initialize(services);
      
      // Test with invalid memory (not an array)
      await expect(memoryPersistence.saveLongTermMemory({ invalid: 'format' }))
        .rejects.toThrow(MemoryStorageError);
    });
  });
  
  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', async () => {
      await memoryPersistence.ensureDirectoryExists('/test/dir');
      
      expect(fs.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });
    
    it('should throw error if directory creation fails', async () => {
      fs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(memoryPersistence.ensureDirectoryExists('/test/dir'))
        .rejects.toThrow(MemoryStorageError);
    });
  });
  
  describe('getMemoryFilePath', () => {
    it('should return the memory file path', async () => {
      // Setup
      const services = {
        config: mockConfigService
      };
      
      // Initialize
      await memoryPersistence.initialize(services);
      
      // Test
      const filePath = memoryPersistence.getMemoryFilePath();
      
      // Verify
      expect(filePath).toBe('/mock/app/data/memory/long-term-memory.json');
    });
    
    it('should return null if not initialized', () => {
      const filePath = memoryPersistence.getMemoryFilePath();
      
      expect(filePath).toBeNull();
    });
  });
}); 