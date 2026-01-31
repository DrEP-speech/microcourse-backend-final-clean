Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\Invoke-Api.ps1"

$base = "http://localhost:4000"

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "student+$stamp@example.com"
$pass  = "Password123!"
$name  = "Smoke Student $stamp"

Write-Host "Registering: $email" -ForegroundColor Cyan

$regBody = @{
  email = $email
  password = $pass
  name = $name
  role = "student"
} | ConvertTo-Json -Depth 10

try {
  $reg = Invoke-Api -Method POST -Url "$base/api/auth/register" -JsonBody $regBody
  $reg | ConvertTo-Json -Depth 10
} catch {
  Write-Host $_ -ForegroundColor Yellow
}

Write-Host "Logging in: $email" -ForegroundColor Cyan

$loginBody = @{
  email = $email
  password = $pass
} | ConvertTo-Json -Depth 10

$login = Invoke-Api -Method POST -Url "$base/api/auth/login" -JsonBody $loginBody
$login | ConvertTo-Json -Depth 10

$token = $null
if ($login.PSObject.Properties.Name -contains "token") { $token = $login.token }
if (-not $token -and ($login.PSObject.Properties.Name -contains "data") -and $login.data) {
  if ($login.data.PSObject.Properties.Name -contains "token") { $token = $login.data.token }
}
if (-not $token -and ($login.PSObject.Properties.Name -contains "accessToken")) { $token = $login.accessToken }

if (-not $token) { throw "Token not found in login response." }

$h = @{ Authorization = "Bearer $token" }

Write-Host "
=== /api/auth/me ===" -ForegroundColor Cyan
Invoke-Api -Method GET -Url "$base/api/auth/me" -Headers $h | ConvertTo-Json -Depth 10

Write-Host "
=== /api/progress/me ===" -ForegroundColor Cyan
Invoke-Api -Method GET -Url "$base/api/progress/me" -Headers $h | ConvertTo-Json -Depth 10

Write-Host "
=== /api/dashboard ===" -ForegroundColor Cyan
Invoke-Api -Method GET -Url "$base/api/dashboard" -Headers $h | ConvertTo-Json -Depth 10

Write-Host "
✅ Auth smoke complete." -ForegroundColor Green