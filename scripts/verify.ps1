Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "=== Verify ===" -ForegroundColor Cyan

# Minimal “don’t lie to me” checks:
if (-not (Test-Path .\package.json)) { throw "package.json missing" }
if (-not (Test-Path .\server.js)) { throw "server.js missing" }

# Optional: show scripts keys so you can visually confirm
node -e "const p=require('./package.json'); console.log('scripts:', Object.keys(p.scripts||{}).join(', '));"

Write-Host "Verify OK" -ForegroundColor Green
