// Zapret GUI — main process
// Всё, что раньше делал service.bat через консольное меню, теперь встроено сюда:
// установка/удаление службы, IPSet Filter, Game Filter, автообновление списков/hosts,
// замена active fake-файлов, диагностика, тесты. Папка zapret зашита в приложение
// (resources/zapret), выбирать её не нужно.

const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn, exec } = require('child_process');
const net = require('net');
const tls = require('tls');

const isWin = process.platform === 'win32';
const LOCAL_VERSION = '1.10.2';
const SERVICE_NAME = 'zapret';
const TASK_NAME = 'ZapretGUIAutostart';
const GITHUB_VERSION_URL =
  'https://raw.githubusercontent.com/Flowseal/zapret-discord-youtube/main/.service/version.txt';
const GITHUB_RELEASES_URL = 'https://github.com/Flowseal/zapret-discord-youtube/releases/latest';
const GITHUB_API_LATEST_URL = 'https://api.github.com/repos/Flowseal/zapret-discord-youtube/releases/latest';
const IPSET_URL =
  'https://raw.githubusercontent.com/Flowseal/zapret-discord-youtube/refs/heads/main/.service/ipset-service.txt';
const HOSTS_URL =
  'https://raw.githubusercontent.com/Flowseal/zapret-discord-youtube/refs/heads/main/.service/hosts';
const IPSET_PLACEHOLDER = '203.0.113.113/32';

// ---------- автообновляемый блок hosts от zapret-discord-youtube ----------
const ZAPRET_HOSTS_MARK_START = '# === Zapret GUI: hosts от zapret-discord-youtube — начало ===';
const ZAPRET_HOSTS_MARK_END = '# === Zapret GUI: hosts от zapret-discord-youtube — конец ===';

// ---------- дополнение hosts от разработчика GUI (WhatsApp/Facebook/Instagram/Roblox) ----------
const CUSTOM_HOSTS_MARK_START = '# === Zapret GUI: дополнение hosts (WhatsApp/Facebook/Instagram/Roblox) — начало ===';
const CUSTOM_HOSTS_MARK_END = '# === Zapret GUI: дополнение hosts — конец ===';
const CUSTOM_HOSTS_LINES = [
  '57.144.245.32 whatsapp.com',
  '57.144.245.32 www.whatsapp.com',
  '57.144.245.32 web.whatsapp.com',
  '57.144.245.32 apps.whatsapp.com',
  '57.144.245.32 login.whatsapp.net',
  '57.144.245.32 portal.whatsapp.com',
  '57.144.245.32 wa.me',
  '57.144.245.32 api.whatsapp.com',
  '57.144.245.32 graph.whatsapp.net',
  '57.144.245.32 dit.whatsapp.net',
  '57.144.245.32 crashlogs.whatsapp.net',
  '57.144.245.32 snr.whatsapp.net',
  '57.144.245.32 dyn.whatsapp.net',
  '57.144.245.32 static.whatsapp.net',
  '57.144.245.32 contacts.whatsapp.net',
  '57.144.245.32 k.whatsapp.net',
  '57.144.245.32 v.whatsapp.net',
  '57.144.245.32 whatsapp.net',
  '57.144.245.32 web.whatsapp.net',
  '57.144.245.32 c.whatsapp.net',
  '57.144.245.32 d.whatsapp.net',
  '57.144.245.32 e.whatsapp.net',
  '57.144.245.32 g.whatsapp.net',
  '57.144.245.32 cdn.whatsapp.net',
  '57.144.245.32 chat.cdn.whatsapp.net',
  '57.144.245.32 media.whatsapp.net',
  '57.144.245.32 mmg.whatsapp.net',
  '57.144.245.32 mmg-fna.whatsapp.net',
  '57.144.245.32 mms.whatsapp.net',
  '57.144.245.32 enc.whatsapp.net',
  '57.144.245.32 mmx-ds.cdn.whatsapp.net',
  '57.144.245.32 media-ams4-1.cdn.whatsapp.net',
  '57.144.245.32 media-frt3-2.cdn.whatsapp.net',
  '57.144.245.32 media-sin6-2.cdn.whatsapp.net',
  '57.144.245.32 whatsapp-cdn-shv-01-hel3.fbcdn.net',
  '57.144.245.32 external.xx.fbcdn.net',
  '57.144.245.32 pps.whatsapp.net',
  '57.144.245.32 scontent.whatsapp.net',
  '57.144.245.32 media-hel3-1.cdn.whatsapp.net',
  '157.240.22.35 www.facebook.com',
  '57.144.244.34 instagram.com',
  '57.144.244.34 www.instagram.com',
  '96.16.53.163 tr.rbxcdn.com',
];

let mainWindow = null;
let tray = null;
let winwsProcess = null;
let isQuitting = false;

// ---------- paths ----------
const ZAPRET_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'zapret')
  : path.join(__dirname, 'vendor', 'zapret');
const BIN_DIR = path.join(ZAPRET_ROOT, 'bin');
const LISTS_DIR = path.join(ZAPRET_ROOT, 'lists');
const UTILS_DIR = path.join(ZAPRET_ROOT, 'utils');
const WINWS_EXE = path.join(BIN_DIR, 'winws.exe');
const IPSET_ALL = path.join(LISTS_DIR, 'ipset-all.txt');
const IPSET_BACKUP = IPSET_ALL + '.backup';
const CHECK_UPDATES_FLAG = path.join(UTILS_DIR, 'check_updates.enabled');
const GAME_FILTER_FLAG = path.join(UTILS_DIR, 'game_filter.enabled');
const ICON_PNG_PATH = path.join(__dirname, 'build', 'icon.png');
const TRAY_ICON_PATH = path.join(__dirname, 'build', process.platform === 'win32' ? 'tray.ico' : 'tray.png');

