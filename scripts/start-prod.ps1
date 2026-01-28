$ErrorActionPreference = "Stop"

# Always run from repo root (where package.json exists)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (!(Test-Path ".\package.json")) {
  throw "package.json not found at repo root: $root"
}

Write-Host "Starting production server from: $root" -ForegroundColor Cyan
npm run start
