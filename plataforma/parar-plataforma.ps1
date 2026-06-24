# Encerra a Plataforma (backend + frontend).
# Gerado para ser chamado pelo atalho "Fechar Plataforma" na area de trabalho.
$ErrorActionPreference = 'SilentlyContinue'

$pidFile = Join-Path $env:TEMP 'plataforma_pids.txt'

Write-Host ''
Write-Host '  Encerrando a Plataforma...' -ForegroundColor Cyan
Write-Host ''

$algoParou = $false

# 1) Encerra pelos PIDs guardados ao iniciar (mata a arvore inteira com /T).
if (Test-Path $pidFile) {
    foreach ($linha in Get-Content $pidFile) {
        $id = $linha.Trim()
        if ($id) {
            taskkill /PID $id /T /F 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  - Processo $id encerrado." -ForegroundColor Green
                $algoParou = $true
            }
        }
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

# 2) Garantia extra: encerra quem ainda estiver ocupando as portas 8000 e 5173.
foreach ($porta in 8000, 5173) {
    $conns = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        if ($c.OwningProcess) {
            taskkill /PID $c.OwningProcess /T /F 2>$null | Out-Null
            Write-Host "  - Liberada a porta $porta." -ForegroundColor Green
            $algoParou = $true
        }
    }
}

Write-Host ''
if ($algoParou) {
    Write-Host '  Plataforma encerrada.' -ForegroundColor Green
} else {
    Write-Host '  Nada estava rodando.' -ForegroundColor Yellow
}
Start-Sleep -Seconds 2
