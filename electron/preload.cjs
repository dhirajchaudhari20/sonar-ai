// Electron Preload Bridge for Shadow AI
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shadowDesktop', {
  isDesktop: true,
  getDesktopSources: (opts) => ipcRenderer.invoke('get-desktop-sources', opts),
  toggleHudWindow: () => ipcRenderer.send('toggle-hud-window'),
  setOpacity: (opacity) => ipcRenderer.send('set-window-opacity', opacity),
  setStealthProtection: (enable) => ipcRenderer.send('set-stealth-protection', enable),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  moveWindowBy: (deltaX, deltaY) => ipcRenderer.send('move-window-by', { deltaX, deltaY }),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),
  endSession: () => ipcRenderer.send('end-session'),
  onScreenSniperTriggered: (callback) => {
    ipcRenderer.on('trigger-screen-sniper', () => callback());
  }
});
