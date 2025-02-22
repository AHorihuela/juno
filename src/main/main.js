const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// First log to verify process start
console.log('[Main] Main process starting...');
console.log('[Main] Environment:', process.env.NODE_ENV);
console.log('[Main] Current working directory:', process.cwd());

// Import services after electron modules
const setupDictionaryIpcHandlers = require('./services/dictionaryIpcHandlers');

let mainWindow;

function createWindow() {
  console.log('[Main] Creating window...');
  console.log('[Main] __dirname:', __dirname);
  
  // Check if index.html exists
  const indexPath = path.join(process.cwd(), 'index.html');
  console.log('[Main] Checking for index.html at:', indexPath);
  console.log('[Main] index.html exists:', fs.existsSync(indexPath));

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: path.join(process.cwd(), 'assets/icons/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: process.env.NODE_ENV === 'production',
      devTools: process.env.NODE_ENV === 'development'
    }
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"]
      }
    });
  });

  // Log window creation success
  console.log('[Main] BrowserWindow created:', !!mainWindow);
  console.log('[Main] Window ID:', mainWindow.id);

  // Force setup handlers immediately
  console.log('[Main] Setting up handlers before loading page...');
  try {
    setupDictionaryIpcHandlers();
    console.log('[Main] Handlers setup complete. Current handlers:', ipcMain.eventNames());
  } catch (error) {
    console.error('[Main] Error setting up handlers:', error);
  }

  console.log('[Main] Loading index.html...');
  try {
    mainWindow.loadFile(indexPath);
  } catch (error) {
    console.error('[Main] Error loading index.html:', error);
  }

  // Only open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('[Main] Opening DevTools in development mode...');
    try {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      console.log('[Main] DevTools requested to open');
    } catch (error) {
      console.error('[Main] Error opening DevTools:', error);
    }
  }

  // Wait for window to be ready
  mainWindow.once('ready-to-show', () => {
    console.log('[Main] Window ready, showing window and verifying handlers...');
    mainWindow.show();
    mainWindow.focus();
    console.log('[Main] Window visible:', mainWindow.isVisible());
    console.log('[Main] DevTools visible:', mainWindow.webContents.isDevToolsOpened());
    console.log('[Main] Current IPC handlers:', ipcMain.eventNames());
  });

  // Additional window event logging
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Window content loaded');
    console.log('[Main] Document URL:', mainWindow.webContents.getURL());
    console.log('[Main] Verifying handlers after load...');
    console.log('[Main] Current IPC handlers:', ipcMain.eventNames());
  });

  mainWindow.webContents.on('devtools-opened', () => {
    console.log('[Main] DevTools opened successfully');
    mainWindow.focus();
  });

  mainWindow.webContents.on('devtools-closed', () => {
    console.log('[Main] DevTools closed');
  });

  // Debug IPC communications
  ipcMain.on('error', (event, error) => {
    console.error('[Main] IPC error:', error);
  });
}

// Wait for app to be ready
app.whenReady().then(() => {
  console.log('[Main] App ready, initializing...');
  createWindow();

  // Only retry DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
        console.log('[Main] Retrying DevTools open...');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }, 2000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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