/**
 * Tests for ErrorManager
 */
const assert = require('assert');
const {
  ErrorManager,
  AppError,
  APIError,
  FileSystemError,
  ConfigError,
  IPCError
} = require('../../utils/ErrorManager');

describe('ErrorManager', () => {
  describe('Error classes', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', {
        code: 'TEST_CODE',
        metadata: { test: 'data' }
      });
      
      assert(error instanceof Error);
      assert.strictEqual(error.name, 'AppError');
      assert.strictEqual(error.message, 'Test error');
      assert.strictEqual(error.code, 'TEST_CODE');
      assert.deepStrictEqual(error.metadata, { test: 'data' });
      assert(error.timestamp instanceof Date);
      assert(typeof error.stack === 'string');
    });
    
    it('should create APIError with correct properties', () => {
      const error = new APIError('API error', {
        code: 'API_ERROR',
        metadata: { api: 'test' }
      });
      
      assert(error instanceof AppError);
      assert.strictEqual(error.name, 'APIError');
      assert.strictEqual(error.code, 'API_ERROR');
    });
    
    it('should create FileSystemError with correct properties', () => {
      const error = new FileSystemError('File error');
      
      assert(error instanceof AppError);
      assert.strictEqual(error.name, 'FileSystemError');
      assert.strictEqual(error.code, 'ERR_FILESYSTEM');
    });
    
    it('should create ConfigError with correct properties', () => {
      const error = new ConfigError('Config error');
      
      assert(error instanceof AppError);
      assert.strictEqual(error.name, 'ConfigError');
      assert.strictEqual(error.code, 'ERR_CONFIG');
    });
    
    it('should create IPCError with correct properties', () => {
      const error = new IPCError('IPC error');
      
      assert(error instanceof AppError);
      assert.strictEqual(error.name, 'IPCError');
      assert.strictEqual(error.code, 'ERR_IPC');
    });
  });
  
  describe('AppError methods', () => {
    it('should convert error to JSON', () => {
      const error = new AppError('Test error', {
        code: 'TEST_CODE',
        metadata: { test: 'data' }
      });
      
      const json = error.toJSON();
      
      assert(typeof json === 'object');
      assert.strictEqual(json.name, 'AppError');
      assert.strictEqual(json.message, 'Test error');
      assert.strictEqual(json.code, 'TEST_CODE');
      assert.deepStrictEqual(json.metadata, { test: 'data' });
      assert(json.timestamp instanceof Date);
      assert(typeof json.stack === 'string');
    });
    
    it('should convert error to string', () => {
      const error = new AppError('Test error', { code: 'TEST_CODE' });
      
      const str = error.toString();
      
      assert.strictEqual(str, 'AppError [TEST_CODE]: Test error');
    });
  });
  
  describe('ErrorManager.handleError', () => {
    it('should handle AppError instances', () => {
      const error = new AppError('Test error');
      
      const result = ErrorManager.handleError(error);
      
      assert(typeof result === 'object');
      assert.deepStrictEqual(result.error, error.toJSON());
      assert.strictEqual(result.handled, true);
      assert(result.timestamp instanceof Date);
    });
    
    it('should convert standard errors to AppError', () => {
      const stdError = new Error('Standard error');
      stdError.code = 'STD_ERROR';
      
      const result = ErrorManager.handleError(stdError);
      
      assert(typeof result === 'object');
      assert.strictEqual(result.error.name, 'AppError');
      assert.strictEqual(result.error.message, 'Standard error');
      assert.strictEqual(result.error.code, 'STD_ERROR');
      assert.strictEqual(result.error.metadata.originalError, stdError);
    });
    
    it('should include context in metadata', () => {
      const error = new Error('Test error');
      const context = { user: 'test-user', action: 'test-action' };
      
      const result = ErrorManager.handleError(error, context);
      
      // Check if context properties are in metadata
      for (const key in context) {
        assert(result.error.metadata.hasOwnProperty(key));
        assert.strictEqual(result.error.metadata[key], context[key]);
      }
    });
  });
  
  describe('ErrorManager.createError', () => {
    it('should create APIError', () => {
      const error = ErrorManager.createError('api', 'API error');
      assert(error instanceof APIError);
    });
    
    it('should create FileSystemError', () => {
      const error = ErrorManager.createError('filesystem', 'File error');
      assert(error instanceof FileSystemError);
    });
    
    it('should create ConfigError', () => {
      const error = ErrorManager.createError('config', 'Config error');
      assert(error instanceof ConfigError);
    });
    
    it('should create IPCError', () => {
      const error = ErrorManager.createError('ipc', 'IPC error');
      assert(error instanceof IPCError);
    });
    
    it('should create AppError for unknown types', () => {
      const error = ErrorManager.createError('unknown', 'Unknown error');
      assert(error instanceof AppError);
    });
    
    it('should pass options to created error', () => {
      const options = {
        code: 'CUSTOM_CODE',
        metadata: { custom: 'data' }
      };
      
      const error = ErrorManager.createError('api', 'API error', options);
      
      assert.strictEqual(error.code, 'CUSTOM_CODE');
      assert.deepStrictEqual(error.metadata, { custom: 'data' });
    });
  });
}); 