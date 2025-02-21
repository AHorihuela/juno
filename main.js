const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const recorder = require('./src/main/services/recorder');
const configService = require('./src/main/services/configService');
const trayService = require('./src/main/services/trayService');
const transcriptionHistoryService = require('./src/main/services/transcriptionHistoryService');

console.log('Main process starting...');

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
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      show: false, // Don't show window initially
    });

    console.log('Loading index.html...');
    mainWindow.loadFile('index.html');

    // Show window when ready to show
    mainWindow.once('ready-to-show', () => {
      console.log('Window ready to show');
      mainWindow.show();
    });

    // Initialize tray after window creation
    trayService.initialize(mainWindow);

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }

    // Setup recording event handlers
    const onRecordingStart = () => {
      console.log('Recording started, registering Escape key');
      // Register Escape key when recording starts
      const escSuccess = globalShortcut.register('Escape', () => {
        console.log('Escape pressed, stopping recording');
        recorder.stop();
      });
      console.log('Escape key registration success:', escSuccess);
      
      if (mainWindow) {
        mainWindow.webContents.send('recording-status', true);
      }
      trayService.updateRecordingStatus(true);
    };

    const onRecordingStop = () => {
      console.log('Recording stopped, unregistering Escape key');
      // Unregister Escape key when recording stops
      globalShortcut.unregister('Escape');
      
      if (mainWindow) {
        mainWindow.webContents.send('recording-status', false);
      }
      trayService.updateRecordingStatus(false);
    };

    const onRecordingError = (error) => {
      if (mainWindow) {
        mainWindow.webContents.send('recording-error', error.message);
      }
    };

    const onTranscription = (text) => {
      if (mainWindow) {
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

function registerShortcuts() {
  console.log('Registering shortcuts...');
  
  // Register Command+Shift+Space for toggle (instead of F6)
  const success = globalShortcut.register('CommandOrControl+Shift+Space', () => {
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

  console.log('Command+Shift+Space registration success:', success);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  console.log('App ready, initializing...');
  
  // Initialize config service first
  console.log('Initializing config service...');
  await configService.initializeStore();
  
  console.log('Registering IPC handlers...');
  // Register IPC handlers before creating window
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
  if (recorder.isRecording()) {
    recorder.stop();
  }
  trayService.destroy();
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

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('error', error.message);
  }
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
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    throw new Error(`Failed to save settings: ${error.message}`);
  }
});

// Update microphone handling
ipcMain.handle('get-microphones', async () => {
  try {
    // Use electron's desktopCapturer to get audio sources
    const sources = await require('electron').desktopCapturer.getSources({
      types: ['audio'],
      thumbnailSize: { width: 0, height: 0 }
    });
    
    return sources.map(source => ({
      id: source.id,
      label: source.name
    }));
  } catch (error) {
    throw new Error('Failed to load microphones: ' + error.message);
  }
}); 