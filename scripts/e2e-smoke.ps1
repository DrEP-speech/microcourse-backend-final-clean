# scripts/e2e-smoke.ps1
# Purpose: "consumer-ready discipline" — verify health/ready contracts, fail fast, leave artifacts.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host ("=== " + $Title + " ===") -ForegroundColor Cyan
}

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
}

function Save-JsonUtf8NoBom([string]$Path, $Obj) {
  $dir = Split-Path $Path -Parent
  if ($dir) { Ensure-Dir $dir }
  $json = $Obj | ConvertTo-Json -Depth 50
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

function Invoke-ApiJson {
  param(
    [Parameter(Mandatory=$true)][string]$Url
  )
  try {
    return Invoke-RestMethod -Method GET -Uri $Url -TimeoutSec 15
  } catch {
    $msg = $_.Exception.Message
    throw "GET $Url failed: $msg"
  }
}

function Assert-HttpOk([string]$Url) {
  try {
    $r = Invoke-WebRequest -Method GET -Uri $Url -TimeoutSec 15 -UseBasicParsing
    if ($r.StatusCode -lt 200 -or $r.StatusCode -ge 300) {
      throw "Non-2xx status: $($r.StatusCode)"
    }
  } catch {
    throw "HTTP check failed for $Url :: $($_.Exception.Message)"
  }
}

# --- Config ---
$BaseUrl = $env:API_BASE_URL
if (-not $BaseUrl) { $BaseUrl = "http://localhost:4000" }

$ArtifactsDir = Join-Path $PSScriptRoot "contract\artifacts"
$SchemasDir   = Join-Path $PSScriptRoot "contract\schemas"
$Validator    = Join-Path $PSScriptRoot "contract\validate-contract.mjs"

$HealthUrl = "$BaseUrl/healthz"
$ReadyUrl  = "$BaseUrl/readyz"

Write-Section "Preflight"
Write-Host "Base URL: $BaseUrl"
Ensure-Dir $ArtifactsDir

Write-Section "HTTP Liveness"
Assert-HttpOk $HealthUrl

Write-Section "Fetch JSON + Write Artifacts"
$health = Invoke-ApiJson -Url $HealthUrl
$ready  = Invoke-ApiJson -Url $ReadyUrl

Save-JsonUtf8NoBom (Join-Path $ArtifactsDir "healthz.json") $health
Save-JsonUtf8NoBom (Join-Path $ArtifactsDir "readyz.json")  $ready

Write-Host "Saved: scripts/contract/artifacts/healthz.json"
Write-Host "Saved: scripts/contract/artifacts/readyz.json"

Write-Section "Contract Validation (AJV)"
if (-not (Test-Path $Validator)) { throw "Missing validator: $Validator" }

$healthSchema = Join-Path $SchemasDir "healthz.schema.json"
$readySchema  = Join-Path $SchemasDir "readyz.schema.json"

if (-not (Test-Path $healthSchema)) { throw "Missing schema: $healthSchema" }
if (-not (Test-Path $readySchema))  { throw "Missing schema: $readySchema" }

node $Validator $healthSchema (Join-Path $ArtifactsDir "healthz.json")
node $Validator $readySchema  (Join-Path $ArtifactsDir "readyz.json")

Write-Section "Readiness Semantics"
# Hard truth: "ready" must be true for consumer-grade expectations.
if ($ready.ready -ne $true) {
  throw "READY FAIL: /readyz returned ready=false (db or dependencies not ready). See scripts/contract/artifacts/readyz.json"
}

Write-Host ""
Write-Host "✅ SMOKE PASS: health + ready + contracts valid" -ForegroundColor Green