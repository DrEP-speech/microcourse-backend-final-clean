param(
  [string]$Collection = "Microcourse_Auth_AllEnvs_withFlow.postman_collection.json",
  [string]$EnvFile    = "Microcourse_AllEnvs.postman_environment.json",
  [string]$DataFile   = "postman_runner_data.csv"
)

$ErrorActionPreference = 'Stop'

# Resolve paths: prefer current dir, else script dir
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$CWD = Get-Location

if (!(Test-Path (Join-Path $CWD $Collection))) { $Collection = Join-Path $ScriptDir $Collection }
if (!(Test-Path (Join-Path $CWD $EnvFile)))    { $EnvFile    = Join-Path $ScriptDir $EnvFile }
if (!(Test-Path (Join-Path $CWD $DataFile)))   { $DataFile   = Join-Path $ScriptDir $DataFile }

Write-Host "Collection: $Collection"
Write-Host "Environment: $EnvFile"
Write-Host "Data: $DataFile"

# Install newman if missing
if (-not (Get-Command newman -ErrorAction SilentlyContinue)) {
  Write-Host "Installing newman..."
  npm install -g newman
}

# Install htmlextra reporter if missing
try { newman --version | Out-Null } catch { throw $_ }
try { node -e "require('newman-reporter-htmlextra')" } catch { npm i -g newman-reporter-htmlextra }

newman run $Collection `
  --environment $EnvFile `
  --iteration-data $DataFile `
  --reporters cli,htmlextra `
  --reporter-htmlextra-export newman-report.html `
  --reporter-htmlextra-title "Microcourse Auth Monitor"

Write-Host "Done. Report: newman-report.html"
