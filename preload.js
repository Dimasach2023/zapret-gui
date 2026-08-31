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
  updateZapretFiles: () => ipcRenderer.invoke('update-zapret-files'),
  updateIpset: () => ipcRenderer.invoke('update-ipset'),
  updateHosts: () => ipcRenderer.invoke('update-hosts'),
  toggleAutoUpdateCheck: (v) => ipcRenderer.invoke('toggle-auto-update-check', v),
  replaceFake: (slot, sourceFile) => ipcRenderer.invoke('replace-fake', { slot, sourceFile }),
  autoPickFake: (slot) => ipcRenderer.invoke('auto-pick-fake', { slot }),
  runDiagnostics: () => ipcRenderer.invoke('run-diagnostics'),
  runTests: () => ipcRenderer.invoke('run-tests'),
  runTestsExternal: () => ipcRenderer.invoke('run-tests-external'),

  toggleCustomHosts: (v) => ipcRenderer.invoke('toggle-custom-hosts', v),
  updateCustomHosts: () => ipcRenderer.invoke('update-custom-hosts'),
  setCustomHostsUrl: (url) => ipcRenderer.invoke('set-custom-hosts-url', url),
  listLists: () => ipcRenderer.invoke('list-lists'),
  readList: (name) => ipcRenderer.invoke('read-list', name),
  saveList: (name, content) => ipcRenderer.invoke('save-list', { name, content }),

  onState: (cb) => ipcRenderer.on('state', (e, state) => cb(state)),
  onLog: (cb) => ipcRenderer.on('log-line', (e, line) => cb(line)),
  onNotify: (cb) => ipcRenderer.on('notify', (e, payload) => cb(payload)),
  onAutoPickProgress: (cb) => ipcRenderer.on('auto-pick-progress', (e, payload) => cb(payload)),
  onStrategyTestProgress: (cb) => ipcRenderer.on('strategy-test-progress', (e, payload) => cb(payload)),

  // tg-ws-proxy (Telegram)
  tgwsStart: () => ipcRenderer.invoke('tgws-start'),
  tgwsStop: () => ipcRenderer.invoke('tgws-stop'),
  tgwsSetConfig: (cfg) => ipcRenderer.invoke('tgws-set-config', cfg),
  tgwsRegenerateSecret: () => ipcRenderer.invoke('tgws-regenerate-secret'),
  tgwsToggleAutostart: (v) => ipcRenderer.invoke('tgws-toggle-autostart', v),
  tgwsToggleWinStartup: (v) => ipcRenderer.invoke('tgws-toggle-win-startup', v),
  tgwsOpenLink: () => ipcRenderer.invoke('tgws-open-link'),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
});
