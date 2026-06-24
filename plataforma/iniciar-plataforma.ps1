# Inicia a Plataforma (backend FastAPI + frontend Vite) e abre no navegador.
# Gerado para ser chamado pelo atalho "Abrir Plataforma" na area de trabalho.
$ErrorActionPreference = 'SilentlyContinue'

$base    = 'C:\Users\alanf\OneDrive\Desktop\Plataforma\plataforma'
$venvPy  = Join-Path $base 'backend\.venv312\Scripts\python.exe'
$url     = 'http://localhost:5173'
$pidFile = Join-Path $env:TEMP 'plataforma_pids.txt'

function Porta-Ativa($porta) {
    return [bool](Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue)
}

Write-Host ''
Write-Host '  Iniciando a Plataforma...' -ForegroundColor Cyan
Write-Host ''

$novosPids = @()

# --- Backend (porta 8000) ---
if (Porta-Ativa 8000) {
    Write-Host '  - Backend ja estava rodando (porta 8000).'
} else {
    $b = Start-Process -PassThru -WindowStyle Minimized -FilePath $venvPy `
        -ArgumentList '-m', 'uvicorn', 'main:app', '--port', '8000' `
        -WorkingDirectory (Join-Path $base 'backend')
    if ($b) { $novosPids += $b.Id }
    Write-Host '  - Backend iniciado (porta 8000).' -ForegroundColor Green
}

# --- Frontend (porta 5173) ---
if (Porta-Ativa 5173) {
    Write-Host '  - Frontend ja estava rodando (porta 5173).'
} else {
    $f = Start-Process -PassThru -WindowStyle Minimized -FilePath 'cmd.exe' `
        -ArgumentList '/c', 'npm run dev' `
        -WorkingDirectory (Join-Path $base 'frontend')
    if ($f) { $novosPids += $f.Id }
    Write-Host '  - Frontend iniciado (porta 5173).' -ForegroundColor Green
}

# Guarda os PIDs para o script de parar encerrar tudo certinho.
if ($novosPids.Count -gt 0) {
    $novosPids | Set-Content -Path $pidFile -Encoding ascii
}

# --- Espera o site responder e abre o navegador ---
Write-Host ''
Write-Host '  Aguardando o site subir...' -ForegroundColor Cyan
$pronto = $false
for ($i = 0; $i -lt 60; $i++) {
    if (Porta-Ativa 5173) { $pronto = $true; break }
    Start-Sleep -Milliseconds 500
}

Write-Host ''
if ($pronto) {
    Start-Process $url
    Write-Host "  Pronto! Abrindo $url" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host '  O site demorou para responder. Veja as janelas minimizadas na barra de tarefas.' -ForegroundColor Yellow
    Start-Sleep -Seconds 6
}
