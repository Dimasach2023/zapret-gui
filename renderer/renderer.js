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
const customHostsInfoEl = document.getElementById('customHostsInfo');
const tgwsPillEl = document.getElementById('tgwsPill');
const chkTgwsAutostart = document.getElementById('chkTgwsAutostart');
const chkTgwsWinStartup = document.getElementById('chkTgwsWinStartup');
const tgwsHostEl = document.getElementById('tgwsHost');
const tgwsPortEl = document.getElementById('tgwsPort');
const tgwsSecretEl = document.getElementById('tgwsSecret');
const tgwsFakeTlsEl = document.getElementById('tgwsFakeTls');
const chkTgwsNoCfproxy = document.getElementById('chkTgwsNoCfproxy');
const tgwsLinkEl = document.getElementById('tgwsLink');
let tgwsSettingsLoaded = false;
const dnsPillEl = document.getElementById('dnsPill');
const dnsPrimaryInput = document.getElementById('dnsPrimaryInput');
const dnsSecondaryInput = document.getElementById('dnsSecondaryInput');
let dnsSettingsLoaded = false;

let strategiesLoaded = false;
let binFilesLoaded = false;

// Небольшой helper для безопасной вставки текста внутрь innerHTML-разметки.
// Сейчас имена стратегий/файлов приходят из локальных доверенных данных
// (strategies.json, список .bin-файлов рядом с winws.exe), но экранирование
// на всякий случай — на будущее и просто хорошая практика при сборке HTML
// из шаблонных строк.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
function bindAsyncButton(id, handler, groupIds) {
  const btn = document.getElementById(id);
  if (!btn) return;
  // groupIds — id других кнопок, которые управляют тем же общим ресурсом
  // (winws.exe): пока одна из группы выполняется, остальные блокируются
  // визуально, а не только на бэкенде (там уже есть свой guard, но здесь
  // приятнее сразу показать, что кнопка недоступна, а не ждать тост-ошибку).
  const group = (groupIds || []).map((gid) => document.getElementById(gid)).filter(Boolean);
  btn.addEventListener('click', async () => {
    btn.classList.add('loading');
    btn.disabled = true;
    group.forEach((b) => (b.disabled = true));
    try {
      await handler();
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
      group.forEach((b) => (b.disabled = false));
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

  document.getElementById('btnStart').disabled = state.running || !!state.winwsBusy;
  document.getElementById('btnStop').disabled = !state.running || !!state.winwsBusy;
  strategySelect.disabled = !!state.winwsBusy;
  document.getElementById('btnSvcInstall').disabled = !!state.winwsBusy;
  document.getElementById('btnSvcRemove').disabled = !!state.winwsBusy;
  document.getElementById('btnApplyDiscordFake').disabled = !!state.winwsBusy;
  document.getElementById('btnApplyGameFake').disabled = !!state.winwsBusy;
  gameFilterEl.querySelectorAll('.seg').forEach((btn) => {
    btn.disabled = !!state.winwsBusy;
  });

  svcStateEl.textContent = SERVICE_LABELS[state.serviceState] || state.serviceState;
  wdStateEl.textContent = SERVICE_LABELS[state.windivertState] || state.windivertState;

  ipsetPillEl.textContent = state.ipsetStatus;
  ipsetPillEl.className = 'pill ' + state.ipsetStatus;

  customHostsPillEl.textContent = state.customHostsApplied ? 'добавлено' : 'не добавлено';
  customHostsPillEl.className = 'pill ' + (state.customHostsApplied ? 'applied' : 'notapplied');

  const cachedAt = state.customHostsCachedAt ? new Date(state.customHostsCachedAt).toLocaleString() : null;
  customHostsInfoEl.textContent = `Строк в списке: ${state.customHostsLinesCount ?? 0}` +
    (cachedAt ? ` · последняя загрузка из репозитория: ${cachedAt}` : ' · список ещё ни разу не загружался из репозитория');

  dnsPillEl.textContent = state.dnsEnabled ? 'включён' : 'выключен';
  dnsPillEl.className = 'pill ' + (state.dnsEnabled ? 'applied' : 'notapplied');
  document.getElementById('btnDnsEnable').disabled = !!state.dnsEnabled;
  document.getElementById('btnDnsDisable').disabled = !state.dnsEnabled;
  // поля с адресами заполняем один раз, чтобы не затирать то, что человек сейчас печатает
  if (!dnsSettingsLoaded) {
    dnsPrimaryInput.value = state.dnsPrimary || '9.9.9.9';
    dnsSecondaryInput.value = state.dnsSecondary || '';
    dnsSettingsLoaded = true;
  }

  const dnsDohPillEl = document.getElementById('dnsDohPill');
  const dnsDohHintEl = document.getElementById('dnsDohHint');
  if (!state.dnsEnabled) {
    dnsDohPillEl.textContent = '—';
    dnsDohPillEl.className = 'pill';
    dnsDohHintEl.textContent = '';
  } else if (state.dohActive) {
    dnsDohPillEl.textContent = 'активен';
    dnsDohPillEl.className = 'pill applied';
    dnsDohHintEl.textContent = 'DNS-запросы шифруются (DNS поверх HTTPS) — защита от перехвата DNS.';
  } else {
    dnsDohPillEl.textContent = 'недоступен';
    dnsDohPillEl.className = 'pill notapplied';
    dnsDohHintEl.textContent = 'Не удалось включить DoH для этого DNS-адреса (сервер не поддерживает или недоступен) — DNS работает без шифрования.';
  }

  versionHintEl.textContent = `Локальная версия: ${state.localVersion}`;
  document.getElementById('footerVersion').textContent = `zapret ${state.localVersion}`;

  if (!binFilesLoaded && state.binFiles && state.binFiles.length) {
    // ACTIVE_DISCORD_UDP.bin / ACTIVE_GAME_UDP.bin — это файлы-НАЗНАЧЕНИЯ, в
    // которые копируется выбранный кандидат, а не сами кандидаты. Раньше они
    // тоже попадали в список выбора: можно было выбрать, например,
    // ACTIVE_DISCORD_UDP.bin как «источник» и нажать «Применить», скопировав
    // файл сам в себя (в лучшем случае — бесполезное действие, в худшем —
    // риск повреждения файла при копировании «на себя»). Исключаем оба
    // ACTIVE_*.bin из списка выбора — как уже сделано для автоподбора.
    const selectableBinFiles = state.binFiles.filter(
      (f) => f !== 'ACTIVE_DISCORD_UDP.bin' && f !== 'ACTIVE_GAME_UDP.bin'
    );
    for (const sel of [fakeDiscordSelect, fakeGameSelect]) {
      sel.innerHTML = '';
      for (const f of selectableBinFiles) {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        sel.appendChild(opt);
      }
    }
    // выставляем реально применённый файл (хранится в config.json) ОДИН РАЗ, при первой
    // загрузке. Дальше это поле больше никогда не трогается автоматически (в т.ч. по
    // setInterval-опросу раз в 3 сек) — иначе несохранённый выбор пользователя затирается.
    // Если в конфиге ещё стоит значение по умолчанию (сам ACTIVE_*.bin — то есть
    // пользователь ещё ни разу явно не выбирал источник), оно не найдётся среди
    // отфильтрованных опций, и просто останется первый файл списка — это ожидаемо.
    if (state.activeFakeDiscord && [...fakeDiscordSelect.options].some((o) => o.value === state.activeFakeDiscord)) {
      fakeDiscordSelect.value = state.activeFakeDiscord;
    }
    if (state.activeFakeGame && [...fakeGameSelect.options].some((o) => o.value === state.activeFakeGame)) {
      fakeGameSelect.value = state.activeFakeGame;
    }
    binFilesLoaded = true;
  }

  if (state.tgws) {
    const t = state.tgws;
    tgwsPillEl.textContent = t.running ? (t.managedByUs ? 'работает' : 'работает (вне GUI)') : (t.installed ? 'остановлен' : 'не собран');
    tgwsPillEl.className = 'pill ' + (t.running ? 'loaded' : t.installed ? 'notapplied' : 'any');
    document.getElementById('btnTgwsStart').disabled = t.running;
    document.getElementById('btnTgwsStop').disabled = !t.running;
    chkTgwsAutostart.checked = !!t.autostart;
    chkTgwsWinStartup.checked = !!t.winStartup;
    tgwsLinkEl.value = t.link || '';
    // поля настроек заполняем один раз, чтобы не затирать то, что человек сейчас печатает
    if (!tgwsSettingsLoaded) {
      tgwsHostEl.value = t.host || '127.0.0.1';
      tgwsPortEl.value = t.port || 1443;
      tgwsSecretEl.value = t.secret || '';
      tgwsFakeTlsEl.value = t.fakeTlsDomain || '';
      chkTgwsNoCfproxy.checked = !!t.noCfproxy;
      tgwsSettingsLoaded = true;
    } else {
      tgwsSecretEl.value = t.secret || '';
    }
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
bindAsyncButton('btnUpdateZapret', () => window.api.updateZapretFiles());
bindAsyncButton('btnUpdateHosts', () => window.api.updateHosts());
chkAutoUpdateCheck.addEventListener('change', (e) => window.api.toggleAutoUpdateCheck(e.target.checked));
bindAsyncButton('btnApplyDiscordFake', () => window.api.replaceFake('discord', fakeDiscordSelect.value));
bindAsyncButton('btnApplyGameFake', () => window.api.replaceFake('game', fakeGameSelect.value));
bindAsyncButton('btnAutoPickDiscord', async () => {
  document.getElementById('autoPickResultsDiscord').innerHTML = '';
  const res = await window.api.autoPickFake('discord');
  if (res && res.best) fakeDiscordSelect.value = res.best; // только подставляем в список — не применяем
  renderAutoPickResults('discord', res);
}, ['btnAutoPickGame', 'btnRunTests']);
bindAsyncButton('btnAutoPickGame', async () => {
  document.getElementById('autoPickResultsGame').innerHTML = '';
  const res = await window.api.autoPickFake('game');
  if (res && res.best) fakeGameSelect.value = res.best; // только подставляем в список — не применяем
  renderAutoPickResults('game', res);
}, ['btnAutoPickDiscord', 'btnRunTests']);
bindAsyncButton('btnDiagnostics', () => window.api.runDiagnostics());
bindAsyncButton('btnRunTests', async () => {
  document.getElementById('strategyTestResults').innerHTML = '';
  strategyTestBestName = '';
  // Rendering is driven by the final strategy-test event, which contains the
  // exact analytics emitted by the original PowerShell tester. Do not render
  // the returned simplified array here, otherwise the authoritative stats
  // would be overwritten by derived values.
  await window.api.runTests();
}, ['btnAutoPickDiscord', 'btnAutoPickGame']);
bindAsyncButton('btnRunTestsExternal', () => window.api.runTestsExternal());
bindAsyncButton('btnUseCustomHosts', () => window.api.toggleCustomHosts(true));
bindAsyncButton('btnRemoveCustomHosts', () => window.api.toggleCustomHosts(false));
bindAsyncButton('btnUpdateCustomHosts', () => window.api.updateCustomHosts());

// ---------- DNS tab ----------
bindAsyncButton('btnDnsEnable', () => window.api.toggleDns(true), ['btnDnsDisable']);
bindAsyncButton('btnDnsDisable', () => window.api.toggleDns(false), ['btnDnsEnable']);
bindAsyncButton('btnDnsSave', () => window.api.setDnsServers(dnsPrimaryInput.value, dnsSecondaryInput.value));

document.querySelectorAll('.dns-preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    dnsPrimaryInput.value = btn.dataset.primary || '';
    dnsSecondaryInput.value = btn.dataset.secondary || '';
  });
});

// ---------- Telegram (tg-ws-proxy) tab ----------
bindAsyncButton('btnTgwsStart', () => window.api.tgwsStart());
bindAsyncButton('btnTgwsStop', () => window.api.tgwsStop());
chkTgwsAutostart.addEventListener('change', (e) => window.api.tgwsToggleAutostart(e.target.checked));
chkTgwsWinStartup.addEventListener('change', (e) => window.api.tgwsToggleWinStartup(e.target.checked));
bindAsyncButton('btnTgwsSaveConfig', () =>
  window.api.tgwsSetConfig({
    host: tgwsHostEl.value,
    port: tgwsPortEl.value,
    fakeTlsDomain: tgwsFakeTlsEl.value,
    noCfproxy: chkTgwsNoCfproxy.checked,
  })
);
bindAsyncButton('btnTgwsRegenSecret', () => window.api.tgwsRegenerateSecret());
document.getElementById('btnTgwsCopySecret').addEventListener('click', () => {
  if (tgwsSecretEl.value) window.api.copyText(tgwsSecretEl.value);
  showToast({ type: 'info', text: 'Секрет скопирован.' });
});
document.getElementById('btnTgwsCopyLink').addEventListener('click', () => {
  if (!tgwsLinkEl.value) return;
  window.api.copyText(tgwsLinkEl.value);
  showToast({ type: 'info', text: 'Ссылка скопирована.' });
});
bindAsyncButton('btnTgwsOpenLink', () => window.api.tgwsOpenLink());

window.api.onState(renderState);
window.api.onLog(appendLog);
window.api.onNotify(showToast);
window.api.onAutoPickProgress(({ slot, index, total, file, status, ms, stats, best }) => {
  const el = document.getElementById(slot === 'discord' ? 'progressDiscord' : 'progressGame');
  if (!el) return;
  el.className = 'progress-line' + (status === 'ok' ? ' ok' : status === 'fail' ? ' fail' : '');
  if (status === 'testing') el.textContent = `Тестирую ${index}/${total}: ${file}...`;
  else if (status === 'ok') {
    const suffix = stats ? ` — OK ${stats.OK ?? 0}, ERR ${stats.ERROR ?? 0}, UNSUP ${stats.UNSUP ?? 0}, Ping ${stats.PingOK ?? 0}/${(stats.PingOK ?? 0) + (stats.PingFail ?? 0)}` : '';
    el.textContent = `✓ ${index}/${total}: ${file}${suffix}`;
  } else if (status === 'fail') {
    el.textContent = `✕ ${index}/${total}: ${file} — ошибка запуска/теста`;
  } else if (status === 'finished') {
    el.textContent = best ? `Готово. Лучший вариант: ${best} — выберите и нажмите «Применить».` : 'Готово. Ни один файл не получил положительного результата.';
  }
});

// Автоподбор fake теперь использует тот же полноценный PowerShell-тестер,
// что и тест стратегий: один и тот же targets.txt, HTTP/TLS/ping, параллельные
// проверки и оригинальный $analytics. В таблице показываем именно эти реальные
// значения, без отдельной эвристики Node.js.
function renderAutoPickResults(slot, res) {
  const el = document.getElementById(slot === 'discord' ? 'autoPickResultsDiscord' : 'autoPickResultsGame');
  const select = slot === 'discord' ? fakeDiscordSelect : fakeGameSelect;
  if (!el) return;
  if (!res || !Array.isArray(res.results) || res.results.length === 0) {
    el.innerHTML = '';
    return;
  }
  const rows = res.results.map((r) => {
    const a = r.analytics || {};
    const isBest = res.best && r.file === res.best;
    return `
      <tr class="${isBest ? 'best' : ''}" data-file="${escapeHtml(r.file)}">
        <td><div class="strategy-name">${isBest ? '★ ' : ''}${escapeHtml(r.file)}</div></td>
        <td class="stat-ok">${Number(a.OK) || 0}</td>
        <td>${Number(a.ERROR) || 0}</td>
        <td>${Number(a.UNSUP) || 0}</td>
        <td>${Number(a.PingOK) || 0}</td>
        <td>${Number(a.PingFail) || 0}</td>
      </tr>`;
  }).join('');
  el.innerHTML = `
    <table class="strategy-test-table">
      <thead><tr>
        <th>Fake-файл</th><th>HTTP OK</th><th>ERR</th><th>UNSUP</th><th>Ping OK</th><th>Fail</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  el.querySelectorAll('tr[data-file]').forEach((row) => {
    const file = row.dataset.file;
    row.addEventListener('click', () => {
      select.value = file;
      showToast({ type: 'info', text: `Выбрано: ${file}. Нажмите «Применить».` });
    });
  });
}

let strategyTestBestName = '';

function renderStrategyTestResults(results, analytics = {}, bestName = '') {
  const el = document.getElementById('strategyTestResults');
  if (!el) return;
  if (!Array.isArray(results) || !results.length) {
    el.innerHTML = '';
    return;
  }

  const safeAnalytics = analytics && typeof analytics === 'object' ? analytics : {};
  const rows = results.map((r) => {
    // The analytics object is the authoritative source: it is produced by the
    // original PowerShell tester and is NOT recalculated in the renderer.
    const a = safeAnalytics[r.name] || safeAnalytics[r.id] || {};
    const isStandard = Object.prototype.hasOwnProperty.call(a, 'PingOK') || r.type === 'standard';
    const isBest = bestName ? r.name === bestName : false;

    const targetRows = Array.isArray(r.perTarget) ? r.perTarget : [];
    const targetSummary = targetRows.map((t) => {
      const httpOk = Number(t.httpOk) || 0;
      const httpTotal = Number(t.httpTotal) || 0;
      const ping = t.ping && t.ping !== 'n/a' ? String(t.ping) : 'n/a';
      const pingOnly = httpTotal === 0 && t.isUrl === false;

      // PING-only targets (for example public DNS) must never be shown as
      // failed HTTP targets. They have no HTTP/TLS checks by design, so the
      // only meaningful status is the ping result.
      if (pingOnly) {
        const pingOk = ping !== 'n/a' && !/^timeout$/i.test(ping);
        const state = pingOk ? '✓' : '✕';
        const cls = pingOk ? 'target-ok' : 'target-fail';
        return `<div class="strategy-target ${cls}"><span>${state}</span> ${escapeHtml(t.name)} <small>Ping: ${escapeHtml(ping)}</small></div>`;
      }

      let state = '✕';
      let cls = 'target-fail';
      if (httpOk === httpTotal && httpTotal > 0) {
        state = '✓'; cls = 'target-ok';
      } else if (httpOk > 0) {
        state = '≈'; cls = 'target-partial';
      } else if (httpTotal > 0 && Array.isArray(t.httpTokens) && t.httpTokens.every((x) => /:UNSUP\b/i.test(x))) {
        state = '!'; cls = 'target-unsupported';
      }
      const http = `HTTP ${httpOk}/${httpTotal}`;
      const pingText = ping !== 'n/a' ? ` · Ping: ${ping}` : '';
      return `<div class="strategy-target ${cls}"><span>${state}</span> ${escapeHtml(t.name)} <small>${escapeHtml(http + pingText)}</small></div>`;
    }).join('');

    if (isStandard) {
      return `
        <tr class="${isBest ? 'best' : ''}" data-strategy-id="${escapeHtml(r.id)}">
          <td>
            <div class="strategy-name">${escapeHtml(r.name)}</div>
            <div class="strategy-targets">${targetSummary || '<span class="muted">нет данных</span>'}</div>
          </td>
          <td class="stat-ok">${Number(a.OK) || 0}</td>
          <td>${Number(a.ERROR) || 0}</td>
          <td>${Number(a.UNSUP) || 0}</td>
          <td>${Number(a.PingOK) || 0}</td>
          <td>${Number(a.PingFail) || 0}</td>
        </tr>`;
    }

    return `
      <tr class="${isBest ? 'best' : ''}" data-strategy-id="${escapeHtml(r.id)}">
        <td>
          <div class="strategy-name">${escapeHtml(r.name)}</div>
          <div class="strategy-targets">${targetSummary || '<span class="muted">нет данных</span>'}</div>
        </td>
        <td class="stat-ok">${Number(a.OK) || 0}</td>
        <td>${Number(a.FAIL) || 0}</td>
        <td>${Number(a.UNSUPPORTED) || 0}</td>
        <td>${Number(a.LIKELY_BLOCKED) || 0}</td>
      </tr>`;
  }).join('');

  const hasStandardAnalytics = results.some((r) => {
    const a = safeAnalytics[r.name] || safeAnalytics[r.id];
    return a && Object.prototype.hasOwnProperty.call(a, 'PingOK');
  }) || results.some((r) => r.type === 'standard');

  el.innerHTML = hasStandardAnalytics ? `
    <table class="strategy-test-table">
      <thead>
        <tr>
          <th>Стратегия / проверки</th>
          <th>HTTP OK</th>
          <th>ERR</th>
          <th>UNSUP</th>
          <th>Ping OK</th>
          <th>Fail</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="hint strategy-test-footnote">
      Статистика в этой таблице взята напрямую из <code>$analytics</code> оригинального <code>test zapret.ps1</code>. Значения не пересчитываются JavaScript.
    </div>` : `
    <table class="strategy-test-table">
      <thead>
        <tr>
          <th>Стратегия / проверки</th>
          <th>OK</th>
          <th>FAIL</th>
          <th>UNSUP</th>
          <th>BLOCKED</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="hint strategy-test-footnote">
      Статистика в этой таблице взята напрямую из <code>$analytics</code> оригинального <code>test zapret.ps1</code>.
    </div>`;

  el.querySelectorAll('tr[data-strategy-id]').forEach((row) => {
    row.addEventListener('click', () => {
      window.api.selectStrategy(row.dataset.strategyId).then(renderState);
      showToast({ type: 'info', text: `Выбрана стратегия: ${row.querySelector('.strategy-name')?.textContent || row.dataset.strategyId}` });
    });
  });
}

window.api.onStrategyTestProgress(({ index, total, name, status, ok, targetsTotal, best, resultFile, results, analytics }) => {
  const el = document.getElementById('progressStrategyTest');
  if (!el) return;
  if (status === 'start') {
    el.className = 'progress-line';
    el.textContent = `Подготовка полного теста ${total} стратегий...`;
  } else if (status === 'testing') {
    el.className = 'progress-line';
    el.textContent = `Тестирую ${index}/${total}: ${name}...`;
  } else if (status === 'done') {
    const cls = ok === 0 ? ' fail' : (targetsTotal && ok === targetsTotal ? ' ok' : '');
    el.className = 'progress-line' + cls;
    el.textContent = `${index}/${total}: ${name} — ${ok}/${targetsTotal}`;
  } else if (status === 'finished') {
    strategyTestBestName = best || '';
    el.className = 'progress-line ok';
    el.textContent = best
      ? `Готово: проверено ${total} стратегий. Лучшая: ${best}.`
      : `Готово: проверено ${total} стратегий.`;
    if (Array.isArray(results)) renderStrategyTestResults(results, analytics, strategyTestBestName);
    if (resultFile) {
      showToast({ type: 'info', text: `Результаты сохранены: ${resultFile}` });
    }
  }
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

// Раньше при полном выходе из приложения (пункт "Выход" в трее, закрытие
// через диспетчер задач и т.п.) несохранённые правки в редакторе списков
// терялись молча — окно просто скрывается при обычном закрытии (см.
// main.js: mainWindow.on('close', ...)), но при реальном app.quit() DOM
// всё же выгружается. Стандартный beforeunload — минимальная, но не
// требующая доработок в main.js подстраховка от такой потери.
window.addEventListener('beforeunload', (e) => {
  if (!listDirty) return;
  e.preventDefault();
  e.returnValue = '';
});
