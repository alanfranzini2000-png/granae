# Compila o backend (Python) num executável nativo único via Nuitka, sem
# distribuir os .py fonte, e copia o binário para dentro do projeto Tauri
# (desktop/src-tauri/binaries) com o nome que o Tauri espera para o sidecar.
#
# Pré-requisitos (uma vez, na máquina onde se gera o instalador):
#   - Python 3.11+ instalado e no PATH
#   - Um compilador C: o Nuitka pede o MSVC Build Tools (ou MinGW64) na
#     primeira execução, se não encontrar nenhum — siga as instruções dele.
#
# Uso: abrir PowerShell nesta pasta (plataforma/build) e rodar:
#   ./build_backend.ps1

$ErrorActionPreference = "Stop"

$root      = Split-Path -Parent $PSScriptRoot          # .../plataforma
$backend   = Join-Path $root "backend"
$binDir    = Join-Path $root "desktop\src-tauri\binaries"
$buildDir  = Join-Path $backend "build_nuitka"

# Usa o Python do VENV do projeto (.venv312), que tem TODAS as dependências
# (fastapi, uvicorn, pdfplumber, pymupdf, pytesseract, openpyxl...). O `python`
# do PATH é o do sistema e pode não ter essas libs, fazendo o Nuitka falhar.
$py = Join-Path $backend ".venv312\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }   # fallback

New-Item -ItemType Directory -Force -Path $binDir | Out-Null

Push-Location $backend
try {
    Write-Host "Instalando/atualizando Nuitka..." -ForegroundColor Cyan
    & $py -m pip install --upgrade nuitka ordered-set zstandard

    Write-Host "Compilando backend (pode levar alguns minutos)..." -ForegroundColor Cyan
    & $py -m nuitka `
        --onefile `
        --output-dir="$buildDir" `
        --output-filename=granae-backend.exe `
        --include-data-dir=tessdata=tessdata `
        --windows-console-mode=attach `
        --remove-output `
        run_server.py

    $exeOrigem  = Join-Path $buildDir "granae-backend.exe"
    $exeDestino = Join-Path $binDir "granae-backend-x86_64-pc-windows-msvc.exe"
    Copy-Item $exeOrigem $exeDestino -Force

    Write-Host "OK: $exeDestino" -ForegroundColor Green
}
finally {
    Pop-Location
}
