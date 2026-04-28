const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 850,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#080810',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Start the background local server
  serverProcess = spawn('node', [path.join(__dirname, 'server.js')]);
  
  // Wait a moment for server to start, then load URL
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:7823');
  }, 1000);

  // Open links in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// Kill the background server when electron quits
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
