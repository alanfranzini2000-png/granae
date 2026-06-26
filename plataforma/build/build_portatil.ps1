# Gera um pacote PORTATIL do Granae — sem instalar nada na maquina do amigo.
# Usa Python embeddable (assinado pela PSF, passa no Smart App Control) + backend
# + frontend buildado + um launcher .bat. O amigo descompacta e da 2 cliques.
#
# Uso (PowerShell, nesta pasta):  ./build_portatil.ps1
# Saida: plataforma/dist_portatil/Granae-portatil.zip
$ErrorActionPreference = "Stop"

$root     = Split-Path -Parent $PSScriptRoot          # .../plataforma
$backend  = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$dist     = Join-Path $root "dist_portatil"
$staging  = Join-Path $dist "Granae"
$cache    = Join-Path $env:TEMP "granae_build_cache"

$pyVer    = "3.12.7"
$pyZipUrl = "https://www.python.org/ftp/python/$pyVer/python-$pyVer-embed-amd64.zip"

New-Item -ItemType Directory -Force -Path $cache, $dist | Out-Null
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }

# 1) Frontend build ----------------------------------------------------------
Write-Host "1/5  Buildando o frontend..." -ForegroundColor Cyan
& npm --prefix $frontend run build
if ($LASTEXITCODE -ne 0) { throw "falha no build do frontend" }

# 2) Python embeddable -------------------------------------------------------
Write-Host "2/5  Preparando Python embeddable ($pyVer)..." -ForegroundColor Cyan
$pyZip = Join-Path $cache "python-$pyVer-embed.zip"
if (-not (Test-Path $pyZip)) { Invoke-WebRequest -Uri $pyZipUrl -OutFile $pyZip }
$pyDir = Join-Path $staging "python"
New-Item -ItemType Directory -Force -Path $pyDir | Out-Null
Expand-Archive -Path $pyZip -DestinationPath $pyDir -Force

# habilita site-packages (pip) e o diretorio do app no ._pth do embeddable.
# (o Python embeddable IGNORA PYTHONPATH quando ha ._pth, entao a pasta do app
#  precisa estar listada aqui — caminho relativo ao python\ = ..\app)
$pth = (Get-ChildItem $pyDir -Filter "python*._pth" | Select-Object -First 1).FullName
(Get-Content $pth) -replace '^#\s*import site', 'import site' | Set-Content $pth
if (-not (Select-String -Path $pth -Pattern 'Lib\\site-packages' -Quiet)) {
    Add-Content $pth "Lib\site-packages"
}
if (-not (Select-String -Path $pth -Pattern '\.\.\\app' -Quiet)) {
    Add-Content $pth "..\app"
}

# 3) pip + dependencias ------------------------------------------------------
Write-Host "3/5  Instalando dependencias (pode levar alguns minutos)..." -ForegroundColor Cyan
$py = Join-Path $pyDir "python.exe"
$getpip = Join-Path $cache "get-pip.py"
if (-not (Test-Path $getpip)) { Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getpip }
& $py $getpip --no-warn-script-location -q
& $py -m pip install --no-warn-script-location -q -r (Join-Path $backend "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "falha ao instalar as dependencias" }

# 4) Copia backend + frontend buildado --------------------------------------
Write-Host "4/5  Montando o app..." -ForegroundColor Cyan
$appDir = Join-Path $staging "app"
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
Copy-Item (Join-Path $backend "*.py") $appDir -Force
if (Test-Path (Join-Path $backend "tessdata")) {
    Copy-Item (Join-Path $backend "tessdata") $appDir -Recurse -Force
}
Copy-Item (Join-Path $frontend "dist") (Join-Path $staging "web") -Recurse -Force

# Tesseract OCR (para faturas em IMAGEM, ex.: XP). Copia so o tesseract.exe + as
# DLLs (sem as ferramentas de treino). A pasta de idioma (por.traineddata) ja vai
# em app/tessdata; o launcher aponta TESSERACT_PATH para o exe empacotado.
$tessSrc = "C:\Program Files\Tesseract-OCR"
if (Test-Path (Join-Path $tessSrc "tesseract.exe")) {
    $tessDst = Join-Path $staging "tesseract"
    New-Item -ItemType Directory -Force -Path $tessDst | Out-Null
    Copy-Item (Join-Path $tessSrc "tesseract.exe") $tessDst -Force
    Copy-Item (Join-Path $tessSrc "*.dll") $tessDst -Force
    Write-Host "     Tesseract incluido (OCR de fatura XP)." -ForegroundColor DarkGray
} else {
    Write-Host "     AVISO: Tesseract nao achado em $tessSrc - fatura XP (imagem) nao fara OCR no pacote." -ForegroundColor Yellow
}

# 5) Launcher + zip ----------------------------------------------------------
Write-Host "5/5  Launcher + zip..." -ForegroundColor Cyan
$bat = @'
@echo off
title Granae
cd /d "%~dp0app"
set "GRANAE_FRONTEND_DIST=%~dp0web"
set "PYTHONPATH=%~dp0app"
set "TESSERACT_PATH=%~dp0tesseract\tesseract.exe"
echo.
echo   Iniciando o Granae...  (esta janela precisa ficar aberta enquanto usa)
echo   O app abre no navegador em http://127.0.0.1:8000
echo.
start "" /b cmd /c "timeout /t 5 >nul & start http://127.0.0.1:8000"
"%~dp0python\python.exe" "%~dp0app\run_server.py"
'@
Set-Content -Path (Join-Path $staging "Iniciar Granae.bat") -Value $bat -Encoding Ascii

$zip = Join-Path $dist "Granae-portatil.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $staging -DestinationPath $zip

$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "PRONTO: $zip  (${mb} MB)" -ForegroundColor Green
Write-Host "Teste local: extraia e rode 'Iniciar Granae.bat'." -ForegroundColor Green
