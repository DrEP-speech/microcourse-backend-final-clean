Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "lib.ps1")
. (Join-Path $PSScriptRoot "Invoke-Api.ps1")

Write-Section "CONFIG"
$base = $env:BASE_URL
if (-not $base) { $base = "http://localhost:4000" }
Write-Host "BASE_URL = $base" -ForegroundColor Gray

Write-Section "REGISTER"
$registerBody = @{
  name     = "Test Student"
  email    = ("student{0}@example.com" -f (Get-Random))
  password = "Passw0rd!"
  role     = "student"
}

$reg = Invoke-Api -Method POST -Url "$base/api/auth/register" -JsonBody $registerBody
$regDump = Save-Dump -Name "register" -Object $reg
Write-Host "register dump: $regDump" -ForegroundColor DarkGray

Write-Section "LOGIN"
$loginBody = @{
  email    = $registerBody.email
  password = $registerBody.password
}
$login = Invoke-Api -Method POST -Url "$base/api/auth/login" -JsonBody $loginBody
$loginDump = Save-Dump -Name "login" -Object $login
Write-Host "login dump: $loginDump" -ForegroundColor DarkGray

$token = $login.token
if (-not $token) { throw "Login did not return token. See: $loginDump" }
$authHeaders = @{ Authorization = "Bearer $token" }

Write-Section "DASHBOARD"
$dash = Invoke-Api -Method GET -Url "$base/api/dashboard" -Headers $authHeaders
$dashDump = Save-Dump -Name "dashboard" -Object $dash
Write-Host "dashboard dump: $dashDump" -ForegroundColor DarkGray

Write-Host "E2E PASS" -ForegroundColor Green