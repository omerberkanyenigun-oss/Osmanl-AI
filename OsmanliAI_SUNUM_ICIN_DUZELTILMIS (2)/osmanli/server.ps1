$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$public = [System.IO.Path]::GetFullPath((Join-Path $root "public"))

# 3D motorunu CDN'den her sayfa açılışında istememek için yerel kopya hazırla.
# npm registry erişilebiliyorsa Three.js paketini indirip public/vendor içine çıkar.
function Ensure-LocalThree {
    $vendorDir = Join-Path $public "vendor"
    $modulePath = Join-Path $vendorDir "three.module.js"
    if (Test-Path -LiteralPath $modulePath -PathType Leaf) {
        $existing = Get-Item -LiteralPath $modulePath
        if ($existing.Length -gt 500000) { Write-Host "3D motoru: yerel kopya bulundu." -ForegroundColor Green; return $true }
    }
    Write-Host "3D motoru yerel kopyasi hazirlaniyor..." -ForegroundColor Cyan
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $work = Join-Path $env:TEMP ("ottoman-three-" + [Guid]::NewGuid().ToString("N"))
        New-Item -ItemType Directory -Path $work -Force | Out-Null
        New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null
        $archive = Join-Path $work "three.tgz"
        $packageUrl = "https://registry.npmjs.org/three/-/three-0.160.0.tgz"
        Invoke-WebRequest -Uri $packageUrl -OutFile $archive -UseBasicParsing -TimeoutSec 25
        $tar = Join-Path $env:SystemRoot "System32\tar.exe"
        if (-not (Test-Path $tar)) { $tar = "tar.exe" }
        & $tar -xzf $archive -C $work
        if ($LASTEXITCODE -ne 0) { throw "Three.js paket arsivi acilamadi." }
        $downloaded = Join-Path $work "package\build\three.module.js"
        if (-not (Test-Path -LiteralPath $downloaded -PathType Leaf)) { throw "Paket icinde three.module.js bulunamadi." }
        Copy-Item -LiteralPath $downloaded -Destination $modulePath -Force
        if ((Get-Item -LiteralPath $modulePath).Length -lt 500000) { throw "Indirilen 3D motoru dosyasi eksik." }
        Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "3D motoru yerel olarak hazir. CDN gerekmeden yuklenebilir." -ForegroundColor Green
        return $true
    } catch {
        Write-Host "Yerel 3D motoru otomatik indirilemedi: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "Oyun yine yedek CDN adreslerini deneyecek. Ag erisimi yoksa ilk kurulum icin internet gerekir." -ForegroundColor Yellow
        return $false
    }
}
# Motor indirmeyi uygulama açılışında çalıştırma; ağ gecikmesi uygulamayı kilitlemesin.
# Gerekirse KUR_3D_MOTORU.bat ayrıca çalıştırılır.

function Get-MimeType([string]$path) {
    switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
        ".html" { "text/html; charset=utf-8" }; ".css" { "text/css; charset=utf-8" }
        ".js" { "application/javascript; charset=utf-8" }; ".json" { "application/json; charset=utf-8" }
        ".bin" { "application/octet-stream" }; ".png" { "image/png" }; ".jpg" { "image/jpeg" }
        ".jpeg" { "image/jpeg" }; ".webp" { "image/webp" }; ".svg" { "image/svg+xml" }
        ".ico" { "image/x-icon" }; ".wav" { "audio/wav" }; ".mp3" { "audio/mpeg" }
        default { "application/octet-stream" }
    }
}

