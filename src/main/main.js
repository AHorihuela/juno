// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  
  // Show error notification
  const notificationService = require('./services/notificationService');
  notificationService.showNotification(
    'Application Error',
    'The application encountered an error and will restart.',
    'error'
  );

  // Give time for the notification to show before restarting
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 2000);
});

// Handle renderer process crashes
app.on('render-process-crashed', (event, webContents, killed) => {
  console.error('Renderer process crashed:', { killed });
  
  const notificationService = require('./services/notificationService');
  notificationService.showNotification(
    'Application Error',
    'A window crashed and will be restarted.',
    'error'
  );

  // Recreate the window
  createWindow();
});

// Handle GPU process crashes
app.on('gpu-process-crashed', (event, killed) => {
  console.error('GPU process crashed:', { killed });
  
  const notificationService = require('./services/notificationService');
  notificationService.showNotification(
    'Application Error',
    'The GPU process crashed. The application will restart.',
    'error'
  );

  // Restart the app
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 2000);
});

const setupDictionaryIpcHandlers = require('./services/dictionaryIpcHandlers');

app.whenReady().then(() => {
  // ... existing setup code ...
  
  // Set up dictionary IPC handlers
  setupDictionaryIpcHandlers();
  
  // ... rest of the setup code ...
}); 