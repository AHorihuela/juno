const { Notification } = require('electron');
const notificationService = require('../notificationService');
const { exec } = require('child_process');

// Mock electron's Notification
jest.mock('electron', () => ({
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn()
  }))
}));

// Mock child_process exec
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a notification with correct properties', () => {
    notificationService.showNotification('Test Title', 'Test Body', 'info');
    
    expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Test Title',
      body: 'Test Body',
      silent: true
    }));
  });

  it('plays error sound on macOS', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });

    notificationService.playErrorSound();
    
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('afplay /System/Library/Sounds/Basso.aiff')
    );

    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });

  it('shows API error notification with correct message', () => {
    const error = new Error('API Error');
    error.response = { status: 401 };
    
    notificationService.showAPIError(error);
    
    expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'API Error',
      body: 'Invalid OpenAI API key. Please check your settings.'
    }));
  });

  it('shows microphone error with correct instructions', () => {
    notificationService.showMicrophoneError();
    
    expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Microphone Access Required',
      body: expect.stringContaining('System Preferences')
    }));
  });

  it('shows transcription error with custom message', () => {
    const error = new Error('Custom transcription error');
    
    notificationService.showTranscriptionError(error);
    
    expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Transcription Error',
      body: 'Custom transcription error'
    }));
  });

  it('shows AI error with default message if none provided', () => {
    const error = new Error();
    
    notificationService.showAIError(error);
    
    expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'AI Processing Error',
      body: 'Failed to process AI command'
    }));
  });
}); 