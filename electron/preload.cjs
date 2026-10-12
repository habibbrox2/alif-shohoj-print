const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('alifShohojPrintDesktop', {
  isDesktop: true,
  getAppSettings: () => ipcRenderer.invoke('desktop:settings:get'),
  saveAppSettings: settings => ipcRenderer.invoke('desktop:settings:save', settings),
  getAutoLaunch: () => ipcRenderer.invoke('desktop:auto-launch:get'),
  setAutoLaunch: enabled => ipcRenderer.invoke('desktop:auto-launch:set', enabled),
  getCloseToTray: () => ipcRenderer.invoke('desktop:window:close-to-tray:get'),
  setCloseToTray: enabled => ipcRenderer.invoke('desktop:window:close-to-tray:set', enabled),
  getConnectionInfo: () => ipcRenderer.invoke('desktop:websocket:info'),
  getCustomerPwaUrl: () => ipcRenderer.invoke('desktop:customer-pwa:url'),
  publishCustomerConfig: config => ipcRenderer.invoke('desktop:customer-pwa:publish-config', config),
  notifyPrinterStatus: (printerName, isOnline) => ipcRenderer.invoke('desktop:printer:notify-status', printerName, isOnline),
  getCounterStatuses: counterIds => ipcRenderer.invoke('desktop:counters:get-statuses', counterIds),
  sendCounterHeartbeat: (masterUrl, counterId) => ipcRenderer.invoke('desktop:counter:heartbeat:send', masterUrl, counterId),
  getCounterFeedKey: counterId => ipcRenderer.invoke('desktop:counters:feed-key:get', counterId),
  rotateCounterFeedKey: counterId => ipcRenderer.invoke('desktop:counters:feed-key:rotate', counterId),
  revokeCounterFeedKey: counterId => ipcRenderer.invoke('desktop:counters:feed-key:revoke', counterId),
  getCounterFeedStatus: () => ipcRenderer.invoke('desktop:counter:feed:status'),
  setCounterFeedKey: key => ipcRenderer.invoke('desktop:counter:feed:secret:set', key),
  clearCounterFeedKey: () => ipcRenderer.invoke('desktop:counter:feed:secret:clear'),
  pullCounterOrders: (masterUrl, counterId, since) => ipcRenderer.invoke('desktop:counter:feed:pull', masterUrl, counterId, since),
  startCounterFeedWs: (masterUrl, counterId) => ipcRenderer.invoke('desktop:counter:feed:ws:start', masterUrl, counterId),
  stopCounterFeedWs: () => ipcRenderer.invoke('desktop:counter:feed:ws:stop'),
  onCounterFeedUpdate: callback => subscribe('desktop:counter:feed:update', callback),
  listPrinters: () => ipcRenderer.invoke('desktop:printers:list'),
  listQueue: () => ipcRenderer.invoke('desktop:queue:list'),
  saveJob: job => ipcRenderer.invoke('desktop:queue:save-job', job),
  removeJob: jobId => ipcRenderer.invoke('desktop:queue:remove-job', jobId),
  printJob: jobId => ipcRenderer.invoke('desktop:print:job', jobId),
  setTrayShopName: name => ipcRenderer.invoke('desktop:tray:set-shop-name', name),
  openAuxiliaryWindow: (target, page) => ipcRenderer.invoke('desktop:window:open-aux', target, page),
  onAuxNavigate: callback => subscribe('desktop:aux:navigate', callback),
  onAppSettingsChanged: callback => subscribe('desktop:settings:changed', callback),
  onIncomingJob: callback => subscribe('desktop:job:incoming', callback),
  onQueueChanged: callback => subscribe('desktop:queue:changed', callback),
  onTrayAction: callback => subscribe('desktop:tray:action', callback),
  openFileDialog: (options?: { filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] }) => ipcRenderer.invoke('desktop:dialog:open-file', options),
});
