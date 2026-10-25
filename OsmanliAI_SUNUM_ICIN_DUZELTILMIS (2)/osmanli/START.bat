@echo off
setlocal
chcp 65001 >nul
title Osmanli AI - Gercek 3D Muze
cd /d "%~dp0"

echo Osmanli AI baslatiliyor...
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

if errorlevel 1 (
  echo.
  echo Sunucu baslatilamadi. Yukaridaki hata mesajinin ekran goruntusunu alin.
)

echo.
pause
endlocal