function Send-Response {
    param([System.Net.Sockets.NetworkStream]$Stream,[int]$StatusCode,[string]$StatusText,[byte[]]$Body,[string]$ContentType="text/plain; charset=utf-8")
    $header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
    $headerBytes=[System.Text.Encoding]::ASCII.GetBytes($header);$Stream.Write($headerBytes,0,$headerBytes.Length)
    if($Body.Length -gt 0){$Stream.Write($Body,0,$Body.Length)};$Stream.Flush()
}
function Send-Json($Stream,[int]$Code,[string]$Status,$Object){
    $json=$Object|ConvertTo-Json -Depth 12 -Compress
    Send-Response -Stream $Stream -StatusCode $Code -StatusText $Status -Body ([Text.Encoding]::UTF8.GetBytes($json)) -ContentType "application/json; charset=utf-8"
}
function Get-OpenAIKey {
    $key=[Environment]::GetEnvironmentVariable("OPENAI_API_KEY","Process")
    if([string]::IsNullOrWhiteSpace($key)){$key=[Environment]::GetEnvironmentVariable("OPENAI_API_KEY","User")}
    return $key
}
function Invoke-OpenAI([string]$Uri,$Payload){
    $key=Get-OpenAIKey
    if([string]::IsNullOrWhiteSpace($key)){throw "OPENAI_API_KEY_NOT_SET"}
    $headers=@{Authorization="Bearer $key";"Content-Type"="application/json"}
    $json=$Payload|ConvertTo-Json -Depth 12 -Compress
    return Invoke-RestMethod -Method Post -Uri $Uri -Headers $headers -Body ([Text.Encoding]::UTF8.GetBytes($json)) -ContentType "application/json; charset=utf-8" -TimeoutSec 180
}
function Test-OttomanPrompt([string]$Text){
    $words=@("osmanlı","fatih","mehmed","topkapı","sultan","padişah","yeniçeri","sipahi","akıncı","divan","hümayun","istanbul","konstantiniyye","edirne","bursa","kanuni","selim","süleyman","abdülhamid","mimar sinan","saray","cami","külliye","tuğra","çini","minyatür","mehter","kapalıçarşı","rumeli","anadolu","fetih")
    $lower=$Text.ToLower([Globalization.CultureInfo]::GetCultureInfo("tr-TR"));foreach($w in $words){if($lower.Contains($w)){return $true}};return $false
}
function Get-ResponseText($Response){
    if($Response.output_text){return [string]$Response.output_text}
    $parts=New-Object System.Collections.Generic.List[string]
    foreach($item in @($Response.output)){foreach($content in @($item.content)){if($content.text){$parts.Add([string]$content.text)}}}
    return ($parts -join "`n").Trim()
}

$listener=$null;$port=$null
# Her çalıştırmada rastgele bir port seçilir. Böylece önceki sürümden kalan
# hatalı service worker aynı origin üzerinde uygulamayı yakalayamaz.
$candidates = 1..120 | ForEach-Object { Get-Random -Minimum 20000 -Maximum 55000 }
foreach($candidate in $candidates){
 try{
  $trial=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$candidate)
  $trial.Start();$listener=$trial;$port=$candidate;break
 }catch{if($trial){try{$trial.Stop()}catch{}}}
}
if(-not $listener){Write-Host "Sunucu baslatilamadi: bos port bulunamadi." -ForegroundColor Red;Read-Host "Kapatmak icin Enter";exit 1}
# localhost kullanılması, 127.0.0.1 üzerinde kalmış eski service worker'lardan da ayrılır.
$url="http://localhost:$port/"
Write-Host "";Write-Host "==============================================" -ForegroundColor DarkCyan
Write-Host " OSMANLI AI V29.3 - STABLE AI FIX" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor DarkCyan
Write-Host "Sunucu hazir: $url" -ForegroundColor Green
if([string]::IsNullOrWhiteSpace((Get-OpenAIKey))){Write-Host "AI anahtari bulunamadi. API_ANAHTARI_AYARLA.bat dosyasini calistirin." -ForegroundColor Yellow}else{Write-Host "OpenAI baglantisi hazir." -ForegroundColor Green}
Write-Host "Bu pencere acik kaldigi surece uygulama calisir." -ForegroundColor Cyan

