$ErrorActionPreference = "Stop"

$api = "http://localhost:4000/api"

Write-Host "== Health =="
Invoke-RestMethod "$api/health" | ConvertTo-Json

Write-Host "`n== Login as instructor =="
$login = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType "application/json" -Body (@{
  email="instructor@example.com"
  password="Passw0rd!"
} | ConvertTo-Json)

$token = $login.token
if (-not $token) { throw "No token returned from login. Response: $($login | ConvertTo-Json -Depth 10)" }

$headers = @{ Authorization = "Bearer $token" }

Write-Host "`n== Create course (requires instructor token) =="
$payload = @{
  title="Smoke Test Course"
  description="Created by smoke test"
  status="published"
  slug="smoke-test-course"
}

Invoke-RestMethod -Method Post -Uri "$api/courses" -Headers $headers -ContentType "application/json" -Body ($payload | ConvertTo-Json) |
  ConvertTo-Json -Depth 10

Write-Host "`n✅ Smoke test done."
