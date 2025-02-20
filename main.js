const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const recorder = require('./src/main/services/recorder');
const configService = require('./src/main/services/configService');

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
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    // Load the index.html file
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
app.whenReady().then(() => {
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

// Add IPC handlers for settings
ipcMain.on('get-settings', async (event) => {
  try {
    const settings = {
      openaiApiKey: await configService.getOpenAIApiKey(),
      aiTriggerWord: await configService.getAITriggerWord(),
      aiModel: await configService.getAIModel(),
      aiTemperature: await configService.getAITemperature(),
      startupBehavior: await configService.getStartupBehavior(),
      defaultMicrophone: await configService.getDefaultMicrophone(),
    };
    event.reply('settings-loaded', settings);
  } catch (error) {
    event.reply('settings-error', error.message);
  }
});

ipcMain.on('save-settings', async (event, settings) => {
  try {
    await configService.setOpenAIApiKey(settings.openaiApiKey);
    await configService.setAITriggerWord(settings.aiTriggerWord);
    await configService.setAIModel(settings.aiModel);
    await configService.setAITemperature(settings.aiTemperature);
    await configService.setStartupBehavior(settings.startupBehavior);
    await configService.setDefaultMicrophone(settings.defaultMicrophone);
    event.reply('settings-saved');
  } catch (error) {
    event.reply('settings-error', error.message);
  }
});

ipcMain.on('get-microphones', async (event) => {
  try {
    // Get available audio input devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const microphones = devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({
        id: device.deviceId,
        label: device.label || `Microphone ${device.deviceId}`,
      }));
    event.reply('microphones-loaded', microphones);
  } catch (error) {
    event.reply('settings-error', 'Failed to load microphones: ' + error.message);
  }
}); 