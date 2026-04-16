const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

const isDev = process.env.ELECTRON_DEV === 'true';
const VITE_DEV_URL = 'http://localhost:5173/bot-demo/';

app.setName('Scape');

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icons', 'icon.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Scape',
    icon: iconPath,
    backgroundColor: '#330033',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Remove the default menu bar (File/Edit/View etc.)
  Menu.setApplicationMenu(null);

  if (isDev) {
    win.loadURL(VITE_DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, load the built index.html from the app resources
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
