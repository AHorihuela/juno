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
      },
      encryptionKey: expect.any(String),
    });
  });

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