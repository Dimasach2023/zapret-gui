const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  requestState: () => ipcRenderer.invoke('request-state'),
  selectStrategy: (id) => ipcRenderer.invoke('select-strategy', id),
  setGameFilter: (mode) => ipcRenderer.invoke('set-game-filter', mode),
  start: () => ipcRenderer.invoke('start'),
  stop: () => ipcRenderer.invoke('stop'),
  toggleAutostartApp: (v) => ipcRenderer.invoke('toggle-autostart-app', v),
  toggleAutostartWinws: (v) => ipcRenderer.invoke('toggle-autostart-winws', v),

  serviceInstall: () => ipcRenderer.invoke('service-install'),
  serviceRemove: () => ipcRenderer.invoke('service-remove'),
  ipsetCycle: () => ipcRenderer.invoke('ipset-cycle'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  updateIpset: () => ipcRenderer.invoke('update-ipset'),
  updateHosts: () => ipcRenderer.invoke('update-hosts'),
  toggleAutoUpdateCheck: (v) => ipcRenderer.invoke('toggle-auto-update-check', v),
  replaceFake: (slot, sourceFile) => ipcRenderer.invoke('replace-fake', { slot, sourceFile }),
  autoPickFake: (slot, host, port) => ipcRenderer.invoke('auto-pick-fake', { slot, host, port }),
  runDiagnostics: () => ipcRenderer.invoke('run-diagnostics'),
  runTests: () => ipcRenderer.invoke('run-tests'),

  toggleCustomHosts: (v) => ipcRenderer.invoke('toggle-custom-hosts', v),
  listLists: () => ipcRenderer.invoke('list-lists'),
  readList: (name) => ipcRenderer.invoke('read-list', name),
  saveList: (name, content) => ipcRenderer.invoke('save-list', { name, content }),

  onState: (cb) => ipcRenderer.on('state', (e, state) => cb(state)),
  onLog: (cb) => ipcRenderer.on('log-line', (e, line) => cb(line)),
  onNotify: (cb) => ipcRenderer.on('notify', (e, payload) => cb(payload)),
  onAutoPickProgress: (cb) => ipcRenderer.on('auto-pick-progress', (e, payload) => cb(payload)),
});
