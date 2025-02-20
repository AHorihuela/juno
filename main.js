const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const recorder = require('./src/main/services/recorder');
const configService = require('./src/main/services/configService');

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
    });

    console.log('Loading index.html...');
    mainWindow.loadFile('index.html');

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // Setup recording event handlers
    recorder.on('start', () => {
      mainWindow.webContents.send('recording-status', true);
    });

    recorder.on('stop', () => {
      mainWindow.webContents.send('recording-status', false);
    });

    recorder.on('error', (error) => {
      mainWindow.webContents.send('recording-error', error.message);
    });

    recorder.on('transcription', (text) => {
      mainWindow.webContents.send('transcription', text);
    });

  } catch (error) {
    console.error('Error creating window:', error);
    app.quit();
  }
}

function registerShortcuts() {
  // Register F6 key for toggle (simulating Fn key)
  globalShortcut.register('F6', () => {
    const now = Date.now();
    
    if (now - lastFnKeyPress <= FN_DOUBLE_TAP_DELAY) {
      // Double tap detected
      clearTimeout(fnKeyTimeout);
      if (!recorder.isRecording()) {
        recorder.start();
      }
    } else {
      // Single tap - wait to see if it's a double tap
      fnKeyTimeout = setTimeout(() => {
        if (recorder.isRecording()) {
          recorder.stop();
        }
      }, FN_DOUBLE_TAP_DELAY);
    }
    
    lastFnKeyPress = now;
  });

  // Register Escape key to stop recording
  globalShortcut.register('Escape', () => {
    if (recorder.isRecording()) {
      recorder.stop();
    }
  });
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

  console.log('Creating window and registering shortcuts...');
  createWindow();
  registerShortcuts();
}).catch(error => {
  console.error('Error during app initialization:', error);
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (recorder.isRecording()) {
    recorder.stop();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
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
    await configService.setOpenAIApiKey(settings.openaiApiKey);
    await configService.setAITriggerWord(settings.aiTriggerWord);
    await configService.setAIModel(settings.aiModel);
    await configService.setAITemperature(settings.aiTemperature);
    await configService.setStartupBehavior(settings.startupBehavior);
    await configService.setDefaultMicrophone(settings.defaultMicrophone);
    return { success: true };
  } catch (error) {
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