const strategySelect = document.getElementById('strategySelect');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const logEl = document.getElementById('log');
const gameFilterEl = document.getElementById('gameFilter');
const chkAutostartApp = document.getElementById('chkAutostartApp');
const chkAutostartWinws = document.getElementById('chkAutostartWinws');
const chkAutoUpdateCheck = document.getElementById('chkAutoUpdateCheck');
const svcStateEl = document.getElementById('svcState');
const wdStateEl = document.getElementById('wdState');
const ipsetPillEl = document.getElementById('ipsetPill');
const versionHintEl = document.getElementById('versionHint');
const fakeDiscordSelect = document.getElementById('fakeDiscordSelect');
const fakeGameSelect = document.getElementById('fakeGameSelect');
const customHostsPillEl = document.getElementById('customHostsPill');

let strategiesLoaded = false;
let binFilesLoaded = false;

// ---------- toast notifications ----------
const toastsEl = document.getElementById('toasts');
const TOAST_ICONS = { success: '✓', error: '✕', info: 'i' };

function showToast({ type = 'info', text }) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || 'i'}</span>
    <span class="toast-text"></span>
    <button class="toast-close" title="Закрыть">✕</button>
  `;
  el.querySelector('.toast-text').textContent = text;
  const remove = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 180);
  };
  el.querySelector('.toast-close').addEventListener('click', remove);
  const timer = setTimeout(remove, 5000);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  toastsEl.appendChild(el);
}

// оборачивает клик по кнопке: блокирует её и показывает спиннер, пока идёт
// async-действие в main-процессе — иначе непонятно, сработало ли что-то,
// не глядя в журнал.
function bindAsyncButton(id, handler) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.classList.add('loading');
    btn.disabled = true;
    try {
      await handler();
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const name = tab.dataset.tab;
    document.querySelectorAll('.tab-panel').forEach((p) => {
      p.classList.toggle('hidden', p.dataset.panel !== name);
    });
    if (name === 'lists') refreshListFiles();
  });
});

const SERVICE_LABELS = {
  RUNNING: 'работает',
  STOPPED: 'остановлена',
  NOT_INSTALLED: 'не установлена',
  UNKNOWN: 'неизвестно',
  START_PENDING: 'запускается',
  STOP_PENDING: 'останавливается',
  CONTINUE_PENDING: 'возобновляется',
  PAUSE_PENDING: 'приостанавливается',
  PAUSED: 'приостановлена',
};

function renderState(state) {
  if (!strategiesLoaded) {
    strategySelect.innerHTML = '';
    for (const s of state.strategies) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      strategySelect.appendChild(opt);
    }
    strategiesLoaded = true;
  }
  strategySelect.value = state.strategyId;

  document.querySelectorAll('.seg').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.gameFilterMode);
  });

  chkAutostartApp.checked = !!state.autostartApp;
  chkAutostartWinws.checked = !!state.autostartWinws;
  chkAutoUpdateCheck.checked = !!state.autoUpdateCheck;

  statusDot.classList.toggle('on', state.running);
  statusDot.classList.toggle('off', !state.running);
  statusText.textContent = state.running
    ? (state.managedByUs ? 'Работает' : 'Работает (запущено вне GUI)')
    : 'Остановлено';

  document.getElementById('btnStart').disabled = state.running;
  document.getElementById('btnStop').disabled = !state.running;

  svcStateEl.textContent = SERVICE_LABELS[state.serviceState] || state.serviceState;
  wdStateEl.textContent = SERVICE_LABELS[state.windivertState] || state.windivertState;

  ipsetPillEl.textContent = state.ipsetStatus;
  ipsetPillEl.className = 'pill ' + state.ipsetStatus;

  customHostsPillEl.textContent = state.customHostsApplied ? 'добавлено' : 'не добавлено';
  customHostsPillEl.className = 'pill ' + (state.customHostsApplied ? 'applied' : 'notapplied');

  versionHintEl.textContent = `Локальная версия: ${state.localVersion}`;
  document.getElementById('footerVersion').textContent = `zapret ${state.localVersion}`;

  if (!binFilesLoaded && state.binFiles && state.binFiles.length) {
    for (const sel of [fakeDiscordSelect, fakeGameSelect]) {
      sel.innerHTML = '';
      for (const f of state.binFiles) {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        sel.appendChild(opt);
      }
    }
    // выставляем реально применённый файл (хранится в config.json) ОДИН РАЗ, при первой
    // загрузке. Дальше это поле больше никогда не трогается автоматически (в т.ч. по
    // setInterval-опросу раз в 3 сек) — иначе несохранённый выбор пользователя затирается.
    if (state.activeFakeDiscord && [...fakeDiscordSelect.options].some((o) => o.value === state.activeFakeDiscord)) {
      fakeDiscordSelect.value = state.activeFakeDiscord;
    }
    if (state.activeFakeGame && [...fakeGameSelect.options].some((o) => o.value === state.activeFakeGame)) {
      fakeGameSelect.value = state.activeFakeGame;
    }
    binFilesLoaded = true;
  }
}

function appendLog(line) {
  logEl.textContent += line;
  logEl.scrollTop = logEl.scrollHeight;
}

// ---------- main tab ----------
document.getElementById('btnStart').addEventListener('click', () => window.api.start());
document.getElementById('btnStop').addEventListener('click', () => window.api.stop());
document.getElementById('btnClearLog').addEventListener('click', () => (logEl.textContent = ''));

strategySelect.addEventListener('change', (e) => window.api.selectStrategy(e.target.value));

gameFilterEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg');
  if (!btn) return;
  window.api.setGameFilter(btn.dataset.mode);
});

chkAutostartApp.addEventListener('change', (e) => window.api.toggleAutostartApp(e.target.checked));
chkAutostartWinws.addEventListener('change', (e) => window.api.toggleAutostartWinws(e.target.checked));

// ---------- advanced tab ----------
bindAsyncButton('btnSvcInstall', () => window.api.serviceInstall());
bindAsyncButton('btnSvcRemove', () => window.api.serviceRemove());
bindAsyncButton('btnIpsetCycle', () => window.api.ipsetCycle());
bindAsyncButton('btnUpdateIpset', () => window.api.updateIpset());
bindAsyncButton('btnCheckUpdates', () => window.api.checkUpdates());
bindAsyncButton('btnUpdateZapret', () => window.api.updateZapretFiles());
bindAsyncButton('btnUpdateHosts', () => window.api.updateHosts());
chkAutoUpdateCheck.addEventListener('change', (e) => window.api.toggleAutoUpdateCheck(e.target.checked));
bindAsyncButton('btnApplyDiscordFake', () => window.api.replaceFake('discord', fakeDiscordSelect.value));
bindAsyncButton('btnApplyGameFake', () => window.api.replaceFake('game', fakeGameSelect.value));
bindAsyncButton('btnAutoPickDiscord', async () => {
  const res = await window.api.autoPickFake('discord', document.getElementById('probeHost').value, document.getElementById('probePort').value);
  if (res && res.file) fakeDiscordSelect.value = res.file;
});
bindAsyncButton('btnAutoPickGame', async () => {
  const res = await window.api.autoPickFake('game', document.getElementById('probeHost').value, document.getElementById('probePort').value);
  if (res && res.file) fakeGameSelect.value = res.file;
});
bindAsyncButton('btnDiagnostics', () => window.api.runDiagnostics());
bindAsyncButton('btnRunTests', () => window.api.runTests());
bindAsyncButton('btnUseCustomHosts', () => window.api.toggleCustomHosts(true));
bindAsyncButton('btnRemoveCustomHosts', () => window.api.toggleCustomHosts(false));

window.api.onState(renderState);
window.api.onLog(appendLog);
window.api.onNotify(showToast);
window.api.onAutoPickProgress(({ slot, index, total, file, status, ms }) => {
  const el = document.getElementById(slot === 'discord' ? 'progressDiscord' : 'progressGame');
  if (!el) return;
  el.className = 'progress-line' + (status === 'ok' ? ' ok' : status === 'fail' ? ' fail' : '');
  if (status === 'testing') el.textContent = `Тестирую ${index}/${total}: ${file}...`;
  else if (status === 'ok') el.textContent = `✓ ${index}/${total}: ${file} — ${ms} мс`;
  else if (status === 'fail') el.textContent = `✕ ${index}/${total}: ${file} — недоступно`;
});

window.api.requestState().then(renderState);
setInterval(() => window.api.requestState().then(renderState), 3000);

// ---------- редактор списков (list-general, list-exclude и т.д.) ----------
const listFileSelect = document.getElementById('listFileSelect');
const listFileInfo = document.getElementById('listFileInfo');
const listEditor = document.getElementById('listEditor');
const listDirtyMark = document.getElementById('listDirtyMark');
const btnSaveList = document.getElementById('btnSaveList');
const btnReloadList = document.getElementById('btnReloadList');
const btnRefreshLists = document.getElementById('btnRefreshLists');

let listFilesCache = [];
let currentListName = null;
let currentListOriginal = '';
let listDirty = false;

function setListDirty(v) {
  listDirty = v;
  listDirtyMark.classList.toggle('hidden', !v);
  if (v) listDirtyMark.classList.add('dirty');
}

function fillListInfo() {
  const meta = listFilesCache.find((f) => f.name === currentListName);
  listFileInfo.textContent = meta ? `${meta.lines} строк, ${meta.size} байт` : '';
}

async function refreshListFiles(preserveSelection = true) {
  const prev = currentListName;
  listFilesCache = await window.api.listLists();
  listFileSelect.innerHTML = '';
  for (const f of listFilesCache) {
    const opt = document.createElement('option');
    opt.value = f.name;
    opt.textContent = f.name;
    listFileSelect.appendChild(opt);
  }
  if (listFilesCache.length === 0) {
    listEditor.value = '';
    listEditor.disabled = true;
    listFileInfo.textContent = 'Файлы списков не найдены.';
    currentListName = null;
    return;
  }
  listEditor.disabled = false;
  const toSelect = preserveSelection && prev && listFilesCache.some((f) => f.name === prev) ? prev : listFilesCache[0].name;
  listFileSelect.value = toSelect;
  await loadListIntoEditor(toSelect);
}

async function loadListIntoEditor(name) {
  const res = await window.api.readList(name);
  if (!res.ok) {
    showToast({ type: 'error', text: `Не удалось открыть «${name}»: ${res.error}` });
    return;
  }
  currentListName = name;
  currentListOriginal = res.content;
  listEditor.value = res.content;
  setListDirty(false);
  fillListInfo();
}

function confirmDiscardIfDirty() {
  if (!listDirty) return true;
  return window.confirm('Есть несохранённые изменения в текущем списке. Отменить их?');
}

listFileSelect.addEventListener('change', async (e) => {
  const next = e.target.value;
  if (!confirmDiscardIfDirty()) {
    listFileSelect.value = currentListName;
    return;
  }
  await loadListIntoEditor(next);
});

listEditor.addEventListener('input', () => {
  setListDirty(listEditor.value !== currentListOriginal);
});

btnRefreshLists.addEventListener('click', () => {
  if (!confirmDiscardIfDirty()) return;
  refreshListFiles();
});

bindAsyncButton('btnSaveList', async () => {
  if (!currentListName) return;
  const res = await window.api.saveList(currentListName, listEditor.value);
  if (res.ok) {
    currentListOriginal = listEditor.value;
    setListDirty(false);
    await refreshListFiles(true);
  }
});

btnReloadList.addEventListener('click', async () => {
  if (!currentListName) return;
  if (listDirty && !window.confirm('Отменить несохранённые изменения и загрузить файл заново с диска?')) return;
  await loadListIntoEditor(currentListName);
});
