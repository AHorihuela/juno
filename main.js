const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Import service registry
const serviceRegistry = require('./src/main/services/ServiceRegistry');

// Import service factories
const configService = require('./src/main/services/configService');
const recorderService = require('./src/main/services/recorder');
const transcriptionService = require('./src/main/services/transcriptionService');
const notificationService = require('./src/main/services/notificationService');
const overlayService = require('./src/main/services/overlayService');
const trayService = require('./src/main/services/trayService');
const audioFeedbackService = require('./src/main/services/audioFeedbackService');
const dictionaryService = require('./src/main/services/dictionaryService');
const contextService = require('./src/main/services/contextService');
const selectionService = require('./src/main/services/selectionService');
const textInsertionService = require('./src/main/services/textInsertionService');
const aiService = require('./src/main/services/aiService');
const transcriptionHistoryService = require('./src/main/services/transcriptionHistoryService');
const windowService = require('./src/main/services/windowService');
const textProcessingService = require('./src/main/services/textProcessing');
const resourceManager = require('./src/main/services/resourceManager');

// Import IPC handlers
const setupIpcHandlers = require('./src/main/ipc/handlers');

// First log to verify process start
console.log('[Main] Main process starting...');
console.log('[Main] Environment:', process.env.NODE_ENV);
console.log('[Main] Current working directory:', process.cwd());

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;
let fnKeyTimeout = null;
const FN_DOUBLE_TAP_DELAY = 300; // ms
let lastFnKeyPress = 0;

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
    .register('window', windowService())
    .register('overlay', overlayService())
    .register('transcriptionHistory', transcriptionHistoryService());

  // Initialize all services
  await serviceRegistry.initialize();
  console.log('All services initialized');
}

function createWindow() {
  try {
    console.log('Creating window...');
    mainWindow = new BrowserWindow({
      width: 800,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: true,
      },
      show: false, // Don't show window initially
    });

    // Set Content Security Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self';",
            `script-src 'self' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval' 'unsafe-inline'" : ''};`,
            "style-src 'self' 'unsafe-inline';", // Allow inline styles for Tailwind
            "font-src 'self' data:;",
            "img-src 'self' data:;",
            "connect-src 'self';",
          ].join(' ')
        }
      });
    });

    console.log('Loading index.html...');
    mainWindow.loadFile('dist/index.html');

    // Show window when ready to show
    mainWindow.once('ready-to-show', () => {
      console.log('Window ready to show');
      mainWindow.show();
      
      // Open DevTools in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Opening DevTools in development mode');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });

    // Setup IPC handlers
    setupIpcHandlers(mainWindow);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

  } catch (error) {
    console.error('Error creating window:', error);
    app.quit();
  }
}

async function registerShortcuts() {
  console.log('Registering shortcuts...');
  
  // Get configured shortcut
  const shortcut = await serviceRegistry.get('config').getKeyboardShortcut();
  console.log('Using keyboard shortcut:', shortcut);
  
  // Register configured shortcut for toggle
  const success = globalShortcut.register(shortcut, () => {
    console.log('Shortcut triggered');
    const now = Date.now();
    
    if (now - lastFnKeyPress <= FN_DOUBLE_TAP_DELAY) {
      // Double tap detected
      console.log('Double tap detected, starting recording');
      clearTimeout(fnKeyTimeout);
      const recorder = serviceRegistry.get('recorder');
      if (!recorder.isRecording()) {
        recorder.start();
      }
    } else {
      // Single tap - wait to see if it's a double tap
      console.log('Single tap detected, waiting for potential double tap');
      fnKeyTimeout = setTimeout(() => {
        const recorder = serviceRegistry.get('recorder');
        if (recorder.isRecording()) {
          console.log('Single tap timeout reached, stopping recording');
          recorder.stop();
        }
      }, FN_DOUBLE_TAP_DELAY);
    }
    
    lastFnKeyPress = now;
  });

  console.log('Keyboard shortcut registration success:', success);
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log('App ready, initializing...');
  
  try {
    // Initialize all services first
    await initializeServices();
    
    // Create the main window
    createWindow();
    
    // Register keyboard shortcuts
    await registerShortcuts();
    
    console.log('Application initialization completed');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await serviceRegistry.shutdown();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  await serviceRegistry.shutdown();
});

