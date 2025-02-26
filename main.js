const { app } = require('electron');
const path = require('path');

// Import service registry
const serviceRegistry = require('./src/main/services/ServiceRegistry');

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
console.log('[Main] Main process starting...');
console.log('[Main] Environment:', process.env.NODE_ENV);
console.log('[Main] Current working directory:', process.cwd());

// Set application name
app.name = 'Juno';
app.setName('Juno');

// Ensure app appears in dock on macOS
if (process.platform === 'darwin') {
  app.dock.setIcon(path.join(__dirname, 'assets/icon.png'));
  // Prevent app from exiting when all windows are closed
  app.setActivationPolicy('regular');
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Main window reference
let mainWindow = null;

/**
 * Initializes all services in the service registry
 */
async function initializeServices() {
  console.log('Initializing services...');
  
  // Register all services
  serviceRegistry
    .register('config', configService())
    .register('resource', resourceManager())
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
    .register('tray', trayService())
    .register('windowManager', windowManager())
    .register('transcriptionHistory', transcriptionHistoryService())
    .register('overlay', overlayService());

  // Initialize all services
  await serviceRegistry.initialize();
  console.log('All services initialized');
}

/**
 * Sets up all IPC handlers for communication with the renderer process
 */
function setupAllIpcHandlers() {
  // Setup core IPC handlers
  setupIpcHandlers(mainWindow);
  
  // Setup specialized IPC handlers
  setupDictionaryIpcHandlers();
  setupMicrophoneHandlers();
  setupSettingsHandlers();
  setupNotificationHandlers();
  setupRecordingHandlers();
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log('App ready, initializing...');
  
  try {
    // Initialize all services first
    await initializeServices();
    
    // Create the main window
    mainWindow = createMainWindow();
    
    // Setup IPC handlers
    setupAllIpcHandlers();
    
    // Setup error handlers
    setupErrorHandlers(mainWindow);
    
    // Register keyboard shortcuts
    await registerShortcuts();
    
    console.log('Application initialization completed');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await serviceRegistry.shutdown();
    app.quit();
  } else {
    // On macOS, keep the app in the dock even when all windows are closed
    // This allows users to reopen the app by clicking on the dock icon
    console.log('[Main] Window closed but app remains active in dock');
  }
});

// On macOS, re-create the window when the dock icon is clicked
app.on('activate', () => {
  if (mainWindow === null) {
    mainWindow = createMainWindow();
    setupAllIpcHandlers();
  } else {
    // If window exists but is hidden, show it
    mainWindow.show();
  }
});

// Set flag when quitting to prevent tray from keeping app alive
app.on('before-quit', () => {
  app.isQuitting = true;
});

// Clean up before quitting
app.on('will-quit', async () => {
  unregisterAllShortcuts();
  await serviceRegistry.shutdown();
});

// Log when app is quitting
app.on('quit', () => {
  console.log('[Main] Application quitting...');
}); 