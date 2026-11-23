<#
.SYNOPSIS
  One-command local demo (T31): Postgres + backend (profiles dev,demo) + frontend, then opens the
  browser and prints the fictitious demo users. Each run recreates the `gestor_demo` database so
  the demo dates start from today; the development database is not touched. Ctrl+C stops backend
  and frontend; Postgres keeps running (stop it with `docker compose down`).

.PARAMETER Local
  Serve on localhost only, with Secure cookies as in production. Without it the app is also
  served on the LAN IP so a phone on the same Wi-Fi can open it (ADR-0029).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\demo.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\demo.ps1 -Local
#>
param([switch]$Local)

# Output is ASCII on purpose: Windows PowerShell 5.1 reads BOM-less scripts as ANSI.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$BackendPort = 8081
$FrontendPort = 5173
$LogDir = Join-Path $Root ".demo-logs"
$LoginPath = "/ingresar?estudio=estudio-demo"
$DemoDb = "gestor_demo"

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }

function Stop-Demo([string]$Message) {
  Write-Host "Error: $Message" -ForegroundColor Red
  exit 1
}

function Assert-Command([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { Stop-Demo "falta '$Name'. $Hint" }
}

function Test-PortInUse([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect("localhost", $Port); return $true } catch { return $false } finally { $client.Close() }
}

# The seeder creates the users once, so later runs must reuse the same password: it is taken from
# the environment or .env, or generated and saved in .env.
function Get-DemoPassword {
  if ($env:DEMO_PASSWORD) { return $env:DEMO_PASSWORD }
  $envFile = Join-Path $Root ".env"
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^DEMO_PASSWORD=.+' } | Select-Object -Last 1
    if ($line) { return $line.Substring("DEMO_PASSWORD=".Length) }
  } else {
    Copy-Item (Join-Path $Root ".env.example") $envFile
  }
  $alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  $bytes = New-Object byte[] 20
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $generated = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
  Add-Content -Path $envFile -Value "", "DEMO_PASSWORD=$generated" -Encoding ASCII
  return $generated
}

# IPv4 of the interface that holds the default route (skips Docker/WSL virtual adapters).
function Get-LanIp {
  try {
    $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Sort-Object RouteMetric | Select-Object -First 1
    return (Get-NetIPAddress -InterfaceIndex $route.ifIndex -AddressFamily IPv4 | Select-Object -First 1).IPAddress
  } catch {
    return $null
  }
}

function Wait-Http([string]$Name, [string]$Url, $Process, [int]$Seconds, [string]$Contains = "") {
  Write-Step "Esperando $Name ($Url)..."
  for ($i = 0; $i -lt $Seconds; $i++) {
    if ($Process.HasExited) { Stop-Demo "$Name termino con error. Mira $LogDir\$Name.log" }
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.Content -like "*$Contains*") { return }
    } catch {
      # Not up yet.
    }
    Start-Sleep -Seconds 1
  }
  Stop-Demo "$Name no respondio en $Seconds s. Mira $LogDir\$Name.log"
}

function Stop-Tree($Process) {
  if ($Process -and -not $Process.HasExited) {
    taskkill /T /F /PID $Process.Id 2>&1 | Out-Null
  }
}

# --- Checks -------------------------------------------------------------------------------------
Assert-Command docker "Instala Docker Desktop."
Assert-Command node "Instala Node 22.12 o superior."
Assert-Command java "Instala un JDK 21 o superior."
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Stop-Demo "Docker no esta corriendo. Abri Docker Desktop y proba de nuevo." }
if (Test-PortInUse $BackendPort) { Stop-Demo "el puerto $BackendPort esta ocupado (quedo un backend corriendo?)." }
if (Test-PortInUse $FrontendPort) { Stop-Demo "el puerto $FrontendPort esta ocupado (quedo un frontend corriendo?)." }

$password = Get-DemoPassword
if ($password.Length -lt 12) { Stop-Demo "DEMO_PASSWORD tiene que tener al menos 12 caracteres." }

