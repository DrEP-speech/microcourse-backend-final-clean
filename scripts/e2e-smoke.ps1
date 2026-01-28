Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Say($msg){ Write-Host $msg -ForegroundColor Cyan }
function Good($msg){ Write-Host "[OK]  $msg" -ForegroundColor Green }
function Bad($msg){ Write-Host "[FAIL] $msg" -ForegroundColor Red; exit 1 }
function WarnMsg($msg){ Write-Host "[WARN] $msg" -ForegroundColor Yellow }

# --- Load env (process-level vars) ---
$repoRoot = (Resolve-Path ".").Path
$loadEnv = Join-Path $repoRoot "scripts\load-env.ps1"
if (Test-Path $loadEnv) {
  & $loadEnv | Out-Null
  Good "Loaded env via scripts\load-env.ps1"
} else {
  WarnMsg "scripts\load-env.ps1 not found. Continuing with existing env vars."
}

# --- Optional: load shared helpers if you have them (Ok/Warn/Die/http wrappers) ---
$httpHelpers = Join-Path $repoRoot "scripts\_http.ps1"
if (Test-Path $httpHelpers) {
  . $httpHelpers
  Good "Loaded scripts\_http.ps1 helpers"
}

# --- Base URL ---
$base = $env:API_BASE
if ([string]::IsNullOrWhiteSpace($base)) { $base = "http://localhost:4000/api" }
$base = $base.TrimEnd("/")

Say "API_BASE = $base"

# --- Seed creds ---
$email = $env:SEED_STUDENT_EMAIL
$pw    = $env:SEED_STUDENT_PASSWORD

if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($pw)) {
  Bad "Missing SEED_STUDENT_EMAIL or SEED_STUDENT_PASSWORD. Run: .\scripts\load-env.ps1"
}

# --- Health check ---
try {
  $health = Invoke-RestMethod -Method Get -Uri "$base/health" -TimeoutSec 15
  Good "Health OK: $($health | ConvertTo-Json -Compress)"
} catch {
  Bad "Health failed at $base/health : $($_.Exception.Message)"
}

# --- Login ---
$loginEndpoints = @(
  "$base/auth/login",
  "$base/login",
  "$base/auth/signin"
)

$token = $null
$loginResp = $null
$usedLogin = $null

foreach ($ep in $loginEndpoints) {
  try {
    $payloadObj = @{ email = $email; password = $pw }
    $payload = ($payloadObj | ConvertTo-Json -Compress)

    Say "Trying login: POST $ep"
    $loginResp = Invoke-RestMethod -Method Post -Uri $ep -ContentType "application/json" -Body $payload -TimeoutSec 20
    $usedLogin = $ep

    # Token extraction (covers common response shapes)
    if ($loginResp.token) { $token = $loginResp.token }
    elseif ($loginResp.accessToken) { $token = $loginResp.accessToken }
    elseif ($loginResp.data -and $loginResp.data.token) { $token = $loginResp.data.token }
    elseif ($loginResp.data -and $loginResp.data.accessToken) { $token = $loginResp.data.accessToken }
    elseif ($loginResp.jwt) { $token = $loginResp.jwt }

    if ($token) { break }

    # If login succeeded but token missing, still show response
    WarnMsg "Login responded but no token field found. Response: $($loginResp | ConvertTo-Json -Depth 6 -Compress)"
  } catch {
    WarnMsg "Login failed at $ep : $($_.Exception.Message)"
  }
}

if (-not $token) {
  Bad "Could not authenticate. Last response: $($loginResp | ConvertTo-Json -Depth 6 -Compress)"
}

Good "Authenticated via $usedLogin (token length: $($token.Length))"

$headers = @{ Authorization = "Bearer $token" }

# --- Probe protected endpoints (succeed if any one returns 200) ---
$protected = @(
  "$base/courses",
  "$base/quizzes",
  "$base/results",
  "$base/users/me",
  "$base/profile"
)

$anyOk = $false
foreach ($p in $protected) {
  try {
    Say "GET $p"
    $resp = Invoke-RestMethod -Method Get -Uri $p -Headers $headers -TimeoutSec 20
    Good "Protected OK: $p"
    $anyOk = $true

    # quick peek (don’t spam)
    $json = ($resp | ConvertTo-Json -Depth 4 -Compress)
    if ($json.Length -gt 500) { $json = $json.Substring(0,500) + "..." }
    Say "Sample: $json"
    break
  } catch {
    WarnMsg "Protected failed: $p : $($_.Exception.Message)"
  }
}

if (-not $anyOk) {
  Bad "Authenticated, but none of the protected endpoints responded OK. This means your API paths differ. We'll align next."
}

Good "E2E smoke finished: server up + auth works + protected GET verified."
