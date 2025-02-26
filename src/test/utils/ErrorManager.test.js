/**
 * Tests for ErrorManager
 */
const { expect } = require('chai');
const {
  ErrorManager,
  AppError,
  APIError,
  FileSystemError,
  ConfigError,
  IPCError
} = require('../../main/utils/ErrorManager');

describe('ErrorManager', () => {
  describe('Error classes', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', {
        code: 'TEST_CODE',
        metadata: { test: 'data' }
      });
      
      expect(error).to.be.instanceOf(Error);
      expect(error.name).to.equal('AppError');
      expect(error.message).to.equal('Test error');
      expect(error.code).to.equal('TEST_CODE');
      expect(error.metadata).to.deep.equal({ test: 'data' });
      expect(error.timestamp).to.be.instanceOf(Date);
      expect(error.stack).to.be.a('string');
    });
    
    it('should create APIError with correct properties', () => {
      const error = new APIError('API error', {
        code: 'API_ERROR',
        metadata: { api: 'test' }
      });
      
      expect(error).to.be.instanceOf(AppError);
      expect(error.name).to.equal('APIError');
      expect(error.code).to.equal('API_ERROR');
    });
    
    it('should create FileSystemError with correct properties', () => {
      const error = new FileSystemError('File error');
      
      expect(error).to.be.instanceOf(AppError);
      expect(error.name).to.equal('FileSystemError');
      expect(error.code).to.equal('ERR_FILESYSTEM');
    });
    
    it('should create ConfigError with correct properties', () => {
      const error = new ConfigError('Config error');
      
      expect(error).to.be.instanceOf(AppError);
      expect(error.name).to.equal('ConfigError');
      expect(error.code).to.equal('ERR_CONFIG');
    });
    
    it('should create IPCError with correct properties', () => {
      const error = new IPCError('IPC error');
      
      expect(error).to.be.instanceOf(AppError);
      expect(error.name).to.equal('IPCError');
      expect(error.code).to.equal('ERR_IPC');
    });
  });
  
  describe('AppError methods', () => {
    it('should convert error to JSON', () => {
      const error = new AppError('Test error', {
        code: 'TEST_CODE',
        metadata: { test: 'data' }
      });
      
      const json = error.toJSON();
      
      expect(json).to.be.an('object');
      expect(json.name).to.equal('AppError');
      expect(json.message).to.equal('Test error');
      expect(json.code).to.equal('TEST_CODE');
      expect(json.metadata).to.deep.equal({ test: 'data' });
      expect(json.timestamp).to.be.instanceOf(Date);
      expect(json.stack).to.be.a('string');
    });
    
    it('should convert error to string', () => {
      const error = new AppError('Test error', { code: 'TEST_CODE' });
      
      const str = error.toString();
      
      expect(str).to.equal('AppError [TEST_CODE]: Test error');
    });
  });
  
  describe('ErrorManager.handleError', () => {
    it('should handle AppError instances', () => {
      const error = new AppError('Test error');
      
      const result = ErrorManager.handleError(error);
      
      expect(result).to.be.an('object');
      expect(result.error).to.deep.equal(error.toJSON());
      expect(result.handled).to.be.true;
      expect(result.timestamp).to.be.instanceOf(Date);
    });
    
    it('should convert standard errors to AppError', () => {
      const stdError = new Error('Standard error');
      stdError.code = 'STD_ERROR';
      
      const result = ErrorManager.handleError(stdError);
      
      expect(result).to.be.an('object');
      expect(result.error.name).to.equal('AppError');
      expect(result.error.message).to.equal('Standard error');
      expect(result.error.code).to.equal('STD_ERROR');
      expect(result.error.metadata.originalError).to.equal(stdError);
    });
    
    it('should include context in metadata', () => {
      const error = new Error('Test error');
      const context = { user: 'test-user', action: 'test-action' };
      
      const result = ErrorManager.handleError(error, context);
      
      expect(result.error.metadata).to.include(context);
    });
  });
  
  describe('ErrorManager.createError', () => {
    it('should create APIError', () => {
      const error = ErrorManager.createError('api', 'API error');
      expect(error).to.be.instanceOf(APIError);
    });
    
    it('should create FileSystemError', () => {
      const error = ErrorManager.createError('filesystem', 'File error');
      expect(error).to.be.instanceOf(FileSystemError);
    });
    
    it('should create ConfigError', () => {
      const error = ErrorManager.createError('config', 'Config error');
      expect(error).to.be.instanceOf(ConfigError);
    });
    
    it('should create IPCError', () => {
      const error = ErrorManager.createError('ipc', 'IPC error');
      expect(error).to.be.instanceOf(IPCError);
    });
    
    it('should create AppError for unknown types', () => {
      const error = ErrorManager.createError('unknown', 'Unknown error');
      expect(error).to.be.instanceOf(AppError);
    });
    
    it('should pass options to created error', () => {
      const options = {
        code: 'CUSTOM_CODE',
        metadata: { custom: 'data' }
      };
      
      const error = ErrorManager.createError('api', 'API error', options);
      
      expect(error.code).to.equal('CUSTOM_CODE');
      expect(error.metadata).to.deep.equal({ custom: 'data' });
    });
  });
}); 