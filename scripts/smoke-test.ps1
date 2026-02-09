. "$PSScriptRoot\ps_utils.ps1"

$base = Get-BaseUrl

Write-Section "Smoke: server reachable"
$r = Invoke-Api -Method "GET" -Url "$base/health" -ExpectedStatus @(200)
Write-Ok "GET /health => $($r.Status)"

Write-Section "Smoke: auth ping"
$r = Invoke-Api -Method "GET" -Url "$base/api/auth/ping" -ExpectedStatus @(200,404)
if ($r.Status -eq 200) { Write-Ok "GET /api/auth/ping => 200" } else { Write-Warn "GET /api/auth/ping => $($r.Status) (route not mounted or changed)" }

Write-Section "Smoke: register (expected: 200/201 OR shows NOT_IMPLEMENTED)"
$email = "student_$([int][double]::Parse((Get-Date -UFormat %s)))$((Get-Random -Minimum 1000 -Maximum 9999))@example.com"
$pass  = "Passw0rd!"
$body  = @{ email=$email; password=$pass; role="student"; name="Test Student" }

$r = Invoke-Api -Method "POST" -Url "$base/api/auth/register" -Body $body -ExpectedStatus @(200,201,400,409,501)
Write-Host "POST /api/auth/register => $($r.Status)" -ForegroundColor Yellow
if ($r.Status -eq 501) { Write-Fail "Register is NOT_IMPLEMENTED. You must implement controllers/authController.js." }

Write-Section "Smoke: login (expected: 200/201 OR shows NOT_IMPLEMENTED)"
$r = Invoke-Api -Method "POST" -Url "$base/api/auth/login" -Body @{ email=$email; password=$pass } -ExpectedStatus @(200,201,400,401,501)
Write-Host "POST /api/auth/login => $($r.Status)" -ForegroundColor Yellow
if ($r.Status -eq 501) { Write-Fail "Login is NOT_IMPLEMENTED. You must implement controllers/authController.js." }

Write-Section "DONE"
