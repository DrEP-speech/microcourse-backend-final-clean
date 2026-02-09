<# scripts/normalize-server-mounts.ps1
   Removes the duplicate AUTO-MOUNT block if present in server.js.
#>
param(
  [Parameter(Mandatory=$false)]
  [string]$ServerPath = ".\server.js"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ServerPath)) {
  Write-Host "❌ server.js not found at $ServerPath" -ForegroundColor Red
  exit 1
}

$src = Get-Content -LiteralPath $ServerPath -Raw

$begin = [regex]::Escape("// --- BEGIN AUTO-MOUNT ---")
$end   = [regex]::Escape("// --- END AUTO-MOUNT ---")

if ($src -match "$begin[\s\S]*?$end") {
  $bak = "$ServerPath.bak.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
  Copy-Item -LiteralPath $ServerPath -Destination $bak -Force

  $patched = [regex]::Replace($src, "$begin[\s\S]*?$end\s*", "")
  Set-Content -LiteralPath $ServerPath -Value $patched -Encoding utf8

  Write-Host "✅ Removed AUTO-MOUNT block from server.js (backup: $bak)" -ForegroundColor Green
} else {
  Write-Host "✅ No AUTO-MOUNT block found (nothing to remove)." -ForegroundColor Green
}