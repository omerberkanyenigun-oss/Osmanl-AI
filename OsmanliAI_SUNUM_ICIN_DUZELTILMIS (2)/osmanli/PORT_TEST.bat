@echo off
chcp 65001 >nul
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; foreach($p in 8765..8865){try{$l=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$p);$l.Start();$l.Stop();Write-Host ('Bos port bulundu: '+$p) -ForegroundColor Green;$ok=$true;break}catch{}}; if(-not $ok){Write-Host 'Bos port bulunamadi.' -ForegroundColor Red}"
pause
