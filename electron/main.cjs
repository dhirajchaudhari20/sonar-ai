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

  // Windows: Hide from taskbar at app level
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.sonar.ai');
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Start with compact height (105px) and 1080px width so all menu buttons fit with plenty of margin
  hudWindow = new BrowserWindow({
    width: 1080,
    height: 105,
    minWidth: 480,
    minHeight: 60,
    x: Math.round((width - 1080) / 2),
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
  // Note: setContentProtection works on macOS & Windows
  hudWindow.setContentProtection(true);

  // Pin on top of all full-screen apps and video calls
  const alwaysOnTopLevel = process.platform === 'darwin' ? 'screen-saver' : 'screen-saver';
  hudWindow.setAlwaysOnTop(true, alwaysOnTopLevel, 1);
  if (process.platform !== 'win32') {
    hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

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
  // DevTools: only open in explicit debug mode (auto-open causes chunked_data_pipe Error:-2 spam
  // in transparent Electron windows). Open manually with Ctrl+Shift+I if needed.
  // hudWindow.webContents.openDevTools({ mode: 'detach' });


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
        if (process.platform !== 'win32') {
          hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        }
      }
    }
  });

  globalShortcut.register('Escape', () => {
    if (hudWindow && hudWindow.isVisible() && hudWindow.isFocused()) {
      hudWindow.setSize(1080, 105);
    }
  });

  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (hudWindow) {
      hudWindow.setSize(1080, 580);
      hudWindow.webContents.send('trigger-screen-sniper');
    }
  });
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler(() => true);
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(true));

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
  if (!win) return;

  const safeW = Math.max(480, Math.round(width));
  const safeH = Math.max(60, Math.round(height));

  const doResize = () => {
    try {
      const display = screen.getPrimaryDisplay();
      const [, y] = win.getPosition();
      const newX = Math.round((display.workAreaSize.width - safeW) / 2);
      win.setSize(safeW, safeH, false);
      win.setBounds({ x: newX, y: Math.max(0, y), width: safeW, height: safeH }, false);
      win.setAlwaysOnTop(true, 'screen-saver', 1);
      if (process.platform !== 'win32') {
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      }
    } catch (e) {
      console.warn('[resize-window] resize failed:', e.message);
    }
  };

  // We previously disabled setContentProtection during resize to avoid a macOS transparent window glitch,
  // but this causes the window to flash on screen share (compromising stealth).
  // In modern Electron versions, we just do the resize directly.
  doResize();
});


ipcMain.on('end-session', () => {
  if (hudWindow) {
    try { hudWindow.destroy(); } catch {}
    hudWindow = null;
  }
  app.exit(0);
});

ipcMain.on('toggle-hud-window', () => {
  if (!hudWindow) {
    createHudWindow();
  } else {
    if (hudWindow.isVisible()) hudWindow.hide();
    else {
      hudWindow.show();
      hudWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      if (process.platform !== 'win32') {
        hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      }
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
  if (win) {
    try { win.destroy(); } catch {}
  }
  app.exit(0);
});
