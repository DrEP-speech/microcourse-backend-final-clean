param(
  [Parameter(Mandatory=$true)]
  [string]$BaseUrl
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Probe([string]$Url, [int]$TimeoutSec = 10) {
  try {
    $r = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec
    return [pscustomobject]@{ code = [int]$r.StatusCode; note = "OK" }
  } catch {
    $code = 0

    # StrictMode-safe: Response may not exist (DNS/timeout/connection refused)
    $respProp = $_.Exception.PSObject.Properties["Response"]
    if ($respProp -and $respProp.Value) {
      $statusProp = $respProp.Value.PSObject.Properties["StatusCode"]
      if ($statusProp -and $statusProp.Value) {
        $code = [int]$statusProp.Value
      }
    }

    $note = switch ($code) {
      401 { "PROTECTED (good)" }
      403 { "PROTECTED (good)" }
      404 { "FAIL" }
      0   { "ERR" }
      default { "FAIL" }
    }

    return [pscustomobject]@{ code = $code; note = $note }
  }
}

Write-Host ""
Write-Host "=== Doctor PROD ===" -ForegroundColor Cyan
Write-Host ("BaseUrl: {0}" -f $BaseUrl)

$paths = @(
  "/health",
  "/healthz",
  "/readyz",
  "/api/health",
  "/version",
  "/api/courses/public",
  "/api/courses",
  "/api/quizzes",
  "/api/analytics/student/overview"
)

$fail = 0

foreach ($p in $paths) {
  $u = $BaseUrl.TrimEnd("/") + $p
  $res = Probe -Url $u -TimeoutSec 10

  "{0,-35} {1,3} {2}" -f $p, $res.code, $res.note | Write-Host

  if ($p -in @("/health","/healthz","/readyz","/api/health","/version","/api/courses/public")) {
    if ($res.code -ne 200) { $fail++ }
  }

  if ($p -in @("/api/courses","/api/quizzes","/api/analytics/student/overview")) {
    if ($res.code -notin @(401,403)) { $fail++ }
  }
}

if ($fail -gt 0) { exit 1 }
Write-Host "PROD OK" -ForegroundColor Green