<#
.SYNOPSIS
  Restore of a backup made by scripts\backup.ps1 or backup.sh (T64). Same behavior as
  scripts/restore.sh. See docs/OPERATIONS.md.

  It loads the backup into a new database and, only when that worked, swaps it in: the current
  database is kept as <db>_previa (replacing the one of the previous restore), so a failed or
  mistaken restore loses nothing. Stop the backend first: its connections are closed.

.PARAMETER File
  The backup file (.dump).
.PARAMETER Db
  Database to replace. Default: $env:DB_NAME or gestor_causas.
.PARAMETER Yes
  Do not ask for confirmation (scripts only).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\restore.ps1 backups\gestor_causas-20261127-230000.dump
#>
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$File,
  [string]$Db = "",
  [switch]$Yes
)

# Output is ASCII on purpose: Windows PowerShell 5.1 reads BOM-less scripts as ANSI.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

# DB_NAME from the environment, else its last value in .env (as docker compose reads it).
if (-not $Db) { $Db = $env:DB_NAME }
$envFile = Join-Path $Root ".env"
if (-not $Db -and (Test-Path $envFile)) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^DB_NAME=.+" } | Select-Object -Last 1
  if ($line) { $Db = $line.Substring("DB_NAME=".Length).Trim() }
}
if (-not $Db) { $Db = "gestor_causas" }

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Stop-Restore([string]$Message) { Write-Host "Error: $Message" -ForegroundColor Red; exit 1 }

function Invoke-Quiet([scriptblock]$Command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Command *> $null } finally { $ErrorActionPreference = $previous }
  return $LASTEXITCODE
}

# Runs one SQL statement as the compose superuser on the maintenance database. The SQL goes in
# through stdin: Windows PowerShell 5.1 mangles quotes in native arguments.
function Invoke-Sql([string]$Sql) {
  $output = $Sql | docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -q -tA -U $POSTGRES_USER -d postgres'
  if ($LASTEXITCODE -ne 0) { Stop-Restore "psql fallo: $Sql" }
  return "$output".Trim()
}

# Like Invoke-Sql, but returns whether it worked instead of stopping.
function Test-Sql([string]$Sql) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { $Sql | docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -q -tA -U $POSTGRES_USER -d postgres' *> $null }
  finally { $ErrorActionPreference = $previous }
  return $LASTEXITCODE -eq 0
}

if (-not (Test-Path -LiteralPath $File -PathType Leaf) -or (Get-Item -LiteralPath $File).Length -eq 0) {
  Stop-Restore "no existe o esta vacio: $File"
}
$File = (Resolve-Path -LiteralPath $File).Path
# Validated, so it is safe inside the SQL below (identifiers cannot be bound as parameters).
if ($Db -cnotmatch '^[a-z_][a-z0-9_]{0,50}$') { Stop-Restore "nombre de base invalido: $Db (minusculas, numeros y _)" }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Stop-Restore "falta Docker." }
if ((Invoke-Quiet { docker info }) -ne 0) { Stop-Restore "Docker no esta corriendo. Abri Docker Desktop." }
Set-Location $Root

$staging = "${Db}_restaurando"
$previousDb = "${Db}_previa"
$fileName = Split-Path $File -Leaf

if (-not $Yes) {
  Write-Host "Vas a reemplazar la base $Db con $fileName."
  Write-Host "La actual queda guardada como $previousDb. Cerra el backend antes de seguir."
  $answer = Read-Host "Para confirmar, escribi el nombre de la base ($Db)"
  if ($answer -cne $Db) { Stop-Restore "no coincide: no se restauro nada." }
}

docker compose up -d --wait postgres
if ($LASTEXITCODE -ne 0) { Stop-Restore "no se pudo levantar PostgreSQL." }
$inside = "/tmp/restore-$PID.dump"
docker compose cp $File "postgres:$inside" | Out-Null
if ($LASTEXITCODE -ne 0) { Stop-Restore "no se pudo copiar el respaldo al contenedor." }

Write-Step "Cargando el respaldo en una base nueva ($staging)"
Invoke-Sql "DROP DATABASE IF EXISTS $staging WITH (FORCE)" | Out-Null
Invoke-Sql "CREATE DATABASE $staging" | Out-Null
docker compose exec -T postgres sh -c "pg_restore -U `$POSTGRES_USER -d $staging --no-owner --exit-on-error $inside"
$restored = $LASTEXITCODE -eq 0
docker compose exec -T postgres rm -f $inside
if (-not $restored) {
  Invoke-Sql "DROP DATABASE IF EXISTS $staging WITH (FORCE)" | Out-Null
  Stop-Restore "el respaldo no se pudo cargar. La base $Db quedo como estaba."
}

Write-Step "Reemplazando $Db (la actual queda como $previousDb)"
if ((Invoke-Sql "SELECT count(*) FROM pg_database WHERE datname = '$Db'") -eq "1") {
  # No new connections while the current ones close; closing is asynchronous, so the rename is
  # retried for a few seconds.
  Invoke-Sql "ALTER DATABASE $Db WITH ALLOW_CONNECTIONS false" | Out-Null
  Invoke-Sql "DROP DATABASE IF EXISTS $previousDb WITH (FORCE)" | Out-Null
  $renamed = $false
  for ($attempt = 0; $attempt -lt 10 -and -not $renamed; $attempt++) {
    Invoke-Sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$Db'" | Out-Null
    $renamed = Test-Sql "ALTER DATABASE $Db RENAME TO $previousDb"
    if (-not $renamed) { Start-Sleep -Seconds 1 }
  }
  if (-not $renamed) {
    Invoke-Sql "ALTER DATABASE $Db WITH ALLOW_CONNECTIONS true" | Out-Null
    Stop-Restore "algo sigue conectado a ${Db}: quedo como estaba. Los datos restaurados estan en $staging; cerra el backend y proba de nuevo."
  }
  Invoke-Sql "ALTER DATABASE $previousDb WITH ALLOW_CONNECTIONS true" | Out-Null
}
Invoke-Sql "ALTER DATABASE $staging RENAME TO $Db" | Out-Null
Write-Step "Listo: $Db tiene los datos de $fileName. Ya podes arrancar el backend."
