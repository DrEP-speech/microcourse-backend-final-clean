Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-PackageManager {
  if (Test-Path ".\pnpm-lock.yaml") { return "pnpm" }
  if (Test-Path ".\yarn.lock")      { return "yarn" }
  return "npm"
}

function Read-PackageJson {
  if (!(Test-Path ".\package.json")) { throw "package.json not found. Run this from repo root." }
  return (Get-Content ".\package.json" -Raw | ConvertFrom-Json)
}

function Has-Script($pkg, [string]$name) {
  if ($null -eq $pkg.scripts) { return $false }
  # StrictMode-safe: property existence check (no throwing)
  return ($pkg.scripts.PSObject.Properties.Name -contains $name)
}

function Run-Cmd([string]$cmd, [string[]]$argv) {
  Write-Host "`n==> $cmd $($argv -join ' ')" -ForegroundColor Cyan
  & $cmd @argv
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $cmd $($argv -join ' ')" }
}

function Run-Script($pm, [string]$scriptName) {
  switch ($pm) {
    "pnpm" { Run-Cmd "pnpm" @("run","-s",$scriptName) }
    "yarn" { Run-Cmd "yarn" @($scriptName) }
    default { Run-Cmd "npm" @("run","-s",$scriptName) }
  }
}

function Install-Deps($pm) {
  if ($pm -eq "pnpm") { Run-Cmd "pnpm" @("install","--frozen-lockfile"); return }
  if ($pm -eq "yarn") { Run-Cmd "yarn" @("install","--immutable"); return }

  if (Test-Path ".\package-lock.json") { Run-Cmd "npm" @("ci") }
  else { Run-Cmd "npm" @("install") }
}

function Invoke-Gate {
  param([switch]$SkipInstall)

  $pm  = Get-PackageManager
  $pkg = Read-PackageJson

  Write-Host "Package manager: $pm" -ForegroundColor DarkGray

  if (-not $SkipInstall) { Install-Deps $pm }

  # Run only scripts that exist (no guessing).
  $steps = @("lint","typecheck","test","build")
  foreach ($s in $steps) {
    if (Has-Script $pkg $s) { Run-Script $pm $s }
    else { Write-Host "Skipping '$s' (no script in package.json)" -ForegroundColor DarkGray }
  }

  Write-Host "`n✅ GATE PASSED (install/lint/typecheck/test/build as available)." -ForegroundColor Green
}

Invoke-Gate @args