$viteArgs = @("--prefix", "frontend", "run", "dev")
if (-not $Local) { $viteArgs += @("--", "--host", "0.0.0.0") }

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$backend = $null
$frontend = $null
$savedEnv = @{}
foreach ($name in "DEMO_PASSWORD", "SPRING_PROFILES_ACTIVE", "SERVER_SERVLET_SESSION_COOKIE_SECURE", "DB_URL") {
  $savedEnv[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

try {
  $env:DEMO_PASSWORD = $password
  $env:SPRING_PROFILES_ACTIVE = "dev,demo"
  if (-not $Local) {
    # Phones reach the app over plain HTTP on the LAN IP, where browsers drop Secure cookies.
    # Demo only, with fictitious data (ADR-0029); -Local keeps them Secure.
    $env:SERVER_SERVLET_SESSION_COOKIE_SECURE = "false"
  }

  # --- Start ------------------------------------------------------------------------------------
  Write-Step "Levantando PostgreSQL en localhost:5434"
  docker compose up -d --wait postgres
  if ($LASTEXITCODE -ne 0) { Stop-Demo "no se pudo levantar PostgreSQL." }

  # Demo dates are relative to the day of the first seed (ADR-0028), so every run starts from a
  # fresh database of its own; the development database is left alone. No inner double quotes:
  # Windows PowerShell 5.1 drops them when calling native programs.
  Write-Step "Recreando la base $DemoDb con datos ficticios de hoy"
  docker compose exec -T postgres sh -c "psql -v ON_ERROR_STOP=1 -q -U `$POSTGRES_USER -d postgres -c 'DROP DATABASE IF EXISTS $DemoDb WITH (FORCE)' -c 'CREATE DATABASE $DemoDb'"
  if ($LASTEXITCODE -ne 0) { Stop-Demo "no se pudo recrear la base $DemoDb." }
  $env:DB_URL = "jdbc:postgresql://localhost:5434/$DemoDb"

  Write-Step "Levantando el backend en :$BackendPort (perfiles dev,demo; la primera vez tarda)"
  $backend = Start-Process -FilePath (Join-Path $Root "backend\mvnw.cmd") `
    -ArgumentList "-B", "-q", "spring-boot:run" -WorkingDirectory (Join-Path $Root "backend") `
    -RedirectStandardOutput "$LogDir\backend.log" -RedirectStandardError "$LogDir\backend.err.log" `
    -NoNewWindow -PassThru

  if (-not (Test-Path (Join-Path $Root "frontend\node_modules"))) {
    Write-Step "Instalando dependencias del frontend (npm ci)"
    npm --prefix frontend ci
    if ($LASTEXITCODE -ne 0) { Stop-Demo "fallo npm ci." }
  }

  Write-Step "Levantando el frontend en :$FrontendPort"
  $frontend = Start-Process -FilePath "npm.cmd" -ArgumentList $viteArgs -WorkingDirectory $Root `
    -RedirectStandardOutput "$LogDir\frontend.log" -RedirectStandardError "$LogDir\frontend.err.log" `
    -NoNewWindow -PassThru

  Wait-Http "backend" "http://localhost:$BackendPort/actuator/health" $backend 300 '"UP"'
  Wait-Http "frontend" "http://localhost:$FrontendPort/" $frontend 60

  $localUrl = "http://localhost:$FrontendPort"
  Start-Process "$localUrl$LoginPath"

  # --- Summary ----------------------------------------------------------------------------------
  Write-Host ""
  Write-Host "Demo lista. Datos 100% ficticios." -ForegroundColor Green
  Write-Host ""
  Write-Host "  En esta compu:   $localUrl"
  if (-not $Local) {
    $ip = Get-LanIp
    if ($ip) {
      Write-Host "  En el celular:   http://${ip}:$FrontendPort$LoginPath"
      Write-Host "                   (misma red Wi-Fi; si no carga, permiti Node en el firewall)"
    } else {
      Write-Host "  En el celular:   no pude detectar la IP de la red (ipconfig)."
    }
  }
  Write-Host ""
  Write-Host "  Estudio:  estudio-demo"
  Write-Host "  Clave:    $password   (la misma para todos; esta en .env)"
  Write-Host ""
  Write-Host "  Usuarios (backend/src/main/java/ar/gestorpenal/demo/DemoData.java):"
  Write-Host "    lucia.ejemplo@example.com     titular"
  Write-Host "    martin.prueba@example.com     abogado"
  Write-Host "    julian.muestra@example.com    abogado"
  Write-Host "    sofia.ficticia@example.com    procuradora"
  Write-Host ""
  Write-Host "  Logs: .demo-logs\   -   Ctrl+C para detener."

  while (-not $backend.HasExited -and -not $frontend.HasExited) { Start-Sleep -Seconds 2 }
  Stop-Demo "el backend o el frontend se detuvo. Mira los logs en .demo-logs\"
} finally {
  Write-Host ""
  Write-Step "Deteniendo backend y frontend (Postgres sigue corriendo: docker compose down)"
  Stop-Tree $frontend
  Stop-Tree $backend
  foreach ($name in $savedEnv.Keys) {
    [Environment]::SetEnvironmentVariable($name, $savedEnv[$name], "Process")
  }
}