const strategies = JSON.parse(fs.readFileSync(path.join(__dirname, 'strategies.json'), 'utf-8'));

// ---------- config ----------
const configPath = path.join(app.getPath('userData'), 'config.json');
function loadConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}
function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    console.error('saveConfig failed', e);
  }
}
let config = Object.assign(
  {
    strategyId: strategies[0].id,
    gameFilterMode: 'off', // off | tcp | udp | all
    autostartApp: false,
    autostartWinws: false,
    autoUpdateCheck: false,
    // какой .bin-файл сейчас скопирован в ACTIVE_DISCORD_UDP.bin / ACTIVE_GAME_UDP.bin —
    // раньше нигде не сохранялось, поэтому выбор в селекторах «слетал» на дефолт
    // после каждого перезапуска GUI, даже если сам файл оставался применённым.
    activeFakeDiscord: 'ACTIVE_DISCORD_UDP.bin',
    activeFakeGame: 'ACTIVE_GAME_UDP.bin',
  },
  loadConfigFile()
);
// Миграция: если раньше настройка хранилась только как файл-флаг внутри
// папки приложения (что «слетало» при обновлении/переустановке или из-за
// антивируса), подхватим её значение один раз при первом запуске новой версии.
if (loadConfigFile().autoUpdateCheck === undefined && fs.existsSync(CHECK_UPDATES_FLAG)) {
  config.autoUpdateCheck = true;
}

