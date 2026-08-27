// Sonar AI — Stealth Desktop Core (Pure Top Notch Floating HUD)
// - macOS: Invisible on Screen Share (NSWindowSharingNone) + Hidden from Dock (app.dock.hide())
// - Dynamic Auto-Resizing: Window height shrinks to 90px when compact so it NEVER blocks clicks on screen!
// - Native Microphone Permission Pre-approval

const { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, screen, session, systemPreferences } = require('electron');
const path = require('path');

app.setName('pmodule');

let hudWindow = null;

function createHudWindow() {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Start with compact height (90px) so the transparent window never intercepts clicks on other apps
  hudWindow = new BrowserWindow({
    width: 720,
    height: 90,
    minWidth: 480,
    minHeight: 60,
    x: Math.round((width - 720) / 2),
    y: 8,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    title: 'pmodule',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  // OS Stealth Flag: Excludes window from screen capture & screen share APIs
  hudWindow.setContentProtection(true);

  // Pin on top of all full-screen apps and video calls
  hudWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const DEV_URL = process.env.ELECTRON_DEV_URL || 'http://localhost:3000/#hud';
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    hudWindow.loadURL(DEV_URL).catch(() => {
      hudWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'hud' });
    });
  } else {
    hudWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'hud' }).catch(() => {
      hudWindow.loadURL(DEV_URL);
    });
  }

  hudWindow.on('closed', () => {
    hudWindow = null;
  });
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (!hudWindow) {
      createHudWindow();
    } else {
      if (hudWindow.isVisible()) {
        hudWindow.hide();
      } else {
        hudWindow.show();
        hudWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      }
    }
  });

  globalShortcut.register('Escape', () => {
    if (hudWindow && hudWindow.isVisible() && hudWindow.isFocused()) {
      hudWindow.setSize(720, 90);
    }
  });

  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (hudWindow) {
      hudWindow.setSize(720, 580);
      hudWindow.webContents.send('trigger-screen-sniper');
    }
  });
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler(() => true);
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(true));

  // Request macOS microphone access natively
  if (process.platform === 'darwin' && systemPreferences.askForMediaAccess) {
    try {
      await systemPreferences.askForMediaAccess('microphone');
    } catch (e) {
      console.warn('Microphone permission query error:', e);
    }
  }

  // Override CSP to allow network calls to Groq API
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' file: data: blob: https:; " +
          "connect-src * 'self' https://api.groq.com https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com wss: ws: http://localhost:* https:; " +
          "img-src * 'self' data: blob: https: file:; " +
          "font-src * 'self' data: https://fonts.gstatic.com;"
        ]
      }
    });
  });

  createHudWindow();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createHudWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC Handlers
ipcMain.handle('get-desktop-sources', async (event, opts) => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 1920, height: 1080 },
    fetchWindowIcons: true
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL()
  }));
});

ipcMain.on('move-window-by', (event, { deltaX, deltaY }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const [x, y] = win.getPosition();
    win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
  }
});

ipcMain.on('resize-window', (event, { width, height }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setSize(Math.max(480, Math.round(width)), Math.max(60, Math.round(height)));
  }
});

ipcMain.on('end-session', () => {
  if (hudWindow) {
    hudWindow.destroy();
    hudWindow = null;
  }
  app.quit();
});

ipcMain.on('toggle-hud-window', () => {
  if (!hudWindow) {
    createHudWindow();
  } else {
    if (hudWindow.isVisible()) hudWindow.hide();
    else {
      hudWindow.show();
      hudWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  }
});

ipcMain.on('set-window-opacity', (event, opacity) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setOpacity(opacity);
});

ipcMain.on('set-stealth-protection', (event, enable) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setContentProtection(enable);
});

ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});
