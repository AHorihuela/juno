const { clipboard } = require('electron');
const contextServiceFactory = require('../contextService');

// Mock the ClipboardManager
jest.mock('../../services/context/ClipboardManager', () => {
  return jest.fn().mockImplementation(() => {
    return {
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
      on: jest.fn(),
      getCurrentContent: jest.fn().mockReturnValue({
        content: 'clipboard content',
        timestamp: Date.now(),
        application: 'test-app',
        isFresh: true
      }),
      updateClipboardContext: jest.fn(),
      startInternalOperation: jest.fn(),
      endInternalOperation: jest.fn(),
      isClipboardFresh: jest.fn().mockImplementation((maxAgeMs, recordingStartTime) => {
        // Mock implementation based on test needs
        return true;
      }),
      setActiveApplication: jest.fn()
    };
  });
});

// Mock the ContextHistory
jest.mock('../../services/context/ContextHistory', () => {
  return jest.fn().mockImplementation(() => {
    return {
      addItem: jest.fn(),
      getAll: jest.fn().mockReturnValue([]),
      getRecent: jest.fn().mockReturnValue([]),
      deleteItem: jest.fn(),
      clear: jest.fn(),
      size: jest.fn().mockReturnValue(0),
      isSimilarToExisting: jest.fn().mockReturnValue(false)
    };
  });
});

// Mock the ContextRetrieval
jest.mock('../../services/context/ContextRetrieval', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getContext: jest.fn().mockImplementation((currentHighlightedText) => {
        // Return different context based on input
        if (currentHighlightedText) {
          return {
            primaryContext: {
              type: 'highlight',
              content: currentHighlightedText
            },
            secondaryContext: currentHighlightedText === 'clipboard content' ? null : {
              type: 'clipboard',
              content: 'clipboard content'
            }
          };
        } else {
          return {
            primaryContext: {
              type: 'clipboard',
              content: 'clipboard content'
            },
            secondaryContext: null
          };
        }
      }),
      getContextAsync: jest.fn().mockImplementation((currentHighlightedText) => {
        return Promise.resolve(this.getContext(currentHighlightedText));
      }),
      invalidateContextCache: jest.fn(),
      setActiveApplication: jest.fn()
    };
  });
});

// Mock electron clipboard
jest.mock('electron', () => ({
  clipboard: {
    readText: jest.fn().mockReturnValue('clipboard content'),
  }
}));

// Mock BaseService
jest.mock('../../services/BaseService', () => {
  return class MockBaseService {
    constructor(name) {
      this.name = name;
    }
    
    getService() {
      return null;
    }
    
    getServices() {
      return {};
    }
    
    emitError() {}
  };
});

describe('ContextService', () => {
  let contextService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Create a new instance for each test
    contextService = contextServiceFactory();
    
    // Initialize the service
    contextService._initialize();
  });

  afterEach(() => {
    jest.useRealTimers();
    contextService._shutdown();
  });

  describe('Recording Session', () => {
    it('starts recording session', async () => {
      const highlightedText = 'test highlight';
      await contextService.startRecording(highlightedText);
      
      expect(contextService.isRecording).toBe(true);
      expect(contextService.highlightedText).toBe(highlightedText);
      expect(contextService.recordingStartTime).toBeDefined();
    });

    it('stops recording session', async () => {
      await contextService.startRecording('test');
      contextService.stopRecording();
      
      expect(contextService.recordingStartTime).toBeNull();
      expect(contextService.isRecording).toBe(false);
      expect(contextService.highlightedText).toBe('');
    });
  });

  describe('Context Management', () => {
    it('gets context with highlighted text', async () => {
      const context = await contextService.getContext('highlighted text');
      
      expect(context.primaryContext).toEqual({
        type: 'highlight',
        content: 'highlighted text'
      });
    });

    it('gets context without highlighted text', async () => {
      const context = await contextService.getContext();
      
      expect(context.primaryContext).toEqual({
        type: 'clipboard',
        content: 'clipboard content'
      });
    });
  });

  describe('Memory Management', () => {
    it('clears memory', async () => {
      const result = await contextService.clearMemory();
      
      expect(result).toBe(true);
      expect(contextService.contextHistory.clear).toHaveBeenCalled();
    });

    it('deletes memory item', async () => {
      const result = await contextService.deleteMemoryItem('test-id');
      
      expect(result).toBe(true);
      expect(contextService.contextHistory.deleteItem).toHaveBeenCalledWith('test-id');
    });
  });

  describe('Clipboard Operations', () => {
    it('starts internal clipboard operation', () => {
      contextService.startInternalOperation();
      
      expect(contextService.clipboardManager.startInternalOperation).toHaveBeenCalled();
    });

    it('ends internal clipboard operation', () => {
      contextService.endInternalOperation();
      
      expect(contextService.clipboardManager.endInternalOperation).toHaveBeenCalled();
    });
  });
}); 