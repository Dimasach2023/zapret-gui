# tg-ws-proxy внутри Zapret GUI

Сюда встроен [tg-ws-proxy](https://github.com/Flowseal/tg-ws-proxy) — MTProto/WebSocket
proxy для Telegram — как второй управляемый процесс рядом с winws.exe.

## Что именно встроено

Вместо оригинального `windows.py` (полноценное трей-приложение со своими
диалогами настроек на customtkinter/pystray) сюда взят **только движок
прокси** — `proxy/tg_ws_proxy.py`, который в исходном проекте и так умеет
работать как обычный консольный процесс с CLI-флагами (`--host`, `--port`,
`--secret`, `--fake-tls-domain`, `--no-cfproxy`, ...). Всё управление —
запуск/остановка, порт, секрет, автозапуск, отображение статуса и ссылки
`tg://proxy?...` — теперь делает сама Zapret GUI (main.js + вкладка
«Telegram» в интерфейсе), поэтому тяжёлые UI-зависимости оригинального
трея не нужны и не тянутся в сборку.

```
vendor/tg-ws-proxy/
  bin/                    ← сюда кладётся собранный tg-ws-proxy.exe (изначально пусто)
  src/
    proxy/                ← движок прокси, скопирован как есть из tg-ws-proxy
    utils/logging_setup.py← нужен для --log-file
    headless_main.py      ← точка входа для сборки (просто зовёт proxy.tg_ws_proxy.main())
    requirements-headless.txt
  packaging/tgwsproxy.spec← PyInstaller-спека (single-file exe, без tkinter/pystray/PIL)
  build_headless.bat      ← собрать bin\tg-ws-proxy.exe одной командой
```

## Как собрать bin\tg-ws-proxy.exe

PyInstaller не кросс-компилирует — .exe нужно собирать **на Windows**
(как и сам winws.exe в `vendor/zapret/bin`, он тоже не пересобирается на лету).

1. Установите Python 3.9+ на Windows.
2. Откройте `vendor/tg-ws-proxy` и запустите:
   ```
   build_headless.bat
   ```
   Скрипт создаст venv, поставит `cryptography`, `certifi`, `pyinstaller` и
   соберёт `bin\tg-ws-proxy.exe` (~15-25 МБ, один файл).
3. Запустите `npm start` в корне zapret-gui — на вкладке «Telegram» появится
   статус «остановлен» вместо «не собран», кнопка «Запустить прокси» заработает.

Для сборки установщика (`npm run dist`) `vendor/tg-ws-proxy/bin` уже прописан
в `package.json` → `build.extraResources`, как и `vendor/zapret`.

## Что видно в GUI

Вкладка «Telegram»:
- запуск/остановка прокси (отдельный процесс, как winws);
- host/port, секрет (32 hex, генерируется автоматически, можно перегенерировать);
- Fake TLS домен (необязательно) и переключатель Cloudflare-фолбэка;
- готовая ссылка `tg://proxy?server=...&port=...&secret=...` с кнопкой «Копировать»;
- автозапуск прокси вместе с приложением (отдельно от автозапуска winws).

Для доступа с других устройств/друзей нужно вручную заменить `127.0.0.1` в
поле Host (или в скопированной ссылке) на реальный внешний IP/домен и
пробросить порт на роутере — GUI не может надёжно определить внешний адрес
сам и не делает это автоматически.

## Обновление движка прокси

Если в апстриме (`Flowseal/tg-ws-proxy`) обновится `proxy/*.py`, достаточно
заменить файлы в `src/proxy/` этой же версией и пересобрать
`build_headless.bat` — остальная интеграция (main.js, CLI-флаги) не завязана
на конкретную версию файлов, только на существующий CLI-контракт
(`--host/--port/--secret/--fake-tls-domain/--no-cfproxy/--dc-ip/...`).
