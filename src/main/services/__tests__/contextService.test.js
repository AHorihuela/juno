const { clipboard } = require('electron');
const contextService = require('../contextService');

// Mock electron clipboard
jest.mock('electron', () => ({
  clipboard: {
    readText: jest.fn(),
  }
}));

describe('ContextService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset service state
    contextService.clipboardTimestamp = null;
    contextService.clipboardContent = null;
    contextService.recordingStartTime = null;
    contextService.isRecording = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Recording Session', () => {
    it('starts recording session', () => {
      const now = Date.now();
      contextService.startRecording();
      
      expect(contextService.recordingStartTime).toBe(now);
      expect(contextService.isRecording).toBe(true);
    });

    it('stops recording session', () => {
      contextService.startRecording();
      contextService.stopRecording();
      
      expect(contextService.recordingStartTime).toBeNull();
      expect(contextService.isRecording).toBe(false);
    });
  });

  describe('Clipboard Management', () => {
    it('updates clipboard context when content changes', () => {
      clipboard.readText.mockReturnValue('new content');
      
      contextService.updateClipboardContext();
      
      expect(contextService.clipboardContent).toBe('new content');
      expect(contextService.clipboardTimestamp).toBe(Date.now());
    });

    it('does not update timestamp if content is the same', () => {
      clipboard.readText.mockReturnValue('same content');
      
      contextService.updateClipboardContext();
      const firstTimestamp = contextService.clipboardTimestamp;
      
      jest.advanceTimersByTime(1000);
      contextService.updateClipboardContext();
      
      expect(contextService.clipboardTimestamp).toBe(firstTimestamp);
    });
  });

  describe('Clipboard Freshness', () => {
    it('considers clipboard fresh within 30 seconds', () => {
      contextService.clipboardTimestamp = Date.now();
      
      expect(contextService.isClipboardFresh()).toBe(true);
      
      jest.advanceTimersByTime(29000);
      expect(contextService.isClipboardFresh()).toBe(true);
      
      jest.advanceTimersByTime(2000);
      expect(contextService.isClipboardFresh()).toBe(false);
    });

    it('considers clipboard fresh during recording regardless of time', () => {
      contextService.startRecording();
      contextService.clipboardTimestamp = Date.now();
      
      jest.advanceTimersByTime(60000); // 1 minute later
      expect(contextService.isClipboardFresh()).toBe(true);
      
      contextService.stopRecording();
      expect(contextService.isClipboardFresh()).toBe(false);
    });

    it('requires clipboard update during current recording', () => {
      contextService.clipboardTimestamp = Date.now();
      jest.advanceTimersByTime(1000);
      
      contextService.startRecording();
      expect(contextService.isClipboardFresh()).toBe(false);
      
      contextService.updateClipboardContext();
      expect(contextService.isClipboardFresh()).toBe(true);
    });
  });

  describe('Context Generation', () => {
    it('prioritizes highlighted text as primary context', () => {
      clipboard.readText.mockReturnValue('clipboard content');
      contextService.clipboardTimestamp = Date.now();
      
      const context = contextService.getContext('highlighted text');
      
      expect(context.primaryContext).toEqual({
        type: 'highlight',
        content: 'highlighted text'
      });
      expect(context.secondaryContext).toEqual({
        type: 'clipboard',
        content: 'clipboard content'
      });
    });

    it('uses fresh clipboard as primary context when no highlight', () => {
      clipboard.readText.mockReturnValue('clipboard content');
      contextService.clipboardTimestamp = Date.now();
      
      const context = contextService.getContext();
      
      expect(context.primaryContext).toEqual({
        type: 'clipboard',
        content: 'clipboard content'
      });
      expect(context.secondaryContext).toBeNull();
    });

    it('ignores stale clipboard content', () => {
      clipboard.readText.mockReturnValue('clipboard content');
      contextService.clipboardTimestamp = Date.now() - 31000; // 31 seconds old
      
      const context = contextService.getContext();
      
      expect(context.primaryContext).toBeNull();
      expect(context.secondaryContext).toBeNull();
    });

    it('does not include clipboard as secondary if same as highlight', () => {
      const content = 'same content';
      clipboard.readText.mockReturnValue(content);
      contextService.clipboardTimestamp = Date.now();
      
      const context = contextService.getContext(content);
      
      expect(context.primaryContext).toEqual({
        type: 'highlight',
        content
      });
      expect(context.secondaryContext).toBeNull();
    });
  });
}); 