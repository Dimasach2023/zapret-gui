"""
Точка входа для консольной (headless) сборки tg-ws-proxy, встроенной в Zapret GUI.

В отличие от оригинального windows.py (полноценное трей-приложение на
customtkinter/pystray с диалогами настроек), этот файл запускает только сам
прокси-движок (proxy/tg_ws_proxy.py) через тот же CLI, что и обычный
`tg-ws-proxy` из pyproject.toml. Всё управление (запуск/остановка, порт,
секрет, автозапуск) делает сама Zapret GUI через main.js — отдельный трей и
диалоги настроек проекту не нужны и только раздували бы exe лишними
зависимостями (customtkinter, pystray, Pillow).
"""

from proxy.tg_ws_proxy import main

if __name__ == "__main__":
    main()
