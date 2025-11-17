  import { app, BrowserWindow, screen } from 'electron';
  import path from 'node:path';
  import started from 'electron-squirrel-startup';

  // Handle creating/removing shortcuts on Windows when installing/uninstalling.
  if (started) {
    app.quit();
  }

  const createWindow = () => {
    // Create the browser window
    const mainWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    // Load the app first
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );
    }

    // Maximize and show the window after loading
    mainWindow.once('ready-to-show', () => {
      mainWindow.maximize();
      mainWindow.show();
    });

    // Open the DevTools in a separate window
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  };

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  app.whenReady().then(createWindow);

  // Quit when all windows are closed, except on macOS.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
