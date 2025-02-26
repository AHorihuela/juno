/**
 * Tests for the MemoryErrors module
 */

const {
  MemoryError,
  MemoryAccessError,
  MemoryStorageError,
  MemoryTierError,
  MemoryScoringError,
  MemoryStatsError
} = require('../../../../main/services/memory/MemoryErrors');

describe('MemoryErrors', () => {
  describe('MemoryError', () => {
    it('should create a basic error with name and message', () => {
      const error = new MemoryError('Test error message');
      
      expect(error.name).toBe('MemoryError');
      expect(error.message).toBe('Test error message');
      expect(error.context).toEqual({});
      expect(error.cause).toBeUndefined();
    });
    
    it('should include cause when provided', () => {
      const cause = new Error('Cause error');
      const error = new MemoryError('Test error message', { cause });
      
      expect(error.name).toBe('MemoryError');
      expect(error.message).toBe('Test error message');
      expect(error.cause).toBe(cause);
    });
    
    it('should include context when provided', () => {
      const context = { itemId: '123', operation: 'read' };
      const error = new MemoryError('Test error message', { context });
      
      expect(error.name).toBe('MemoryError');
      expect(error.message).toBe('Test error message');
      expect(error.context).toEqual(context);
    });
    
    it('should add additional options to context', () => {
      const error = new MemoryError('Test error message', { 
        itemId: '123', 
        operation: 'read',
        cause: new Error('Cause error')
      });
      
      expect(error.name).toBe('MemoryError');
      expect(error.message).toBe('Test error message');
      expect(error.context).toEqual({ itemId: '123', operation: 'read' });
      expect(error.cause).toBeDefined();
    });
    
    it('should provide a JSON representation', () => {
      const cause = new Error('Cause error');
      const error = new MemoryError('Test error message', { 
        cause,
        itemId: '123', 
        operation: 'read' 
      });
      
      const json = error.toJSON();
      
      expect(json.name).toBe('MemoryError');
      expect(json.message).toBe('Test error message');
      expect(json.context).toEqual({ itemId: '123', operation: 'read' });
      expect(json.cause).toBeDefined();
      expect(json.stack).toBeDefined();
    });
  });
  
  describe('Specialized Error Classes', () => {
    it('should create MemoryAccessError with correct name', () => {
      const error = new MemoryAccessError('Access error');
      
      expect(error.name).toBe('MemoryAccessError');
      expect(error.message).toBe('Access error');
      expect(error instanceof MemoryError).toBe(true);
    });
    
    it('should create MemoryStorageError with correct name', () => {
      const error = new MemoryStorageError('Storage error');
      
      expect(error.name).toBe('MemoryStorageError');
      expect(error.message).toBe('Storage error');
      expect(error instanceof MemoryError).toBe(true);
    });
    
    it('should create MemoryTierError with correct name', () => {
      const error = new MemoryTierError('Tier error');
      
      expect(error.name).toBe('MemoryTierError');
      expect(error.message).toBe('Tier error');
      expect(error instanceof MemoryError).toBe(true);
    });
    
    it('should create MemoryScoringError with correct name', () => {
      const error = new MemoryScoringError('Scoring error');
      
      expect(error.name).toBe('MemoryScoringError');
      expect(error.message).toBe('Scoring error');
      expect(error instanceof MemoryError).toBe(true);
    });
    
    it('should create MemoryStatsError with correct name', () => {
      const error = new MemoryStatsError('Stats error');
      
      expect(error.name).toBe('MemoryStatsError');
      expect(error.message).toBe('Stats error');
      expect(error instanceof MemoryError).toBe(true);
    });
  });
}); 