@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo Osmanli AI yerel 3D motoru kuruluyor...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $pub=Join-Path (Get-Location) 'public'; $v=Join-Path $pub 'vendor'; New-Item -ItemType Directory -Path $v -Force | Out-Null; $tmp=Join-Path $env:TEMP ('three-'+[Guid]::NewGuid().ToString('N')); New-Item -ItemType Directory -Path $tmp | Out-Null; try { Invoke-WebRequest 'https://registry.npmjs.org/three/-/three-0.160.0.tgz' -OutFile (Join-Path $tmp 'three.tgz') -UseBasicParsing -TimeoutSec 30; tar.exe -xzf (Join-Path $tmp 'three.tgz') -C $tmp; if ($LASTEXITCODE -ne 0) { throw 'Arsiv acilamadi' }; Copy-Item (Join-Path $tmp 'package/build/three.module.js') (Join-Path $v 'three.module.js') -Force; Write-Host 'Basarili: yerel 3D motoru hazir.' -ForegroundColor Green } catch { Write-Host ('Kurulum basarisiz: '+$_.Exception.Message) -ForegroundColor Red; exit 1 } finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }"
if errorlevel 1 echo Kurulum tamamlanamadi. Internet veya npm registry erisimini kontrol edin.
echo.
pause
endlocal
