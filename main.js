const { app } = require('electron');
const path = require('path');

// Import LogManager for centralized logging
const LogManager = require('./src/main/utils/LogManager');

// Initialize LogManager early
LogManager.initialize({
  logLevel: process.env.NODE_ENV === 'development' ? 'DEBUG' : 'INFO'
});

// Get a logger for the main process
const logger = LogManager.getLogger('Main');

// Import service registry
const ServiceRegistry = require('./src/main/services/ServiceRegistry');
const serviceRegistry = new ServiceRegistry();

// Import service factories
const configService = require('./src/main/services/configService');
const recorderService = require('./src/main/services/recorder');
const transcriptionService = require('./src/main/services/transcriptionService');
const notificationService = require('./src/main/services/notificationService');
const trayService = require('./src/main/services/trayService');
const audioFeedbackService = require('./src/main/services/audioFeedbackService');
const dictionaryService = require('./src/main/services/dictionaryService');
const contextService = require('./src/main/services/contextService');
const selectionService = require('./src/main/services/selectionService');
const textInsertionService = require('./src/main/services/textInsertionService');
const aiService = require('./src/main/services/aiService');
const transcriptionHistoryService = require('./src/main/services/transcriptionHistoryService');
const windowManager = require('./src/main/services/WindowManager');
const textProcessingService = require('./src/main/services/textProcessing');
const resourceManager = require('./src/main/services/resourceManager');
const overlayService = require('./src/main/services/OverlayService');
const loggingService = require('./src/main/services/LoggingService');
const ipcService = require('./src/main/services/IPCService');

// Import IPC handlers
const setupIpcHandlers = require('./src/main/ipc/handlers');
const setupDictionaryIpcHandlers = require('./src/main/services/dictionaryIpcHandlers');
const setupMicrophoneHandlers = require('./src/main/ipc/microphoneHandlers');
const setupSettingsHandlers = require('./src/main/ipc/settingsHandlers');
const setupNotificationHandlers = require('./src/main/ipc/notificationHandlers');
const setupRecordingHandlers = require('./src/main/ipc/recordingHandlers');

// Import utilities
const { setupErrorHandlers } = require('./src/main/utils/errorHandlers');
const { createMainWindow } = require('./src/main/utils/windowManager');
const { registerShortcuts, unregisterAllShortcuts } = require('./src/main/utils/shortcutManager');

// First log to verify process start
logger.info('Main process starting...');
logger.info('Environment: ' + process.env.NODE_ENV);
logger.info('Current working directory: ' + process.cwd());

// Set application name
app.name = 'Juno';
app.setName('Juno');

// Ensure app appears in dock on macOS
if (process.platform === 'darwin') {
  app.dock.setIcon(path.join(__dirname, 'assets/icon.png'));
  // We want the app to appear in the dock, so we're not hiding it
  // app.dock.hide();
}

// Only allow a single instance of the app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.warn('Another instance is already running. Exiting...');
  app.quit();
  return;
}

// Handle second instance
app.on('second-instance', () => {
  logger.info('Second instance detected, focusing main window');
  const mainWindowService = serviceRegistry.get('windowManager');
  if (mainWindowService) {
    mainWindowService.showMainWindow();
  }
});

// Initialize services
async function initializeServices() {
  try {
    logger.info('Registering services...');
    
    // Register all services
    serviceRegistry
      .register('config', configService())
      .register('resource', resourceManager())
      .register('ipc', ipcService())
      .register('logging', loggingService())
      .register('notification', notificationService())
      .register('dictionary', dictionaryService())
      .register('textProcessing', textProcessingService())
      .register('audio', audioFeedbackService())
      .register('recorder', recorderService())
      .register('transcription', transcriptionService())
      .register('ai', aiService())
      .register('context', contextService())
      .register('selection', selectionService())
      .register('textInsertion', textInsertionService())
      .register('history', transcriptionHistoryService())
      .register('tray', trayService())
      .register('windowManager', windowManager())
      .register('overlay', overlayService());
    
    // Initialize all services
    await serviceRegistry.initialize();
    
    // Register global shortcuts
    try {
      logger.info('Registering global shortcuts...');
      const shortcutSuccess = await registerShortcuts(serviceRegistry);
      logger.info('Global shortcuts registration result:', { metadata: { success: shortcutSuccess } });
    } catch (error) {
      logger.error('Failed to register global shortcuts:', { metadata: { error } });
    }
    
    logger.info('Application initialization complete');
  } catch (error) {
    logger.error('Failed to initialize services', { metadata: { error } });
    app.exit(1);
  }
}

function setupAllIpcHandlers(mainWindow) {
  logger.info('Setting up IPC handlers...');
  
  setupIpcHandlers(mainWindow, serviceRegistry);
  setupDictionaryIpcHandlers(serviceRegistry);
  setupMicrophoneHandlers(serviceRegistry);
  setupSettingsHandlers(serviceRegistry);
  setupNotificationHandlers(serviceRegistry);
  setupRecordingHandlers(serviceRegistry);
  
  logger.info('IPC handlers setup complete');
}

// Handle app ready event
app.whenReady().then(async () => {
  logger.info('Application ready');
  
  // Initialize services
  await initializeServices();
  
  // Create main window
  try {
    console.log('Creating window...');
    const mainWindow = createMainWindow(serviceRegistry);
    
    // Setup error handlers with the main window
    setupErrorHandlers(mainWindow, serviceRegistry);
    
    // Setup IPC handlers with the main window
    setupAllIpcHandlers(mainWindow);
    
    // Log success
    logger.info('Main window created successfully');
  } catch (error) {
    logger.error('Failed to create main window', { metadata: { error } });
    app.exit(1);
  }
});

// Handle app activation (macOS)
app.on('activate', () => {
  logger.info('Application activated');
  const mainWindowService = serviceRegistry.get('windowManager');
  if (mainWindowService) {
    mainWindowService.showMainWindow();
  }
});

// Handle app before-quit event
app.on('before-quit', async (event) => {
  logger.info('Application quitting...');
  
  // Unregister all shortcuts
  unregisterAllShortcuts();
  
  // Shutdown all services
  try {
    await serviceRegistry.shutdown();
    logger.info('Services shutdown complete');
  } catch (error) {
    logger.error('Error during service shutdown', { metadata: { error } });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in main process', { metadata: { error } });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection in main process', { metadata: { reason } });
}); 