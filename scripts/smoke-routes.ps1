Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_lib.ps1"

$base = "http://localhost:4000"

Write-Host "`n=== ROUTES SMOKE ===" -ForegroundColor Cyan
try {
  $r = Invoke-RestMethod -Method GET -Uri "$base/api/_routes"
  $r | ConvertTo-Json -Depth 10
} catch {
  Write-Host "Failed to hit /api/_routes. Is server running?" -ForegroundColor Red
  throw
}
