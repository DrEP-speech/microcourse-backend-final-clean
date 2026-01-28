$ErrorActionPreference = "Stop"

# resolve port
$port = 10003
if (Test-Path ".env") {
  $ln = (Get-Content .env) | Where-Object { $_ -match "^\s*PORT\s*=" } | Select-Object -First 1
  if ($ln) { $port = [int]($ln -split "=")[1].Trim() }
}
$BASE = "http://127.0.0.1:$port"
$AUTH = "$BASE/api/auth"

function say([string]$t){ Write-Host "`n== $t ==" -ForegroundColor Cyan }

say "health"
Invoke-RestMethod "$BASE/ping" | ConvertTo-Json

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$body = @{ email = "owner@example.com"; password = "ChangeMe123?" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$AUTH/login" -ContentType "application/json" -Body $body -WebSession $session

$H = @{ Authorization = "Bearer $($login.token)" }

say "whoami"
Invoke-RestMethod -Uri "$AUTH/whoami" -Headers $H | ConvertTo-Json

say "admin/ping"
Invoke-RestMethod -Uri "$AUTH/admin/ping" -Headers $H | ConvertTo-Json

say "refresh"
Invoke-RestMethod -Method Post -Uri "$AUTH/refresh" -WebSession $session | ConvertTo-Json

