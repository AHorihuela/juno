const Store = require('electron-store');
const configService = require('../configService');

// Mock electron-store
jest.mock('electron-store');

describe('ConfigService', () => {
  let mockStore;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock store instance
    mockStore = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      store: {},
    };
    Store.mockImplementation(() => mockStore);
    
    // Reset configService
    configService.store = null;
  });

  it('initializes with correct schema', () => {
    configService.initializeStore();
    expect(Store).toHaveBeenCalledWith({
      schema: {
        openaiApiKey: {
          type: 'string',
        },
        aiTriggerWord: {
          type: 'string',
          default: 'juno',
        },
        aiModel: {
          type: 'string',
          default: 'gpt-4',
        },
        aiTemperature: {
          type: 'number',
          minimum: 0,
          maximum: 2,
          default: 0.7,
        },
        startupBehavior: {
          type: 'string',
          enum: ['minimized', 'normal'],
          default: 'minimized',
        },
        defaultMicrophone: {
          type: 'string',
        },
      },
      encryptionKey: expect.any(String),
    });
  });

  describe('OpenAI API Key', () => {
    it('gets OpenAI API key', () => {
      const testKey = 'test-api-key';
      mockStore.get.mockReturnValue(testKey);
      
      configService.initializeStore();
      const result = configService.getOpenAIApiKey();
      
      expect(result).toBe(testKey);
      expect(mockStore.get).toHaveBeenCalledWith('openaiApiKey');
    });

    it('sets OpenAI API key', () => {
      const testKey = 'new-test-api-key';
      configService.initializeStore();
      configService.setOpenAIApiKey(testKey);

      expect(mockStore.set).toHaveBeenCalledWith('openaiApiKey', testKey);
    });

    it('checks if OpenAI API key exists', () => {
      configService.initializeStore();
      
      mockStore.get.mockReturnValue('test-api-key');
      expect(configService.hasOpenAIApiKey()).toBe(true);

      mockStore.get.mockReturnValue(null);
      expect(configService.hasOpenAIApiKey()).toBe(false);

      mockStore.get.mockReturnValue('');
      expect(configService.hasOpenAIApiKey()).toBe(false);
    });
  });

  describe('AI Settings', () => {
    it('manages AI trigger word', () => {
      const testWord = 'assistant';
      mockStore.get.mockReturnValue(testWord);
      
      expect(configService.getAITriggerWord()).toBe(testWord);
      
      configService.setAITriggerWord('helper');
      expect(mockStore.set).toHaveBeenCalledWith('aiTriggerWord', 'helper');
    });

    it('manages AI model', () => {
      const testModel = 'gpt-4-turbo';
      mockStore.get.mockReturnValue(testModel);
      
      expect(configService.getAIModel()).toBe(testModel);
      
      configService.setAIModel('gpt-3.5-turbo');
      expect(mockStore.set).toHaveBeenCalledWith('aiModel', 'gpt-3.5-turbo');
    });

    it('manages AI temperature', () => {
      const testTemp = 0.8;
      mockStore.get.mockReturnValue(testTemp);
      
      expect(configService.getAITemperature()).toBe(testTemp);
      
      configService.setAITemperature(1.0);
      expect(mockStore.set).toHaveBeenCalledWith('aiTemperature', 1.0);
    });

    it('validates temperature range', () => {
      expect(() => configService.setAITemperature(-0.1))
        .toThrow('Temperature must be between 0 and 2');
      
      expect(() => configService.setAITemperature(2.1))
        .toThrow('Temperature must be between 0 and 2');
    });
  });

  describe('App Settings', () => {
    it('manages startup behavior', () => {
      const testBehavior = 'minimized';
      mockStore.get.mockReturnValue(testBehavior);
      
      expect(configService.getStartupBehavior()).toBe(testBehavior);
      
      configService.setStartupBehavior('normal');
      expect(mockStore.set).toHaveBeenCalledWith('startupBehavior', 'normal');
    });

    it('validates startup behavior', () => {
      expect(() => configService.setStartupBehavior('invalid'))
        .toThrow('Invalid startup behavior');
    });

    it('manages default microphone', () => {
      const testDevice = 'device-123';
      mockStore.get.mockReturnValue(testDevice);
      
      expect(configService.getDefaultMicrophone()).toBe(testDevice);
      
      configService.setDefaultMicrophone('device-456');
      expect(mockStore.set).toHaveBeenCalledWith('defaultMicrophone', 'device-456');
    });
  });

  describe('Reset Settings', () => {
    it('resets all settings to defaults', () => {
      const result = configService.resetToDefaults();
      expect(mockStore.clear).toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });
}); 