<#
.SYNOPSIS
  Backup of the Docker Compose database (T64): pg_dump in custom format (compressed) to a dated
  file, keeping only the newest N backups of that database. Same behavior as scripts/backup.sh.
  See docs/OPERATIONS.md (how to schedule it with the Windows Task Scheduler).

.PARAMETER Dir
  Folder for the backups. Default: $env:BACKUP_DIR or <repo>\backups.
.PARAMETER Keep
  How many backups of this database to keep. Default: $env:BACKUP_KEEP or 14.
.PARAMETER Db
  Database to back up. Default: $env:DB_NAME or gestor_causas.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\backup.ps1 -Dir D:\copias -Keep 30
#>
param([string]$Dir = "", [int]$Keep = 0, [string]$Db = "")

# Output is ASCII on purpose: Windows PowerShell 5.1 reads BOM-less scripts as ANSI.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
# A relative -Dir is relative to where you ran the command.
if ($Dir -and -not [System.IO.Path]::IsPathRooted($Dir)) { $Dir = Join-Path (Get-Location).Path $Dir }
Set-Location $Root

# A setting from the environment, else its last value in .env (as docker compose reads it).
function Get-Setting([string]$Name, [string]$Default) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if (-not $value -and (Test-Path ".env")) {
    $line = Get-Content ".env" | Where-Object { $_ -match "^$Name=.+" } | Select-Object -Last 1
    if ($line) { $value = $line.Substring($Name.Length + 1).Trim() }
  }
  if ($value) { return $value } else { return $Default }
}

if (-not $Dir) { $Dir = Get-Setting "BACKUP_DIR" (Join-Path $Root "backups") }
if (-not $PSBoundParameters.ContainsKey("Keep")) {
  $setting = Get-Setting "BACKUP_KEEP" "14"
  if ($setting -notmatch '^\d+$') { Write-Host "Error: BACKUP_KEEP tiene que ser un numero: $setting" -ForegroundColor Red; exit 1 }
  $Keep = [int]$setting
}
if (-not $Db) { $Db = Get-Setting "DB_NAME" "gestor_causas" }

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Stop-Backup([string]$Message) { Write-Host "Error: $Message" -ForegroundColor Red; exit 1 }
function Assert-Exit([string]$What) { if ($LASTEXITCODE -ne 0) { Stop-Backup "fallo: $What" } }

# Runs a native command silently and returns its exit code. Under "Stop", Windows PowerShell 5.1
# turns redirected stderr lines into terminating errors, so it is relaxed for this call only.
function Invoke-Quiet([scriptblock]$Command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Command *> $null } finally { $ErrorActionPreference = $previous }
  return $LASTEXITCODE
}

if ($Keep -lt 1) { Stop-Backup "-Keep tiene que ser un numero mayor que cero." }
if ($Db -cnotmatch '^[a-z_][a-z0-9_]{0,50}$') { Stop-Backup "nombre de base invalido: $Db (minusculas, numeros y _)" }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Stop-Backup "falta Docker." }
if ((Invoke-Quiet { docker info }) -ne 0) { Stop-Backup "Docker no esta corriendo. Abri Docker Desktop." }

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$Dir = (Resolve-Path -LiteralPath $Dir).Path
$name = "$Db-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"
$target = Join-Path $Dir $name
$inside = "/tmp/$name"

Write-Step "Respaldando la base $Db"
docker compose up -d --wait postgres
Assert-Exit "levantar PostgreSQL"
# Dump inside the container and copy the file out: piping binary output through PowerShell 5.1
# would re-encode it. No inner double quotes: Windows PowerShell 5.1 drops them when calling
# native programs (the database name is validated above).
docker compose exec -T postgres sh -c "pg_dump -U `$POSTGRES_USER -d $Db --format=custom --compress=9 --no-owner --file=$inside"
Assert-Exit "pg_dump"
# Copy to a temporary name first, so a half-copied file never looks like a backup.
docker compose cp "postgres:$inside" "$target.partial" | Out-Null
Assert-Exit "copiar el respaldo"
docker compose exec -T postgres rm -f $inside
if (-not (Test-Path "$target.partial") -or (Get-Item "$target.partial").Length -eq 0) {
  Stop-Backup "el respaldo quedo vacio: $target.partial"
}
Move-Item -Force "$target.partial" $target
$sizeMb = [math]::Round((Get-Item $target).Length / 1MB, 2)
Write-Step "Respaldo listo: $target ($sizeMb MB)"

# Keep the newest $Keep backups of this database. The names sort by date.
$backups = @(Get-ChildItem -Path $Dir -File |
  Where-Object { $_.Name -match "^$Db-\d{8}-\d{6}\.dump$" } |
  Sort-Object Name)
$excess = $backups.Count - $Keep
for ($i = 0; $i -lt $excess; $i++) {
  Write-Step "Borrando el respaldo viejo $($backups[$i].Name)"
  Remove-Item -Force $backups[$i].FullName
}
