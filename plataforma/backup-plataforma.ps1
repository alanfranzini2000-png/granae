# Gera um backup .zip da Plataforma com data e hora no nome.
# Exclui o que e grande e regeneravel (node_modules, venvs, caches, .git).
# Gerado para ser chamado pelo atalho "Fazer Backup" na area de trabalho.
$ErrorActionPreference = 'Stop'

$repoRoot  = 'C:\Users\alanf\OneDrive\Desktop\Plataforma'
$src       = Join-Path $repoRoot 'plataforma'
$backupDir = Join-Path $repoRoot 'backups'

Write-Host ''
Write-Host '  Gerando backup da Plataforma...' -ForegroundColor Cyan
Write-Host ''

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$ts      = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$zipPath = Join-Path $backupDir "plataforma-backup-$ts.zip"

$dirsExcluidos = @('node_modules', '.venv', '.venv312', '__pycache__', '.pytest_cache', '.git')
$arquivos = Get-ChildItem -Path $src -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
    $partes = $_.FullName.Substring($src.Length).Split('\')
    -not ($partes | Where-Object { $dirsExcluidos -contains $_ })
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
$n = 0
foreach ($f in $arquivos) {
    $rel = 'plataforma\' + $f.FullName.Substring($src.Length + 1)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel, 'Optimal') | Out-Null
    $n++
}
$zip.Dispose()

$z = Get-Item $zipPath
Write-Host '  Backup criado com sucesso!' -ForegroundColor Green
Write-Host ''
Write-Host ("  Arquivo : " + $z.Name)
Write-Host ("  Pasta   : " + $backupDir)
Write-Host ("  Tamanho : " + [math]::Round($z.Length/1MB,1) + " MB  (" + $n + " arquivos)")
Write-Host ''
Write-Host '  Esta janela fecha sozinha em alguns segundos...' -ForegroundColor DarkGray
Start-Sleep -Seconds 5
