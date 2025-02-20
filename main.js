const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const recorder = require('./src/main/services/recorder');

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