// ---------- utils ----------
function sendLog(line) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const text = line.endsWith('\n') ? line : line + '\n';
  mainWindow.webContents.send('log-line', text);
}
// короткое всплывающее уведомление — видно на любой вкладке, в отличие от журнала
function notify(type, text) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('notify', { type, text });
}
function run(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code || 1 : 0, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}
function httpsGetText(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'zapret-gui' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGetText(res.headers.location, timeoutMs).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        res.resume();
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
function httpsGetBinary(url, timeoutMs = 60000, onProgress) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'zapret-gui' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGetBinary(res.headers.location, timeoutMs, onProgress).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        res.resume();
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      const chunks = [];
      let received = 0;
      res.on('data', (chunk) => {
        chunks.push(chunk);
        received += chunk.length;
        if (onProgress && total > 0) onProgress(received, total);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
function currentStrategy() {
  return strategies.find((s) => s.id === config.strategyId) || strategies[0];
}
function bin(name) {
  return path.join(BIN_DIR, name);
}

function buildArgs(strategy) {
  const binPrefix = BIN_DIR + path.sep;
  const listsPrefix = LISTS_DIR + path.sep;
  let gftcp = '12';
  let gfudp = '12';
  if (config.gameFilterMode === 'all') {
    gftcp = '1024-65535';
    gfudp = '1024-65535';
  } else if (config.gameFilterMode === 'tcp') {
    gftcp = '1024-65535';
    gfudp = '12';
  } else if (config.gameFilterMode === 'udp') {
    gftcp = '12';
    gfudp = '1024-65535';
  }
  return strategy.args.map((a) =>
    a
      .replace(/\{\{BIN\}\}/g, binPrefix)
      .replace(/\{\{LISTS\}\}/g, listsPrefix)
      .replace(/\{\{GFTCP\}\}/g, gftcp)
      .replace(/\{\{GFUDP\}\}/g, gfudp)
  );
}

function syncGameFilterFile() {
  try {
    if (config.gameFilterMode === 'off') {
      if (fs.existsSync(GAME_FILTER_FLAG)) fs.unlinkSync(GAME_FILTER_FLAG);
    } else {
      fs.mkdirSync(path.dirname(GAME_FILTER_FLAG), { recursive: true });
      fs.writeFileSync(GAME_FILTER_FLAG, config.gameFilterMode, 'utf-8');
    }
  } catch (e) {
    sendLog('[WARN] game_filter.enabled: ' + e.message);
  }
}

// ---------- winws process control ----------
function startWinws() {
  if (!isWin) {
    sendLog('[ERROR] winws.exe запускается только на Windows.');
    notify('error', 'winws.exe запускается только на Windows.');
    return;
  }
  if (!fs.existsSync(WINWS_EXE)) {
    sendLog('[ERROR] Не найден bin\\winws.exe внутри приложения.');
    notify('error', 'Не найден bin\\winws.exe внутри приложения.');
    return;
  }
  stopWinws(() => {
    const strategy = currentStrategy();
    syncGameFilterFile();
    const args = buildArgs(strategy);
    sendLog(`> Запуск стратегии: ${strategy.name}`);
    try {
      winwsProcess = spawn(WINWS_EXE, args, { cwd: BIN_DIR, windowsHide: true });
    } catch (e) {
      sendLog('[ERROR] Не удалось запустить winws.exe: ' + e.message);
      notify('error', 'Не удалось запустить winws.exe: ' + e.message);
      winwsProcess = null;
      pushState();
      return;
    }
    notify('success', `Стратегия «${strategy.name}» запущена.`);
    winwsProcess.stdout.on('data', (d) => sendLog(d.toString('utf8')));
    winwsProcess.stderr.on('data', (d) => sendLog(d.toString('utf8')));
    winwsProcess.on('error', (e) => {
      sendLog('[ERROR] ' + e.message);
      notify('error', e.message);
      winwsProcess = null;
      pushState();
    });
    winwsProcess.on('exit', (code) => {
      sendLog(`> winws.exe завершился (код ${code})`);
      if (code !== 0 && code !== null) notify('error', `winws.exe неожиданно завершился (код ${code}).`);
      winwsProcess = null;
      pushState();
    });
    pushState();
  });
}
function stopWinws(cb) {
  const finish = () => {
    winwsProcess = null;
    if (cb) cb();
    pushState();
  };
  if (winwsProcess && winwsProcess.pid) {
    exec(`taskkill /PID ${winwsProcess.pid} /T /F`, () => finish());
  } else if (isWin) {
    exec('taskkill /IM winws.exe /F', () => finish());
  } else {
    finish();
  }
}
function checkWinwsRunning() {
  return new Promise((resolve) => {
    if (!isWin) return resolve(false);
    exec('tasklist /FI "IMAGENAME eq winws.exe" /NH /FO CSV', (err, stdout) => {
      resolve(!err && /winws\.exe/i.test(stdout));
    });
  });
}

// ---------- Windows service (Install/Remove/Status) — заменяет пункты 1-3 меню ----------
function quoteIfNeeded(s) {
  return /\s/.test(s) ? `\\"${s}\\"` : s;
}
async function serviceInstall() {
  if (!isWin) return;
  const strategy = currentStrategy();
  syncGameFilterFile();
  const args = buildArgs(strategy).map(quoteIfNeeded).join(' ');
  sendLog(`> Установка службы Windows со стратегией: ${strategy.name}`);
  await run(`net stop ${SERVICE_NAME}`);
  await run(`sc delete ${SERVICE_NAME}`);
  const binPathValue = `\\"${WINWS_EXE}\\" ${args}`;
  const createCmd = `sc create ${SERVICE_NAME} binPath= "${binPathValue}" DisplayName= "zapret" start= auto`;
  const res = await run(createCmd);
  if (res.code !== 0) {
    sendLog('[ERROR] sc create: ' + (res.stderr || res.stdout));
    notify('error', 'Не удалось установить службу.');
    return;
  }
  await run(`sc description ${SERVICE_NAME} "Zapret DPI bypass software"`);
  const startRes = await run(`sc start ${SERVICE_NAME}`);
  if (startRes.code === 0) {
    sendLog('> Служба установлена и запущена.');
    notify('success', 'Служба установлена и запущена.');
  } else {
    sendLog('[WARN] Служба создана, но не запустилась: ' + startRes.stdout);
    notify('error', 'Служба создана, но не запустилась.');
  }
  await run(
    `reg add "HKLM\\System\\CurrentControlSet\\Services\\${SERVICE_NAME}" /v zapret-discord-youtube /t REG_SZ /d "${strategy.name}" /f`
  );
  pushState();
}
async function serviceRemove() {
  if (!isWin) return;
  sendLog('> Удаление службы...');
  await run(`net stop ${SERVICE_NAME}`);
  await run(`sc delete ${SERVICE_NAME}`);
  await run('taskkill /IM winws.exe /F');
  await run('net stop WinDivert');
  await run('sc delete WinDivert');
  await run('net stop WinDivert14');
  await run('sc delete WinDivert14');
  sendLog('> Служба удалена.');
  notify('success', 'Служба удалена.');
  pushState();
}
async function queryServiceState(name) {
  const res = await run(`sc query "${name}"`);
  if (res.code !== 0) return 'NOT_INSTALLED';
  const m = res.stdout.match(/STATE\s*:\s*\d+\s*(\w+)/i);
  return m ? m[1].toUpperCase() : 'UNKNOWN';
}

// ---------- IPSet Filter (loaded / none / any) — заменяет пункт 5 меню ----------
function ipsetStatus() {
  try {
    const content = fs.existsSync(IPSET_ALL) ? fs.readFileSync(IPSET_ALL, 'utf-8') : '';
    const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) return 'any';
    if (content.includes(IPSET_PLACEHOLDER)) return 'none';
    return 'loaded';
  } catch {
    return 'loaded';
  }
}
function ipsetCycle() {
  const status = ipsetStatus();
  try {
    if (status === 'loaded') {
      if (fs.existsSync(IPSET_BACKUP)) fs.unlinkSync(IPSET_BACKUP);
      fs.renameSync(IPSET_ALL, IPSET_BACKUP);
      fs.writeFileSync(IPSET_ALL, IPSET_PLACEHOLDER + '\n', 'utf-8');
      sendLog('> IPSet Filter: none (список исключён, backup сохранён).');
      notify('success', 'IPSet Filter переключён на «none».');
    } else if (status === 'none') {
      fs.writeFileSync(IPSET_ALL, '', 'utf-8');
      sendLog('> IPSet Filter: any (файл пуст — фильтр не ограничивает IP).');
      notify('success', 'IPSet Filter переключён на «any».');
    } else {
      if (!fs.existsSync(IPSET_BACKUP)) {
        sendLog('[ERROR] Нет backup-файла. Сначала обновите список (кнопка "Обновить IPSet список").');
        notify('error', 'Нет backup-файла — сначала обновите список.');
        return;
      }
      fs.unlinkSync(IPSET_ALL);
      fs.renameSync(IPSET_BACKUP, IPSET_ALL);
      sendLog('> IPSet Filter: loaded (список восстановлен из backup).');
      notify('success', 'IPSet Filter переключён на «loaded».');
    }
  } catch (e) {
    sendLog('[ERROR] IPSet Filter: ' + e.message);
    notify('error', 'IPSet Filter: ' + e.message);
  }
  pushState();
}

// ---------- Check for updates / Update IPSet / Update hosts — заменяет пункты 6,8,9,10 ----------
async function checkForUpdates() {
  sendLog('> Проверка обновлений...');
  try {
    const remote = (await httpsGetText(GITHUB_VERSION_URL)).trim();
    if (!remote) throw new Error('пустой ответ');
    const current = config.zapretVersion || LOCAL_VERSION;
    if (remote === current) {
      sendLog(`> Установлена последняя версия zapret: ${current}`);
      notify('info', `Установлена последняя версия: ${current}`);
    } else {
      sendLog(`> Доступна новая версия zapret: ${remote} (у вас ${current}). Используйте кнопку «Обновить zapret» для автообновления.`);
      notify('info', `Доступна новая версия: ${remote}. Нажмите «Обновить zapret» для автообновления.`);
    }
  } catch (e) {
    sendLog('[WARN] Не удалось проверить обновления: ' + e.message);
    notify('error', 'Не удалось проверить обновления: ' + e.message);
  }
}

async function updateZapretFiles() {
  sendLog('> Получение информации о последнем релизе zapret...');
  try {
    // 1. Узнаём последний релиз через GitHub API
    const releaseJson = await httpsGetText(GITHUB_API_LATEST_URL, 15000);
    const release = JSON.parse(releaseJson);
    const remoteVersion = (release.tag_name || '').replace(/^v/i, '').trim();
    const current = config.zapretVersion || LOCAL_VERSION;

    if (!remoteVersion) throw new Error('не удалось определить версию релиза');

    if (remoteVersion === current) {
      sendLog(`> zapret уже актуален (версия ${current}).`);
      notify('info', `zapret уже актуален (${current}).`);
      return;
    }

    // 2. Ищем ZIP-архив среди assets релиза
    const assets = release.assets || [];
    const zipAsset = assets.find((a) => a.name && a.name.toLowerCase().endsWith('.zip'));
    if (!zipAsset) throw new Error('ZIP-архив не найден среди assets релиза');

    sendLog(`> Скачивание ${zipAsset.name} (${Math.round(zipAsset.size / 1024)} КБ)...`);
    const zipBuf = await httpsGetBinary(zipAsset.browser_download_url, 120000, (received, total) => {
      const pct = Math.round((received / total) * 100);
      if (pct % 20 === 0) sendLog(`> Загрузка... ${pct}%`);
    });

    // 3. Распаковываем нужные папки (bin/, lists/, utils/) в ZAPRET_ROOT
    sendLog('> Распаковка файлов...');
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipBuf);
    const entries = zip.getEntries();

    // Определяем корневой префикс внутри ZIP (может быть zapret-discord-youtube-x.y.z/)
    // Ищем первый entry содержащий bin/, lists/ или utils/
    const targetDirs = ['bin/', 'lists/', 'utils/'];
    let zipPrefix = '';
    for (const entry of entries) {
      const name = entry.entryName.replace(/\\/g, '/');
      for (const dir of targetDirs) {
        const idx = name.indexOf('/' + dir);
        if (idx !== -1) {
          zipPrefix = name.slice(0, idx + 1);
          break;
        }
      }
      if (zipPrefix) break;
    }

    let extractedCount = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryName = entry.entryName.replace(/\\/g, '/');
      // Убираем корневой префикс
      const relative = zipPrefix ? entryName.slice(zipPrefix.length) : entryName;
      // Берём только файлы из нужных папок
      const inTarget = targetDirs.some((dir) => relative.startsWith(dir));
      if (!inTarget) continue;

      const destPath = path.join(ZAPRET_ROOT, ...relative.split('/'));
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
      extractedCount++;
    }

    if (extractedCount === 0) throw new Error('не найдены файлы bin/, lists/, utils/ в ZIP-архиве');

    // 4. Сохраняем новую версию в config — теперь localVersion будет её отражать
    config.zapretVersion = remoteVersion;
    saveConfig();

    sendLog(`> zapret успешно обновлён до версии ${remoteVersion} (${extractedCount} файлов).`);
    notify('success', `zapret обновлён до версии ${remoteVersion}.`);
    pushState();
  } catch (e) {
    sendLog('[ERROR] Не удалось обновить zapret: ' + e.message);
    notify('error', 'Не удалось обновить zapret: ' + e.message);
  }
}
async function updateIpsetList() {
  sendLog('> Обновление ipset-all.txt...');
  try {
    const text = await httpsGetText(IPSET_URL, 15000);
    fs.writeFileSync(IPSET_ALL, text, 'utf-8');
    if (fs.existsSync(IPSET_BACKUP)) fs.unlinkSync(IPSET_BACKUP);
    sendLog('> ipset-all.txt обновлён.');
    notify('success', 'ipset-all.txt обновлён.');
  } catch (e) {
    sendLog('[ERROR] Не удалось обновить ipset-all.txt: ' + e.message);
    notify('error', 'Не удалось обновить ipset-all.txt: ' + e.message);
  }
  pushState();
}
async function updateHostsFile() {
  sendLog('> Проверка hosts-файла...');
  try {
    const text = await httpsGetText(HOSTS_URL + '?t=' + Date.now(), 15000);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) throw new Error('пустой ответ репозитория');

    const newBlock = [ZAPRET_HOSTS_MARK_START, ...lines, ZAPRET_HOSTS_MARK_END].join('\r\n');
    let content = readHostsFile();

    const blockRe = new RegExp(
      `\\r?\\n?${escapeRegExp(ZAPRET_HOSTS_MARK_START)}[\\s\\S]*?${escapeRegExp(ZAPRET_HOSTS_MARK_END)}\\r?\\n?`,
      'g'
    );
    const existingMatch = content.match(blockRe);
    const existingLines = existingMatch
      ? existingMatch[0]
          .split(/\r?\n/)
          .filter((l) => l.trim().length > 0 && l !== ZAPRET_HOSTS_MARK_START && l !== ZAPRET_HOSTS_MARK_END)
          .join('\n')
      : null;
    const remoteLinesJoined = lines.join('\n');

    if (existingLines === remoteLinesJoined) {
      sendLog('> hosts-файл в актуальном состоянии.');
      notify('info', 'hosts-файл уже в актуальном состоянии.');
      return;
    }

    content = content.replace(blockRe, '\n');
    content = content.replace(/[\s\r\n]+$/, '');
    content = content + '\r\n\r\n' + newBlock + '\r\n';

    const hostsPath = getHostsPath();
    fs.writeFileSync(hostsPath, content, 'utf-8');
    sendLog(`> hosts-файл обновлён автоматически (${existingMatch ? 'блок обновлён' : 'блок добавлен'}, ${lines.length} строк).`);
    notify('success', 'hosts-файл обновлён автоматически.');
  } catch (e) {
    sendLog('[ERROR] Не удалось обновить hosts-файл: ' + e.message + ' (запустите GUI от имени администратора).');
    notify('error', 'Не удалось обновить hosts-файл — нужны права администратора.');
  }
}
function toggleAutoUpdateCheck(enable) {
  // Основной источник истины — config.json в userData (переживает обновления
  // приложения и не зависит от прав на папку установки).
  config.autoUpdateCheck = !!enable;
  saveConfig();
  // Файл-флаг в utils/ дублируем «best effort» для внешних .bat/.ps1 скриптов
  // zapret, которые могут на него смотреть, но его потеря больше не влияет
  // на состояние галочки в GUI.
  try {
    fs.mkdirSync(UTILS_DIR, { recursive: true });
    if (enable) fs.writeFileSync(CHECK_UPDATES_FLAG, '', 'utf-8');
    else if (fs.existsSync(CHECK_UPDATES_FLAG)) fs.unlinkSync(CHECK_UPDATES_FLAG);
    sendLog(`> Автопроверка обновлений: ${enable ? 'включена' : 'выключена'}.`);
    notify('success', `Автопроверка обновлений ${enable ? 'включена' : 'выключена'}.`);
  } catch (e) {
    sendLog('[WARN] Не удалось продублировать флаг в utils/ (настройка в GUI всё равно сохранена): ' + e.message);
  }
  pushState();
}

