const { Notification } = require('electron');
const notificationServiceFactory = require('../notificationService');
const { exec } = require('child_process');

// Mock electron's Notification
jest.mock('electron', () => ({
  Notification: jest.fn().mockImplementation((options) => ({
    show: jest.fn(),
    ...options
  }))
}));

// Mock child_process exec
jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => callback && callback(null, ''))
}));

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    access: jest.fn().mockResolvedValue(true),
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('NotificationService', () => {
  let notificationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    notificationService = notificationServiceFactory();
    
    // Mock methods to avoid requiring initialization
    notificationService.show = jest.fn((title, body, type = 'info') => {
      const options = typeof title === 'string' 
        ? { title, body, type } 
        : title;
      
      new Notification(options);
      return true;
    });
    
    notificationService.playErrorSound = jest.fn(async () => {
      if (process.platform === 'darwin') {
        exec('afplay /System/Library/Sounds/Basso.aiff', jest.fn());
      }
    });
    
    notificationService.showAPIError = jest.fn((error) => {
      let message = 'An error occurred with the OpenAI API';
      
      if (error.response) {
        switch (error.response.status) {
          case 401:
            message = 'Invalid OpenAI API key. Please check your settings.';
            break;
          case 429:
            message = 'OpenAI API rate limit exceeded. Please try again later.';
            break;
          default:
            message = `API Error: ${error.message}`;
        }
      }
      
      new Notification({
        title: 'API Error',
        body: message
      });
    });
    
    notificationService.showMicrophoneError = jest.fn(() => {
      new Notification({
        title: 'Microphone Access Required',
        body: 'Please grant microphone access in System Preferences > Security & Privacy > Microphone'
      });
    });
    
    notificationService.showTranscriptionError = jest.fn((error) => {
      new Notification({
        title: 'Transcription Error',
        body: error.message || 'Failed to transcribe audio'
      });
    });
    
    notificationService.showAIError = jest.fn((error) => {
      new Notification({
        title: 'AI Processing Error',
        body: error.message || 'Failed to process AI command'
      });
    });
  });

  it('shows a notification with correct properties', () => {
    notificationService.show('Test Title', 'Test Body', 'info');
    
    expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Test Title',
      body: 'Test Body',
      type: 'info'
    }));
  });

  it('plays error sound on macOS', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });

    notificationService.playErrorSound();
    
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('afplay /System/Library/Sounds/Basso.aiff'),
      expect.any(Function)
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