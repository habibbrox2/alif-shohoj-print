const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('alifShohojPrintDesktop', {
  isDesktop: true,
  getAutoLaunch: () => ipcRenderer.invoke('desktop:auto-launch:get'),
  setAutoLaunch: enabled => ipcRenderer.invoke('desktop:auto-launch:set', enabled),
  getConnectionInfo: () => ipcRenderer.invoke('desktop:websocket:info'),
  getCustomerPwaUrl: () => ipcRenderer.invoke('desktop:customer-pwa:url'),
  publishCustomerConfig: config => ipcRenderer.invoke('desktop:customer-pwa:publish-config', config),
  getCounterStatuses: counterIds => ipcRenderer.invoke('desktop:counters:get-statuses', counterIds),
  sendCounterHeartbeat: (masterUrl, counterId) => ipcRenderer.invoke('desktop:counter:heartbeat:send', masterUrl, counterId),
  listPrinters: () => ipcRenderer.invoke('desktop:printers:list'),
  listQueue: () => ipcRenderer.invoke('desktop:queue:list'),
  saveJob: job => ipcRenderer.invoke('desktop:queue:save-job', job),
  removeJob: jobId => ipcRenderer.invoke('desktop:queue:remove-job', jobId),
  printJob: jobId => ipcRenderer.invoke('desktop:print:job', jobId),
  onIncomingJob: callback => subscribe('desktop:job:incoming', callback),
  onQueueChanged: callback => subscribe('desktop:queue:changed', callback),
});
