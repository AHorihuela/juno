const { app } = require('electron');
const notificationService = require('../notificationService');

// Mock electron
jest.mock('electron', () => ({
  app: {
    relaunch: jest.fn(),
    exit: jest.fn(),
    on: jest.fn()
  }
}));

// Mock notification service
jest.mock('../notificationService', () => ({
  showNotification: jest.fn()
}));

describe('Crash Recovery', () => {
  let processEvents = {};
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock process.on
    processEvents = {};
    process.on = jest.fn((event, handler) => {
      processEvents[event] = handler;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('handles uncaught exceptions and restarts the app', () => {
    // Require main to register handlers
    require('../../main');
    
    // Simulate uncaught exception
    const error = new Error('Test error');
    processEvents['uncaughtException'](error);
    
    // Check notification
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      'Application Error',
      'The application encountered an error and will restart.',
      'error'
    );
    
    // Fast-forward timeout
    jest.advanceTimersByTime(2000);
    
    // Check app restart
    expect(app.relaunch).toHaveBeenCalled();
    expect(app.exit).toHaveBeenCalledWith(0);
  });

  it('handles renderer process crashes', () => {
    // Require main to register handlers
    const main = require('../../main');
    
    // Get the renderer crash handler
    const crashHandler = app.on.mock.calls.find(
      call => call[0] === 'render-process-crashed'
    )[1];
    
    // Simulate renderer crash
    crashHandler({}, {}, false);
    
    // Check notification
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      'Application Error',
      'A window crashed and will be restarted.',
      'error'
    );
  });

  it('handles GPU process crashes and restarts the app', () => {
    // Require main to register handlers
    const main = require('../../main');
    
    // Get the GPU crash handler
    const crashHandler = app.on.mock.calls.find(
      call => call[0] === 'gpu-process-crashed'
    )[1];
    
    // Simulate GPU crash
    crashHandler({}, false);
    
    // Check notification
    expect(notificationService.showNotification).toHaveBeenCalledWith(
      'Application Error',
      'The GPU process crashed. The application will restart.',
      'error'
    );
    
    // Fast-forward timeout
    jest.advanceTimersByTime(2000);
    
    // Check app restart
    expect(app.relaunch).toHaveBeenCalled();
    expect(app.exit).toHaveBeenCalledWith(0);
  });
}); 