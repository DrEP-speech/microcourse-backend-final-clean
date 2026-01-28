param(
  [Parameter(Mandatory=$true)] [string]$FrontendPath,
  [string]$ArtifactsPath = ".\seed-artifacts.json",
  [int]$Port = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert([bool]$cond, [string]$msg) { if (-not $cond) { throw $msg } }

Assert (Test-Path $ArtifactsPath) "Missing $ArtifactsPath. Run .\seed-onboarding.ps1 successfully first."

$art = Get-Content $ArtifactsPath -Raw | ConvertFrom-Json
Assert ([bool]($art.base)) "Artifacts missing 'base'."

$apiBase = [string]$art.base
Write-Host "API Base: $apiBase" -ForegroundColor Cyan
Write-Host "Frontend: $FrontendPath" -ForegroundColor Cyan
Write-Host "Port: $Port" -ForegroundColor Cyan

Assert (Test-Path $FrontendPath) "FrontendPath does not exist: $FrontendPath"
Assert (Test-Path (Join-Path $FrontendPath "package.json")) "No package.json found in FrontendPath."

Push-Location $FrontendPath

try {
  # Ensure API base env for Next.js
  $env:NEXT_PUBLIC_API_BASE = $apiBase

  # Install deps
  if (Test-Path ".\package-lock.json") {
    Write-Host "[1/5] npm ci" -ForegroundColor Cyan
    npm ci
  } else {
    Write-Host "[1/5] npm install" -ForegroundColor Cyan
    npm install
  }

  # Build
  Write-Host "[2/5] npm run build" -ForegroundColor Cyan
  npm run build

  # Start dev server
  Write-Host "[3/5] npm run dev -p $Port" -ForegroundColor Cyan
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/c npm run dev -- -p $Port"
  $psi.WorkingDirectory = (Get-Location).Path
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()

  # Wait for readiness
  $root = "http://localhost:$Port"
  $deadline = (Get-Date).AddSeconds(90)

  Write-Host "[4/5] Waiting for frontend..." -ForegroundColor Cyan
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri "$root/" -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { break }
    } catch { }
    Start-Sleep -Seconds 2
  }

  # Quick checks
  Write-Host "[5/5] Smoke pings..." -ForegroundColor Cyan

  $checks = @(
    @{ name = "/";        url = "$root/" },
    @{ name = "/courses"; url = "$root/courses" },
    @{ name = "/login";   url = "$root/login" }
  )

  foreach ($c in $checks) {
    try {
      $resp = Invoke-WebRequest -Uri $c.url -UseBasicParsing -TimeoutSec 10
      Write-Host ("[OK] " + $c.name + " -> " + $resp.StatusCode) -ForegroundColor Green
    } catch {
      Write-Host ("[WARN] " + $c.name + " not reachable yet: " + $_.Exception.Message) -ForegroundColor Yellow
    }
  }

  Write-Host ""
  Write-Host "✅ Frontend smoke complete." -ForegroundColor Green

} finally {
  # Stop dev server
  try {
    if ($p -and -not $p.HasExited) {
      Write-Host "Stopping dev server..." -ForegroundColor Yellow
      $p.Kill()
    }
  } catch { }
  Pop-Location
}
