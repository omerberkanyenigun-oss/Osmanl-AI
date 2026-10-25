@echo off
chcp 65001 >nul
title Osmanli AI - OpenAI API Anahtari
 echo OpenAI API anahtarinizi girin.
 echo Anahtar ekranda gorunebilir; kimseyle paylasmayin.
 echo.
set /p OAKEY=API anahtari: 
if "%OAKEY%"=="" (
  echo Anahtar girilmedi.
  pause
  exit /b 1
)
setx OPENAI_API_KEY "%OAKEY%" >nul
if errorlevel 1 (
  echo Anahtar kaydedilemedi.
) else (
  echo Anahtar Windows kullanici ortam degiskenine kaydedildi.
  echo Acik Osmanli AI pencerelerini kapatip START.bat dosyasini yeniden calistirin.
)
set OAKEY=
pause
