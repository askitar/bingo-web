@echo off
chcp 65001 >nul
title Bingo Virtual
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "Servidor del Bingo" /min python servidor.py
  timeout /t 2 >nul
  start "" "http://localhost:8123/index.html"
  start "" "http://localhost:8123/cartulinas.html"
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    start "Servidor del Bingo" /min py servidor.py
    timeout /t 2 >nul
    start "" "http://localhost:8123/index.html"
    start "" "http://localhost:8123/cartulinas.html"
  ) else (
    start "" "%~dp0index.html"
    start "" "%~dp0cartulinas.html"
  )
)
exit