$browserCandidates=@("$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe","$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe","$env:ProgramFiles\Google\Chrome\Application\chrome.exe","$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe")
$browser=$browserCandidates|Where-Object{Test-Path $_}|Select-Object -First 1
if($browser){Start-Process -FilePath $browser -ArgumentList "--app=$url","--start-maximized"}else{Start-Process $url}

try{
 while($true){
  $client=$listener.AcceptTcpClient()
  try{
   $client.ReceiveTimeout=190000;$client.SendTimeout=190000;$stream=$client.GetStream()
   $reader=New-Object IO.StreamReader($stream,[Text.Encoding]::UTF8,$false,4096,$true)
   $requestLine=$reader.ReadLine();if([string]::IsNullOrWhiteSpace($requestLine)){continue}
   $headers=@{};while($true){$line=$reader.ReadLine();if([string]::IsNullOrEmpty($line)){break};$p=$line.IndexOf(":");if($p -gt 0){$headers[$line.Substring(0,$p).Trim().ToLowerInvariant()]=$line.Substring($p+1).Trim()}}
   $parts=$requestLine.Split(' ');if($parts.Length -lt 2){Send-Json $stream 400 "Bad Request" @{error="Geçersiz istek."};continue}
   $method=$parts[0].ToUpperInvariant();$rawPath=$parts[1].Split('?')[0];$decodedPath=[Uri]::UnescapeDataString($rawPath)
   $bodyText="";$contentLength=0;if($headers.ContainsKey("content-length")){[int]::TryParse($headers["content-length"],[ref]$contentLength)|Out-Null}
   if($contentLength -gt 0){$chars=New-Object char[] $contentLength;$readTotal=0;while($readTotal -lt $contentLength){$n=$reader.Read($chars,$readTotal,$contentLength-$readTotal);if($n -le 0){break};$readTotal+=$n};$bodyText=-join $chars[0..($readTotal-1)]}

   if($method -eq "OPTIONS"){Send-Response $stream 204 "No Content" ([byte[]]::new(0));continue}
   if($method -eq "POST" -and $decodedPath -eq "/api/ottoman-image"){
    try{
     $req=$bodyText|ConvertFrom-Json;$prompt=[string]$req.prompt;$size=[string]$req.size
     if([string]::IsNullOrWhiteSpace($prompt)){Send-Json $stream 400 "Bad Request" @{error="Görsel komutu boş olamaz."};continue}
     if(-not (Test-OttomanPrompt $prompt)){Send-Json $stream 400 "Bad Request" @{error="Bu özellik yalnızca Osmanlı temalı komutları kabul eder."};continue}
     if($size -notin @("1024x1024","1536x1024","1024x1536")){$size="1024x1024"}
     $model=$env:OPENAI_IMAGE_MODEL;if([string]::IsNullOrWhiteSpace($model)){$model="gpt-image-1"}
     $safePrompt="Osmanlı tarihi ve kültürü konusunda saygılı, eğitimsel ve tarihsel olarak tutarlı bir görsel üret. Modern logo, yazı veya filigran kullanma. Kullanıcı isteği: $prompt"
     $r=Invoke-OpenAI "https://api.openai.com/v1/images/generations" @{model=$model;prompt=$safePrompt;size=$size;n=1}
     $b64=[string]$r.data[0].b64_json;if([string]::IsNullOrWhiteSpace($b64)){throw "API görsel verisi döndürmedi."}
     Send-Json $stream 200 "OK" @{ok=$true;image=$b64;mime="image/png";model=$model}
    }catch{if($_.Exception.Message -eq "OPENAI_API_KEY_NOT_SET"){Send-Json $stream 200 "OK" @{ok=$false;error="OpenAI API anahtarı ayarlı değil. Önce API_ANAHTARI_AYARLA.bat dosyasını çalıştır."}}else{Send-Json $stream 200 "OK" @{ok=$false;error=("Görsel üretilemedi: "+$_.Exception.Message)}}};continue
   }
   if($method -eq "POST" -and $decodedPath -eq "/api/ottoman-news"){
    try{
     $req=$bodyText|ConvertFrom-Json;$title=[string]$req.title;$news=[string]$req.body;$level=[string]$req.level
     if([string]::IsNullOrWhiteSpace($title)-or[string]::IsNullOrWhiteSpace($news)){Send-Json $stream 400 "Bad Request" @{error="Haber başlığı ve metni gereklidir."};continue}
     $levelText=switch($level){"sade"{"Günümüz okurunun kolay anlayacağı, az sayıda Osmanlıca kelime içeren sade üslup"};"agir"{"Ağır fakat okunabilir divan ve vakanüvis üslubu; zor kelimelerin karşılığını parantez içinde ver"};default{"Orta derecede Osmanlı Türkçesi kelimeleri içeren, anlaşılır vakanüvis üslubu"}}
     $instruction="Sen dikkatli bir tarih dili editörüsün. Verilen güncel haberi gerçekleri değiştirmeden Osmanlı dönemi vakanüvisi üslubuyla yeniden yaz. Yeni bilgi uydurma, siyasi propaganda yapma, hakaret veya kesin hüküm ekleme. Arap harfleri kullanma; Latin harfleriyle Osmanlı Türkçesi üslubu kullan. Önce 2-4 paragraflık haber, sonra 'Vakanüvisin Mülahazası:' başlığı altında tarafsız ve kısa bir yorum yaz. Üslup: $levelText.`n`nBaşlık: $title`nHaber: $news"
     $model=$env:OPENAI_TEXT_MODEL;if([string]::IsNullOrWhiteSpace($model)){$model="gpt-4.1-mini"}
     $r=Invoke-OpenAI "https://api.openai.com/v1/responses" @{model=$model;input=$instruction;max_output_tokens=900}
     $out=Get-ResponseText $r;if([string]::IsNullOrWhiteSpace($out)){throw "API boş metin döndürdü."}
     Send-Json $stream 200 "OK" @{ok=$true;title=("Vakanüvis Kaleminden: "+$title);text=$out;model=$model}
    }catch{if($_.Exception.Message -eq "OPENAI_API_KEY_NOT_SET"){Send-Json $stream 200 "OK" @{ok=$false;error="OpenAI API anahtarı ayarlı değil. Önce API_ANAHTARI_AYARLA.bat dosyasını çalıştır."}}else{Send-Json $stream 200 "OK" @{ok=$false;error=("Haber yorumlanamadı: "+$_.Exception.Message)}}};continue
   }

   if($decodedPath -eq "/"){$decodedPath="/index.html"}
   $relativePath=$decodedPath.TrimStart('/').Replace('/',[IO.Path]::DirectorySeparatorChar);$filePath=[IO.Path]::GetFullPath((Join-Path $public $relativePath))
   if(-not $filePath.StartsWith($public,[StringComparison]::OrdinalIgnoreCase)){Send-Json $stream 403 "Forbidden" @{error="Erişim reddedildi."};continue}
   if(-not(Test-Path -LiteralPath $filePath -PathType Leaf)){if([IO.Path]::GetExtension($filePath)-eq""){$filePath=Join-Path $public "index.html"}else{Send-Json $stream 404 "Not Found" @{error="Dosya bulunamadı."};continue}}
   $bytes=if($method-eq"HEAD"){[byte[]]::new(0)}else{[IO.File]::ReadAllBytes($filePath)};Send-Response $stream 200 "OK" $bytes (Get-MimeType $filePath)
  }catch{try{if($stream-and$stream.CanWrite){Send-Json $stream 500 "Internal Server Error" @{error="Sunucu hatası."}}}catch{};Write-Host "Istek hatasi: $($_.Exception.Message)" -ForegroundColor DarkYellow}
  finally{try{$reader.Dispose()}catch{};try{$stream.Dispose()}catch{};try{$client.Close()}catch{}}
 }
}finally{try{$listener.Stop()}catch{}}
