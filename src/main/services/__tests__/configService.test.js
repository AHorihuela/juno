const Store = require('electron-store');
const fs = require('fs');
const path = require('path');

// Mock fs, electron and electron-store
jest.mock('fs');
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/user/data')
  }
}));
jest.mock('electron-store');

const configService = require('../configService');

describe('ConfigService', () => {
  let mockStore;
  const mockEncryptionKey = 'test-encryption-key-123';
  const mockKeyPath = path.join('/mock/user/data', '.encryption-key');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup fs mocks
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockEncryptionKey);
    fs.writeFileSync.mockImplementation(() => {});
    
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
    configService.encryptionKey = null;
  });

  it('initializes with correct schema', async () => {
    await configService.initializeStore();
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
    beforeEach(async () => {
      await configService.initializeStore();
    });

    it('gets OpenAI API key', async () => {
      const testKey = 'test-api-key';
      mockStore.get.mockReturnValue(testKey);
      
      const result = await configService.getOpenAIApiKey();
      
      expect(result).toBe(testKey);
      expect(mockStore.get).toHaveBeenCalledWith('openaiApiKey', '');
    });

    it('sets OpenAI API key', async () => {
      const testKey = 'new-test-api-key';
      await configService.setOpenAIApiKey(testKey);

      expect(mockStore.set).toHaveBeenCalledWith('openaiApiKey', testKey);
    });

    it('checks if OpenAI API key exists', async () => {
      mockStore.get.mockReturnValue('test-api-key');
      expect(await configService.hasOpenAIApiKey()).toBe(true);

      mockStore.get.mockReturnValue(null);
      expect(await configService.hasOpenAIApiKey()).toBe(false);

      mockStore.get.mockReturnValue('');
      expect(await configService.hasOpenAIApiKey()).toBe(false);
    });
  });

  describe('AI Settings', () => {
    beforeEach(async () => {
      await configService.initializeStore();
    });

    it('manages AI trigger word', async () => {
      const testWord = 'assistant';
      mockStore.get.mockReturnValue(testWord);
      
      expect(await configService.getAITriggerWord()).toBe(testWord);
      
      await configService.setAITriggerWord('helper');
      expect(mockStore.set).toHaveBeenCalledWith('aiTriggerWord', 'helper');
    });

    it('manages AI model', async () => {
      const testModel = 'gpt-4-turbo';
      mockStore.get.mockReturnValue(testModel);
      
      expect(await configService.getAIModel()).toBe(testModel);
      
      await configService.setAIModel('gpt-3.5-turbo');
      expect(mockStore.set).toHaveBeenCalledWith('aiModel', 'gpt-3.5-turbo');
    });

    it('manages AI temperature', async () => {
      const testTemp = 0.8;
      mockStore.get.mockReturnValue(testTemp);
      
      expect(await configService.getAITemperature()).toBe(testTemp);
      
      await configService.setAITemperature(1.0);
      expect(mockStore.set).toHaveBeenCalledWith('aiTemperature', 1.0);
    });

    it('validates temperature range', async () => {
      await expect(configService.setAITemperature(-0.1))
        .rejects.toThrow('Temperature must be between 0 and 2');
      
      await expect(configService.setAITemperature(2.1))
        .rejects.toThrow('Temperature must be between 0 and 2');
    });
  });

  describe('App Settings', () => {
    beforeEach(async () => {
      await configService.initializeStore();
    });

    it('manages startup behavior', async () => {
      const testBehavior = 'minimized';
      mockStore.get.mockReturnValue(testBehavior);
      
      expect(await configService.getStartupBehavior()).toBe(testBehavior);
      
      await configService.setStartupBehavior('normal');
      expect(mockStore.set).toHaveBeenCalledWith('startupBehavior', 'normal');
    });

    it('validates startup behavior', async () => {
      await expect(configService.setStartupBehavior('invalid'))
        .rejects.toThrow('Invalid startup behavior');
    });

    it('manages default microphone', async () => {
      const testDevice = 'device-123';
      mockStore.get.mockReturnValue(testDevice);
      
      expect(await configService.getDefaultMicrophone()).toBe(testDevice);
      
      await configService.setDefaultMicrophone('device-456');
      expect(mockStore.set).toHaveBeenCalledWith('defaultMicrophone', 'device-456');
    });
  });

  describe('Reset Settings', () => {
    beforeEach(async () => {
      await configService.initializeStore();
    });

    it('resets all settings to defaults', async () => {
      const result = await configService.resetToDefaults();
      expect(mockStore.clear).toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });
}); 