// Handle microphone selection
ipcMain.handle('set-microphone', async (event, deviceId) => {
  try {
    // Update the recorder's device
    const success = await serviceRegistry.get('recorder').setDevice(deviceId);
    if (!success) {
      throw new Error('Failed to switch to selected microphone');
    }
    
    // Update the config
    await serviceRegistry.get('config').setDefaultMicrophone(deviceId);
    
    return { success: true };
  } catch (error) {
    console.error('Error setting microphone:', error);
    throw error;
  }
});

// Handle renderer process crashes
app.on('render-process-crashed', (event, webContents, killed) => {
  console.error('Renderer process crashed:', { killed });
  
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
  if (mainWindow) {
    mainWindow.webContents.send('error', {
      message: 'An unexpected error occurred',
      error: error.message
    });
  }
});

// Log when app is quitting
app.on('quit', () => {
  console.log('[Main] Application quitting...');
});

// Update settings handlers to use handle/invoke
ipcMain.handle('save-settings', async (_, settings) => {
  try {
    // Handle each setting individually to properly handle null/undefined
    if (settings.openaiApiKey !== undefined) {
      await configService.setOpenAIApiKey(settings.openaiApiKey || '');
    }
    if (settings.aiTriggerWord !== undefined) {
      await configService.setAITriggerWord(settings.aiTriggerWord || 'juno');
    }
    if (settings.aiModel !== undefined) {
      await configService.setAIModel(settings.aiModel || 'gpt-4');
    }
    if (settings.aiTemperature !== undefined) {
      await configService.setAITemperature(settings.aiTemperature || 0.7);
    }
    if (settings.startupBehavior !== undefined) {
      await configService.setStartupBehavior(settings.startupBehavior || 'minimized');
    }
    if (settings.defaultMicrophone !== undefined) {
      await configService.setDefaultMicrophone(settings.defaultMicrophone || '');
    }
    if (settings.actionVerbs !== undefined) {
      await configService.setActionVerbs(settings.actionVerbs);
    }
    if (settings.aiRules !== undefined) {
      await configService.setAIRules(settings.aiRules);
    }
    if (settings.keyboardShortcut !== undefined) {
      await configService.setKeyboardShortcut(settings.keyboardShortcut);
      // Re-register shortcuts when the keyboard shortcut changes
      globalShortcut.unregisterAll();
      await registerShortcuts();
    }
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    throw new Error(`Failed to save settings: ${error.message}`);
  }
});

// Update microphone handling
ipcMain.handle('get-microphones', async () => {
  try {
    console.log('Enumerating audio devices...');
    // Forward the request to the renderer process since mediaDevices API
    // is only available in the renderer context
    if (mainWindow) {
      return await mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            // Request microphone permission first
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Then enumerate devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices
              .filter(device => {
                const label = device.label.toLowerCase();
                // Only include physical microphones, exclude virtual and mobile devices
                const isAudioInput = device.kind === 'audioinput';
                const isNotVirtual = !label.includes('virtual') && 
                                   !label.includes('webex') && 
                                   !label.includes('zoom') &&
                                   !label.includes('iphone') &&
                                   !label.includes('continuity');
                console.log('Device:', {
                  label,
                  isAudioInput,
                  isNotVirtual,
                  included: isAudioInput && isNotVirtual
                });
                return isAudioInput && isNotVirtual;
              })
              .map(device => ({
                id: device.deviceId,
                label: device.label || 'Microphone ' + (device.deviceId || ''),
                isDefault: device.deviceId === 'default'
              }));

            // Always ensure we have a default option
            if (!audioInputs.some(mic => mic.id === 'default')) {
              audioInputs.unshift({
                id: 'default',
                label: 'System Default',
                isDefault: true
              });
            }

            console.log('Available microphones:', audioInputs);
            return audioInputs;
          } catch (error) {
            console.error('Error enumerating devices:', error);
            throw error;
          }
        })();
      `);
    }
    throw new Error('Window not available');
  } catch (error) {
    console.error('Failed to enumerate microphones:', error);
    throw new Error('Failed to load microphones: ' + error.message);
  }
});

// Add notification handler
ipcMain.on('show-notification', (_, notification) => {
  try {
    notificationService.showNotification(
      notification.title,
      notification.message,
      notification.type
    );
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}); 