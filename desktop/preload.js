const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dexor', {
  getState: () => ipcRenderer.invoke('state:get'),
  getCatalog: () => ipcRenderer.invoke('catalog:get'),
  installMacro: (id) => ipcRenderer.invoke('macro:install', id),
  saveMacro: (macro) => ipcRenderer.invoke('macro:save', macro),
  deleteMacro: (id) => ipcRenderer.invoke('macro:delete', id),
  runMacro: (id) => ipcRenderer.invoke('macro:run', id),
  stopMacro: () => ipcRenderer.invoke('macro:stop'),
  captureScreen: () => ipcRenderer.invoke('screen:capture'),
  openGame: (game) => ipcRenderer.invoke('game:open', game),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  chooseFortnite: () => ipcRenderer.invoke('game:choose-fortnite'),
  toggleClicker: () => ipcRenderer.invoke('clicker:toggle'),
  clickerConfig: (config) => ipcRenderer.invoke('clicker:config', config),
  onClickerCount: (callback) => {
    const listener = (_event, count) => callback(count);
    ipcRenderer.on('clicker:count', listener);
    return () => ipcRenderer.removeListener('clicker:count', listener);
  },
  onStatus: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('status', listener);
    return () => ipcRenderer.removeListener('status', listener);
  }
});
