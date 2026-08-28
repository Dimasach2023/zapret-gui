# -*- mode: python ; coding: utf-8 -*-
#
# Собирает src/headless_main.py в один консольный tg-ws-proxy.exe без
# зависимостей на customtkinter/pystray/Pillow (они нужны только оригинальному
# трей-приложению windows.py, которое Zapret GUI не использует — своя логика
# запуска/остановки и вся конфигурация уже сделаны в main.js/renderer).
#
# Собирать нужно на Windows (PyInstaller не кросс-компилирует exe с Linux/macOS).
# См. ../README.md.

import os
from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

_here = os.path.dirname(os.path.abspath(SPEC))
_src = os.path.join(_here, os.pardir, 'src')

certifi_datas = collect_data_files('certifi')

a = Analysis(
    [os.path.join(_src, 'headless_main.py')],
    pathex=[_src],
    binaries=[],
    datas=certifi_datas,
    hiddenimports=[
        'cryptography.hazmat.primitives.ciphers',
        'cryptography.hazmat.primitives.ciphers.algorithms',
        'cryptography.hazmat.primitives.ciphers.modes',
        'cryptography.hazmat.backends.openssl',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter', 'customtkinter', 'pystray', 'PIL',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='tg-ws-proxy',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