// ---------- Дополнение hosts от разработчика GUI ----------
function getHostsPath() {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
}
function readHostsFile() {
  const p = getHostsPath();
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}
function customHostsApplied() {
  try {
    return readHostsFile().includes(CUSTOM_HOSTS_MARK_START);
  } catch {
    return false;
  }
}
function toggleCustomHosts(enable) {
  const alreadyApplied = customHostsApplied();
  if (enable && alreadyApplied) {
    sendLog('> Дополнение hosts от разработчика GUI уже активно.');
    notify('info', 'Дополнение hosts уже активно.');
    pushState();
    return;
  }
  if (!enable && !alreadyApplied) {
    sendLog('> Дополнение hosts от разработчика GUI и так не активно.');
    notify('info', 'Дополнение hosts и так не активно.');
    pushState();
    return;
  }
  try {
    const hostsPath = getHostsPath();
    let content = readHostsFile();
    // на всякий случай убираем старый блок (если уже был добавлен ранее), чтобы не дублировать
    const blockRe = new RegExp(
      `\\r?\\n?${escapeRegExp(CUSTOM_HOSTS_MARK_START)}[\\s\\S]*?${escapeRegExp(CUSTOM_HOSTS_MARK_END)}\\r?\\n?`,
      'g'
    );
    content = content.replace(blockRe, '\n');
    if (enable) {
      const block = [CUSTOM_HOSTS_MARK_START, ...CUSTOM_HOSTS_LINES, CUSTOM_HOSTS_MARK_END].join('\r\n');
      content = content.replace(/[\s\r\n]+$/, '');
      content = content + '\r\n\r\n' + block + '\r\n';
      sendLog('> Дополнение hosts от разработчика GUI добавлено.');
      notify('success', 'Дополнение hosts добавлено (WhatsApp/Facebook/Instagram/Roblox).');
    } else {
      content = content.replace(/\n{3,}/g, '\n\n');
      sendLog('> Дополнение hosts от разработчика GUI убрано.');
      notify('success', 'Дополнение hosts убрано.');
    }
    fs.writeFileSync(hostsPath, content, 'utf-8');
  } catch (e) {
    sendLog('[ERROR] Не удалось изменить hosts-файл: ' + e.message + ' (запустите GUI от имени администратора).');
    notify('error', 'Не удалось изменить hosts-файл — нужны права администратора.');
  }
  pushState();
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- Редактирование списков (list-general, list-exclude и т.д.) прямо в GUI ----------
function listEditableFiles() {
  try {
    return fs
      .readdirSync(LISTS_DIR)
      .filter((f) => f.toLowerCase().endsWith('.txt'))
      .sort()
      .map((f) => {
        let size = 0;
        let lines = 0;
        try {
          const stat = fs.statSync(path.join(LISTS_DIR, f));
          size = stat.size;
          lines = fs
            .readFileSync(path.join(LISTS_DIR, f), 'utf-8')
            .split(/\r?\n/)
            .filter((l) => l.length > 0).length;
        } catch {}
        return { name: f, size, lines };
      });
  } catch {
    return [];
  }
}
function safeListFilePath(name) {
  if (typeof name !== 'string' || !name || path.basename(name) !== name || !name.toLowerCase().endsWith('.txt')) {
    throw new Error('недопустимое имя файла');
  }
  const full = path.join(LISTS_DIR, name);
  if (!full.startsWith(LISTS_DIR + path.sep) && full !== LISTS_DIR) {
    throw new Error('недопустимый путь');
  }
  if (!fs.existsSync(full)) {
    throw new Error('файл не найден: ' + name);
  }
  return full;
}
function readListFile(name) {
  const full = safeListFilePath(name);
  return fs.readFileSync(full, 'utf-8');
}
function saveListFile(name, content) {
  const full = safeListFilePath(name);
  try {
    // сохраняем backup исходного файла один раз, на всякий случай
    const backup = full + '.bak';
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(full, backup);
    }
    fs.writeFileSync(full, content, 'utf-8');
    sendLog(`> Список «${name}» сохранён.`);
    notify('success', `Список «${name}» сохранён.`);
    return { ok: true };
  } catch (e) {
    sendLog(`[ERROR] Не удалось сохранить «${name}»: ${e.message}`);
    notify('error', `Не удалось сохранить «${name}»: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

// ---------- Replace active fakes — заменяет пункт 7 ----------
function listBinFiles() {
  try {
    return fs
      .readdirSync(BIN_DIR)
      .filter((f) => f.toLowerCase().endsWith('.bin'))
      .sort();
  } catch {
    return [];
  }
}
function replaceActiveFake(slot, sourceFile) {
  const targetName = slot === 'discord' ? 'ACTIVE_DISCORD_UDP.bin' : 'ACTIVE_GAME_UDP.bin';
  const target = bin(targetName);
  const source = bin(sourceFile);
  try {
    if (!fs.existsSync(source)) throw new Error('файл не найден: ' + sourceFile);
    fs.copyFileSync(source, target);
    // запоминаем выбор в config.json, иначе после перезапуска GUI селектор
    // всегда показывал бы дефолтный ACTIVE_*.bin вместо реально применённого файла
    if (slot === 'discord') config.activeFakeDiscord = sourceFile;
    else config.activeFakeGame = sourceFile;
    saveConfig();
    sendLog(`> ${targetName} заменён на ${sourceFile}.`);
    notify('success', `${targetName} заменён на ${sourceFile}.`);
  } catch (e) {
    sendLog('[ERROR] Не удалось заменить активный fake-файл: ' + e.message);
    notify('error', 'Не удалось заменить активный fake-файл: ' + e.message);
  }
  pushState();
}

// ---------- Автоподбор fake-файла (в оригинальном zapret такого нет —
// там только ручная замена). По очереди применяет каждый кандидат,
// перезапускает стратегию и проверяет доступность указанного хоста. ----------
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function probeHost(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    let done = false;
    const finish = (ok, error) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve({ ok, ms: ok ? Date.now() - started : null, error });
    };
    let socket;
    try {
      if (port === 443) {
        socket = tls.connect({ host, port, servername: host, timeout: timeoutMs, rejectUnauthorized: false });
        socket.on('secureConnect', () => finish(true));
      } else {
        socket = net.connect({ host, port, timeout: timeoutMs });
        socket.on('connect', () => finish(true));
      }
      socket.on('timeout', () => finish(false, 'timeout'));
      socket.on('error', (e) => finish(false, e.message));
    } catch (e) {
      finish(false, e.message);
    }
  });
}
let autoPickRunning = { discord: false, game: false };
function sendAutoPickProgress(slot, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('auto-pick-progress', { slot, ...payload });
}
async function autoPickFake(slot, testHost, testPort) {
  if (autoPickRunning[slot]) return;
  autoPickRunning[slot] = true;
  const port = parseInt(testPort, 10) || 443;
  const host = (testHost || '').trim() || 'discord.com';
  const targetName = slot === 'discord' ? 'ACTIVE_DISCORD_UDP.bin' : 'ACTIVE_GAME_UDP.bin';
  const target = bin(targetName);

  try {
    const svc = await queryServiceState(SERVICE_NAME);
    if (svc === 'RUNNING') {
      sendLog('[WARN] Служба "zapret" установлена и работает — она может мешать автоподбору (перезапускать winws параллельно с тестами). Рекомендуется сначала удалить службу.');
    }

    const candidates = listBinFiles().filter(
      (f) => f !== 'ACTIVE_DISCORD_UDP.bin' && f !== 'ACTIVE_GAME_UDP.bin'
    );
    if (candidates.length === 0) {
      sendLog('[ERROR] Нет доступных .bin файлов для перебора.');
      notify('error', 'Нет доступных .bin файлов для перебора.');
      return;
    }

    let original = null;
    try {
      original = fs.existsSync(target) ? fs.readFileSync(target) : null;
    } catch {}

    sendLog(`> === Автоподбор fake (${targetName}), проверка: ${host}:${port} ===`);
    notify('info', `Автоподбор запущен: перебор ${candidates.length} файлов, проверка ${host}:${port}...`);

    const results = [];
    for (let i = 0; i < candidates.length; i++) {
      const file = candidates[i];
      sendAutoPickProgress(slot, { index: i + 1, total: candidates.length, file, status: 'testing' });
      try {
        fs.copyFileSync(bin(file), target);
      } catch (e) {
        sendLog(`  [FAIL] ${file}: не удалось скопировать (${e.message})`);
        results.push({ file, ok: false });
        continue;
      }
      startWinws();
      await delay(1600); // дать winws/драйверу подняться
      const res = await probeHost(host, port, 4000);
      results.push({ file, ok: res.ok, ms: res.ms });
      sendLog(`  ${res.ok ? '[OK]' : '[FAIL]'} ${file}${res.ok ? ` — ${res.ms} мс` : res.error ? ` — ${res.error}` : ''}`);
      sendAutoPickProgress(slot, { index: i + 1, total: candidates.length, file, status: res.ok ? 'ok' : 'fail', ms: res.ms });
    }

    const successful = results.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
    if (successful.length > 0) {
      const best = successful[0];
      fs.copyFileSync(bin(best.file), target);
      // как и при ручной замене — фиксируем выбор, чтобы он не слетал после перезапуска GUI
      if (slot === 'discord') config.activeFakeDiscord = best.file;
      else config.activeFakeGame = best.file;
      saveConfig();
      startWinws();
      sendLog(`> Лучший результат: ${best.file} (${best.ms} мс). Применён и запущен.`);
      notify('success', `Автоподбор завершён: лучший файл — ${best.file} (${best.ms} мс).`);
    } else if (original) {
      fs.writeFileSync(target, original);
      startWinws();
      sendLog('> Ни один файл не прошёл проверку. Восстановлен исходный fake-файл.');
      notify('error', 'Ни один файл не прошёл проверку — восстановлен исходный.');
    } else {
      sendLog('> Ни один файл не прошёл проверку.');
      notify('error', 'Ни один файл не прошёл проверку.');
    }
    sendLog('> === Автоподбор завершён ===');
    sendLog('  Учтите: это эвристическая проверка доступности хоста, а не гарантия обхода блокировки — итоговый выбор стоит перепроверить в самом приложении (Discord/игра).');
  } finally {
    autoPickRunning[slot] = false;
    pushState();
  }
}

// ---------- Diagnostics — заменяет пункт 11 ----------
async function runDiagnostics() {
  sendLog('> === Диагностика ===');
  const bfe = await run('sc query BFE');
  sendLog(/RUNNING/i.test(bfe.stdout) ? '[OK] Base Filtering Engine работает.' : '[X] BFE не запущен — требуется для работы zapret.');

  const proxy = await run(
    'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable'
  );
  if (/0x1/.test(proxy.stdout)) {
    sendLog('[?] Включён системный прокси — убедитесь, что он корректен, либо отключите его.');
  } else {
    sendLog('[OK] Системный прокси не используется.');
  }

  const ts = await run('netsh interface tcp show global');
  if (/timestamps\s*:\s*enabled/i.test(ts.stdout) || /timestamps.*enabled/i.test(ts.stdout)) {
    sendLog('[OK] TCP timestamps включены.');
  } else {
    sendLog('[?] TCP timestamps выключены — включаю...');
    await run('netsh interface tcp set global timestamps=enabled');
  }

  const adguard = await run('tasklist /FI "IMAGENAME eq AdguardSvc.exe"');
  sendLog(/AdguardSvc\.exe/i.test(adguard.stdout) ? '[X] Обнаружен процесс AdGuard — может конфликтовать с Discord.' : '[OK] AdGuard не обнаружен.');

  const scAll = await run('sc query state= all');
  const checks = [
    ['Killer', 'Killer'],
    ['Intel', 'Intel Connectivity Network Service'],
    ['TracSrvWrapper', 'Check Point'],
    ['SmartByte', 'SmartByte'],
  ];
  for (const [needle, label] of checks) {
    sendLog(
      new RegExp(needle, 'i').test(scAll.stdout)
        ? `[X] Обнаружены службы, похожие на «${label}» — возможен конфликт с zapret.`
        : `[OK] ${label}: конфликтов не найдено.`
    );
  }

  sendLog(fs.existsSync(path.join(BIN_DIR, 'WinDivert64.sys')) ? '[OK] WinDivert64.sys на месте.' : '[X] WinDivert64.sys не найден!');
  sendLog('> === Диагностика завершена ===');
  notify('info', 'Диагностика завершена — подробности в журнале на вкладке «Главное».');
}

// ---------- Run Tests — заменяет пункт 12 (запускает оригинальный ps1-скрипт напрямую) ----------
function runTests() {
  const script = path.join(UTILS_DIR, 'test zapret.ps1');
  if (!fs.existsSync(script)) {
    sendLog('[ERROR] utils\\test zapret.ps1 не найден.');
    notify('error', 'utils\\test zapret.ps1 не найден.');
    return;
  }
  sendLog('> Запуск тестов конфигурации в отдельном окне PowerShell...');
  notify('info', 'Тесты запущены в отдельном окне PowerShell.');
  exec(`start "" powershell -NoProfile -ExecutionPolicy Bypass -File "${script}"`, { cwd: ZAPRET_ROOT });
}

// ---------- autostart app (Task Scheduler, без UAC при каждом входе) ----------
function setAutostartApp(enable) {
  if (!isWin) return;
  const exePath = process.execPath;
  if (enable) {
    exec(`schtasks /Create /TN "${TASK_NAME}" /TR "\\"${exePath}\\"" /SC ONLOGON /RL HIGHEST /F`, (err) => {
      sendLog(err ? '[WARN] Не удалось создать автозапуск: ' + err.message : '> Автозапуск приложения включён.');
    });
  } else {
    exec(`schtasks /Delete /TN "${TASK_NAME}" /F`, (err) => {
      if (!err) sendLog('> Автозапуск приложения выключен.');
    });
  }
}

// ---------- state broadcast ----------
async function getStateObject() {
  const runningNow = await checkWinwsRunning();
  let serviceState = 'NOT_INSTALLED';
  let windivertState = 'NOT_INSTALLED';
  if (isWin) {
    [serviceState, windivertState] = await Promise.all([queryServiceState(SERVICE_NAME), queryServiceState('WinDivert')]);
  }
  return {
    strategies: strategies.map((s) => ({ id: s.id, name: s.name })),
    strategyId: config.strategyId,
    gameFilterMode: config.gameFilterMode,
    autostartApp: config.autostartApp,
    autostartWinws: config.autostartWinws,
    running: !!winwsProcess || runningNow,
    managedByUs: !!winwsProcess,
    platform: process.platform,
    ipsetStatus: ipsetStatus(),
    customHostsApplied: customHostsApplied(),
    autoUpdateCheck: config.autoUpdateCheck,
    binFiles: listBinFiles(),
    activeFakeDiscord: config.activeFakeDiscord,
    activeFakeGame: config.activeFakeGame,
    serviceState,
    windivertState,
    localVersion: config.zapretVersion || LOCAL_VERSION,
  };
}
async function pushState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const state = await getStateObject();
  mainWindow.webContents.send('state', state);
  updateTrayMenu(state.running);
}

// ---------- window / tray ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 760,
    minWidth: 680,
    minHeight: 560,
    backgroundColor: '#14161a',
    autoHideMenuBar: true,
    icon: ICON_PNG_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.webContents.on('did-finish-load', () => pushState());
}
function updateTrayMenu(running) {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: 'Открыть Zapret GUI', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: running ? '■ Остановить' : '▶ Запустить', click: () => (running ? stopWinws() : startWinws()) },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`Zapret GUI — ${running ? 'работает' : 'остановлено'}`);
}
function createTray() {
  // отдельная иконка трея: прозрачный фон + контрастный глиф, чтобы не сливаться
  // с тёмной/светлой панелью задач (в отличие от квадратной иконки приложения).
  let img = nativeImage.createFromPath(TRAY_ICON_PATH);
  if (img.isEmpty()) img = nativeImage.createFromPath(ICON_PNG_PATH).resize({ width: 32, height: 32 });
  if (process.platform === 'darwin') img = img.resize({ width: 22, height: 22 });
  tray = new Tray(img);
  tray.on('click', () => (mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()));
  updateTrayMenu(false);
}

// ---------- app lifecycle ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('local.zapret.gui');
    syncGameFilterFile(); // держим файл-флаг в utils/ в актуальном состоянии сразу при старте GUI
    createWindow();
    createTray();
    if (config.autostartWinws) setTimeout(() => startWinws(), 800);
  });
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => {
    isQuitting = true;
  });
}

// ---------- IPC ----------
ipcMain.handle('request-state', () => getStateObject());
ipcMain.handle('select-strategy', (e, id) => {
  config.strategyId = id;
  saveConfig();
  const wasRunning = !!winwsProcess;
  pushState();
  if (wasRunning) startWinws();
});
ipcMain.handle('set-game-filter', (e, mode) => {
  config.gameFilterMode = mode;
  saveConfig();
  const wasRunning = !!winwsProcess;
  pushState();
  if (wasRunning) startWinws();
});
ipcMain.handle('start', () => startWinws());
ipcMain.handle('stop', () => stopWinws(() => notify('info', 'Остановлено.')));
ipcMain.handle('toggle-autostart-app', (e, enable) => {
  config.autostartApp = enable;
  saveConfig();
  setAutostartApp(enable);
  pushState();
});
ipcMain.handle('toggle-autostart-winws', (e, enable) => {
  config.autostartWinws = enable;
  saveConfig();
  pushState();
});
ipcMain.handle('service-install', () => serviceInstall());
ipcMain.handle('service-remove', () => serviceRemove());
ipcMain.handle('ipset-cycle', () => ipsetCycle());
ipcMain.handle('check-updates', () => checkForUpdates());
ipcMain.handle('update-zapret-files', () => updateZapretFiles());
ipcMain.handle('update-ipset', () => updateIpsetList());
ipcMain.handle('update-hosts', () => updateHostsFile());
ipcMain.handle('toggle-auto-update-check', (e, enable) => toggleAutoUpdateCheck(enable));
ipcMain.handle('replace-fake', (e, { slot, sourceFile }) => replaceActiveFake(slot, sourceFile));
ipcMain.handle('auto-pick-fake', (e, { slot, host, port }) => autoPickFake(slot, host, port));
ipcMain.handle('run-diagnostics', () => runDiagnostics());
ipcMain.handle('run-tests', () => runTests());
ipcMain.handle('toggle-custom-hosts', (e, enable) => toggleCustomHosts(enable));
ipcMain.handle('list-lists', () => listEditableFiles());
ipcMain.handle('read-list', (e, name) => {
  try {
    return { ok: true, content: readListFile(name) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle('save-list', (e, { name, content }) => saveListFile(name, content));
