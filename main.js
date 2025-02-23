const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const recorder = require('./src/main/services/recorder');
const configService = require('./src/main/services/configService');
const trayService = require('./src/main/services/trayService');
const transcriptionHistoryService = require('./src/main/services/transcriptionHistoryService');
const notificationService = require('./src/main/services/notificationService');
const overlayService = require('./src/main/services/overlayService');
const setupDictionaryIpcHandlers = require('./src/main/services/dictionaryIpcHandlers');

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

    // Initialize tray after window creation
    trayService.initialize(mainWindow);

    // Setup recording event handlers
    const onRecordingStart = () => {
      console.log('Recording started, registering Escape key');
      // Register Escape key when recording starts
      const escSuccess = globalShortcut.register('Escape', () => {
        console.log('Escape pressed, stopping recording');
        recorder.stop();
      });
      console.log('Escape key registration success:', escSuccess);
      
      // Only send status update if window exists, but don't activate it
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('recording-status', true);
      }
      trayService.updateRecordingStatus(true);
      overlayService.show();
    };

    const onRecordingStop = () => {
      console.log('Recording stopped, unregistering Escape key');
      // Unregister Escape key when recording stops
      globalShortcut.unregister('Escape');
      
      // Only send status update if window exists, but don't activate it
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('recording-status', false);
      }
      trayService.updateRecordingStatus(false);
      overlayService.hide();
    };

    const onRecordingError = (error) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('recording-error', error.message);
      }
    };

    const onTranscription = (text) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('transcription', text);
        // Add transcription to history
        try {
          transcriptionHistoryService.addTranscription(text);
        } catch (error) {
          console.error('Failed to add transcription to history:', error);
        }
      }
    };

    // Register event handlers
    recorder.on('start', onRecordingStart);
    recorder.on('stop', onRecordingStop);
    recorder.on('error', onRecordingError);
    recorder.on('transcription', onTranscription);

    // Register IPC handlers for transcription history
    ipcMain.on('get-transcription-history', (event) => {
      try {
        const history = transcriptionHistoryService.getHistory();
        event.reply('transcription-history', history);
      } catch (error) {
        console.error('Failed to get transcription history:', error);
        event.reply('transcription-history-error', error.message);
      }
    });

    ipcMain.on('delete-transcription', (event, id) => {
      try {
        transcriptionHistoryService.deleteTranscription(id);
        const history = transcriptionHistoryService.getHistory();
        event.reply('transcription-history', history);
      } catch (error) {
        console.error('Failed to delete transcription:', error);
        event.reply('transcription-history-error', error.message);
      }
    });

    ipcMain.on('clear-transcription-history', (event) => {
      try {
        transcriptionHistoryService.clearHistory();
        event.reply('transcription-history', []);
      } catch (error) {
        console.error('Failed to clear transcription history:', error);
        event.reply('transcription-history-error', error.message);
      }
    });

    mainWindow.on('closed', () => {
      // Clean up event handlers
      recorder.removeListener('start', onRecordingStart);
      recorder.removeListener('stop', onRecordingStop);
      recorder.removeListener('error', onRecordingError);
      recorder.removeListener('transcription', onTranscription);
      
      // Ensure Escape key is unregistered
      globalShortcut.unregister('Escape');
      
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
  const shortcut = await configService.getKeyboardShortcut();
  console.log('Using keyboard shortcut:', shortcut);
  
  // Register configured shortcut for toggle
  const success = globalShortcut.register(shortcut, () => {
    console.log('Shortcut triggered');
    const now = Date.now();
    
    if (now - lastFnKeyPress <= FN_DOUBLE_TAP_DELAY) {
      // Double tap detected
      console.log('Double tap detected, starting recording');
      clearTimeout(fnKeyTimeout);
      if (!recorder.isRecording()) {
        recorder.start();
      }
    } else {
      // Single tap - wait to see if it's a double tap
      console.log('Single tap detected, waiting for potential double tap');
      fnKeyTimeout = setTimeout(() => {
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  console.log('App ready, initializing...');
  
  // Initialize config service first
  console.log('Initializing config service...');
  await configService.initializeStore();
  
  console.log('Registering IPC handlers...');
  
  // Initialize dictionary IPC handlers
  console.log('Initializing dictionary IPC handlers...');
  setupDictionaryIpcHandlers();
  
  // Register settings IPC handlers
  ipcMain.handle('get-settings', async () => {
    console.log('Handling get-settings request...');
    try {
      return {
        openaiApiKey: await configService.getOpenAIApiKey(),
        aiTriggerWord: await configService.getAITriggerWord(),
        aiModel: await configService.getAIModel(),
        aiTemperature: await configService.getAITemperature(),
        startupBehavior: await configService.getStartupBehavior(),
        defaultMicrophone: await configService.getDefaultMicrophone(),
        actionVerbs: await configService.getActionVerbs(),
        aiRules: await configService.getAIRules(),
        keyboardShortcut: await configService.getKeyboardShortcut(),
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      throw new Error(`Failed to load settings: ${error.message}`);
    }
  });

  // Add reset settings handler
  ipcMain.handle('reset-settings', async () => {
    console.log('Resetting settings to defaults...');
    try {
      await configService.resetToDefaults();
      return { success: true };
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw new Error(`Failed to reset settings: ${error.message}`);
    }
  });

  console.log('Creating window and registering shortcuts...');
  createWindow();
  registerShortcuts();
}).catch(error => {
  console.error('Error during app initialization:', error);
  app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (recorder && typeof recorder.isRecording === 'function' && recorder.isRecording()) {
    recorder.stop();
  }
  trayService.destroy();
  overlayService.destroy();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.isQuitting = true;
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
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

// Update microphone handling
ipcMain.handle('change-microphone', async (_, deviceId) => {
  try {
    // Update the recorder's device
    const success = await recorder.setDevice(deviceId);
    if (!success) {
      throw new Error('Failed to switch to selected microphone');
    }

    // Save the selection to config
    await configService.setDefaultMicrophone(deviceId);
    
    return { success: true };
  } catch (error) {
    console.error('Error changing microphone:', error);
    throw new Error(`Failed to change microphone: ${error.message}`);
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