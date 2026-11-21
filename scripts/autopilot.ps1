<#
.SYNOPSIS
  Runs the autonomous loop: one ROADMAP task per Claude Code headless run, until nothing is
  ready, a task is blocked, or the usage limit is reached.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\autopilot.ps1 -MaxTasks 5
#>
param(
  [int]$MaxTasks = 10,
  [string]$Model = "opus",
  [int]$PauseSeconds = 20
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force -Path ".agent-logs" | Out-Null

if ($env:ANTHROPIC_API_KEY) {
  Write-Error "ANTHROPIC_API_KEY is set. Remove it: this project uses the Claude subscription."
  exit 1
}

for ($i = 1; $i -le $MaxTasks; $i++) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $log = ".agent-logs\autopilot-$stamp.log"
  Write-Host "[$i/$MaxTasks] Running /next-task (log: $log)" -ForegroundColor Cyan

  # Windows PowerShell 5.1 turns native stderr lines into ErrorRecords under 2>&1; with
  # ErrorActionPreference=Stop a harmless warning from claude would abort the loop.
  $ErrorActionPreference = "Continue"
  claude -p "/next-task" --model $Model --fallback-model sonnet --permission-mode dontAsk 2>&1 |
    ForEach-Object { "$_" } | Tee-Object -FilePath $log
  $ErrorActionPreference = "Stop"
  $out = Get-Content $log -Raw

  # Markers are matched only at the start of a line, and the usage-limit check runs only when
  # no marker was printed: a task summary that mentions "rate limit" (e.g. login throttling)
  # must not stop the loop.
  if ($out -match "(?m)^NO_READY_TASKS") { Write-Host "Nothing ready: waiting on a gate or a blocked task." -ForegroundColor Yellow; break }
  if ($out -match "(?m)^TASK_BLOCKED")   { Write-Host "A task is blocked. See the draft PR." -ForegroundColor Yellow; break }
  if ($out -notmatch "(?m)^TASK_DONE") {
    if ($out -match "(?i)usage limit|rate limit|limit reached") { Write-Host "Usage limit reached. Run again later." -ForegroundColor Yellow }
    else { Write-Host "Run ended without TASK_DONE. Check $log." -ForegroundColor Red }
    break
  }

  Start-Sleep -Seconds $PauseSeconds
}
Write-Host "Autopilot finished." -ForegroundColor Green
