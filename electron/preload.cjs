const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('broxprintDesktop', {
  isDesktop: true,
  getAutoLaunch: () => ipcRenderer.invoke('desktop:auto-launch:get'),
  setAutoLaunch: enabled => ipcRenderer.invoke('desktop:auto-launch:set', enabled),
  getConnectionInfo: () => ipcRenderer.invoke('desktop:websocket:info'),
  listPrinters: () => ipcRenderer.invoke('desktop:printers:list'),
  listQueue: () => ipcRenderer.invoke('desktop:queue:list'),
  saveJob: job => ipcRenderer.invoke('desktop:queue:save-job', job),
  printJob: jobId => ipcRenderer.invoke('desktop:print:job', jobId),
  onIncomingJob: callback => subscribe('desktop:job:incoming', callback),
  onQueueChanged: callback => subscribe('desktop:queue:changed', callback),
});
