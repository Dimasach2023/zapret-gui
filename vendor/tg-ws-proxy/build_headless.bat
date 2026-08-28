@echo off
REM Собирает bin\tg-ws-proxy.exe из src\headless_main.py.
REM Запускать на Windows, из папки vendor\tg-ws-proxy (или где угодно — пути внутри относительные к этому файлу).

setlocal
cd /d "%~dp0"

python -m venv .buildvenv
call .buildvenv\Scripts\activate.bat

pip install -r src\requirements-headless.txt
if errorlevel 1 goto :err

pyinstaller --clean --noconfirm --distpath bin --workpath .build packaging\tgwsproxy.spec
if errorlevel 1 goto :err

REM спек собирает single-file exe (onefile) — PyInstaller кладёт его прямо в
REM bin\tg-ws-proxy.exe, как и ожидает main.js (TGWS_EXE).

echo.
echo Готово: bin\tg-ws-proxy.exe
goto :eof

:err
echo Сборка не удалась.
exit /b 1
