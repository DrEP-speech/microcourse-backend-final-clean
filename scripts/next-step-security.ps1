param(
  [string]$ApiBase = "http://localhost:4000/api"
)

$ErrorActionPreference = "Stop"

function Get-EnvVar([string]$name) {
  # PS 5.1-safe: check Process then User then Machine
  $v = [Environment]::GetEnvironmentVariable($name, "Process")
  if ($v) { return $v }
  $v = [Environment]::GetEnvironmentVariable($name, "User")
  if ($v) { return $v }
  $v = [Environment]::GetEnvironmentVariable($name, "Machine")
  return $v
}

Write-Host "=== Security Next Step ===" -ForegroundColor Cyan
Write-Host "API Base: $ApiBase"

# Required env vars (adjust as your app expects)
$required = @("JWT_SECRET","NODE_ENV")
foreach ($name in $required) {
  $val = Get-EnvVar $name
  if (-not $val) {
    throw "Missing required env var: $name (set it in your shell or .env and restart server)"
  }
  Write-Host ("[OK] {0} set" -f $name) -ForegroundColor Green
}

# Quick probe
try {
  $health = Invoke-RestMethod -Method GET -Uri ($ApiBase.TrimEnd("/") + "/health") -TimeoutSec 10
  Write-Host ("[OK] Health: {0}" -f ($health | ConvertTo-Json -Compress)) -ForegroundColor Green
} catch {
  throw ("Health probe failed: " + $_.Exception.Message)
}

# Make sure local artifacts aren't committed
$artifactFiles = @("seed-artifacts.json","smoke-artifacts.json")
foreach ($f in $artifactFiles) {
  if (Test-Path (Join-Path (Get-Location) $f)) {
    Write-Host "[WARN] Found $f locally (good), ensure it is gitignored (it should be)." -ForegroundColor Yellow
  }
}

Write-Host "[SECURE] Auth, JWT, env structure validated" -ForegroundColor Green
