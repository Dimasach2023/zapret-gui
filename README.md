# Zapret GUI

Графический интерфейс для zapret-discord-youtube (обход DPI-блокировок Discord/YouTube через `winws.exe`).

Папка zapret (bin, lists, utils) зашита прямо в приложение — ничего выбирать не нужно, всё работает сразу после установки. Вместо оригинальных `.bat`-файлов GUI сам вызывает `bin\winws.exe` с нужными аргументами (аргументы извлечены из всех 22 стратегий, см. `strategies.json`), а всё, что раньше было доступно только через консольное меню `service.bat`, теперь встроено в интерфейс — отдельного консольного меню больше нет.

## Возможности

**Главное:**
- Выбор одной из 22 стратегий
- Старт / Стоп, статус в реальном времени
- Game Filter (Выкл / TCP / UDP / TCP+UDP)
- Автозапуск GUI при входе в Windows (`schtasks`, без окна UAC при каждом входе)
- Автозапуск выбранной стратегии при старте приложения
- Живой лог `winws.exe`

**Расширенные:**
- Установка / удаление постоянной службы Windows (`sc create/delete`) — работает без открытого GUI
- Просмотр статуса службы `zapret` и драйвера `WinDivert`
- IPSet Filter: переключение `loaded → none → any` (с автоматическим backup/restore файла `ipset-all.txt`, как в оригинале)
- Обновление списка `ipset-all.txt` и проверка/обновление hosts-файла — напрямую с GitHub-репозитория zapret
- Автопроверка обновлений (переключатель) и ручная проверка версии
- Замена active fake-файлов (Discord UDP / Game UDP) из списка `.bin`-файлов в `bin/`
- Диагностика конфликтующих служб (BFE, прокси, TCP timestamps, AdGuard, Killer, Intel, Check Point, SmartByte, наличие `WinDivert64.sys`)
- Запуск оригинального `utils\test zapret.ps1` для тестирования стратегий

## Структура проекта

```
zapret-gui/
  package.json
  main.js             — главный процесс: запуск winws.exe, служба, IPSet, обновления, диагностика
  preload.js           — безопасный мост между main и renderer
  strategies.json      — аргументы winws.exe для каждой стратегии (сгенерировано из .bat)
  build/
    icon.ico            — иконка приложения/установщика (Windows)
    icon.png            — иконка для окна/трея/шапки GUI
  vendor/zapret/         — bin, lists, utils из архива zapret-discord-youtube (упаковывается в приложение)
  renderer/
    index.html
    style.css
    renderer.js
    icon.png
```

## Как собрать

```
npm install
npm run dist
```

В `dist/` появится NSIS-установщик и портативная версия — обе уже содержат папку zapret внутри (`resources/zapret`), пользователю ничего указывать не нужно.

Для разработки:
```
npm start
```
(в dev-режиме приложение берёт файлы из `vendor/zapret/`).

## Важно

- Работает только на Windows.
- Приложение запрашивает права администратора автоматически (`requestedExecutionLevel: requireAdministrator`) — это нужно для драйвера WinDivert.
- Если позже выйдет новая версия zapret-discord-youtube, обновите содержимое `vendor/zapret/bin` и `vendor/zapret/lists`, а также перегенерируйте `strategies.json` из новых `.bat`-файлов (или обновите его вручную).
